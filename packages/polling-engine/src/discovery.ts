import { Worker, Queue, Job } from "bullmq";
import IORedis from "ioredis";
import { createDb, devices } from "@netpulse/shared";
import { eq } from "drizzle-orm";
import { snmpWalk } from "./index.js";

const LLDP_OID = {
  remManAddr: "1.0.8802.1.1.2.1.4.2.1.4",
  remSysName: "1.0.8802.1.1.2.1.4.1.1.9",
  remSysDesc: "1.0.8802.1.1.2.1.4.1.1.10",
  remPortId: "1.0.8802.1.1.2.1.4.1.1.7",
  remChassisId: "1.0.8802.1.1.2.1.4.1.1.5",
};

const ARP_OID = {
  ipNetToMediaNetAddress: "1.3.6.1.2.1.4.22.1.3",
  ipNetToMediaPhysAddress: "1.3.6.1.2.1.4.22.1.2",
};

export interface DiscoveryConfig {
  redisUrl: string;
  databaseUrl: string;
  defaultSnmpCommunity?: string;
  discoveryInterval?: number;
}

export interface DiscoveryResult {
  sourceDeviceId: string;
  sourceDeviceName: string;
  neighborsFound: DiscoveredNeighbor[];
  newDevicesCreated: number;
  alreadyKnown: number;
  errors: string[];
}

export interface DiscoveredNeighbor {
  ip: string;
  hostname?: string;
  description?: string;
  macAddress?: string;
  sourcePort?: string;
  discoveryMethod: "lldp" | "arp";
  isNew: boolean;
}

/**
 * Extract an IPv4 address from the trailing OID suffix.
 * LLDP remManAddr OIDs encode the address as the last 4 octets.
 */
function extractIpFromOidSuffix(oid: string): string | null {
  const parts = oid.split(".");
  if (parts.length < 4) return null;
  const octets = parts.slice(-4);
  if (octets.every((o) => { const n = Number(o); return n >= 0 && n <= 255; })) {
    return octets.join(".");
  }
  return null;
}

export class DiscoveryEngine {
  private config: DiscoveryConfig;
  private redis: IORedis | null = null;
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private db: ReturnType<typeof createDb>["db"] | null = null;

  constructor(config: DiscoveryConfig) {
    this.config = config;
  }

  start() {
    this.redis = new IORedis(this.config.redisUrl, { maxRetriesPerRequest: null });
    const { db } = createDb(this.config.databaseUrl);
    this.db = db;

    this.queue = new Queue("network-discovery", { connection: this.redis });

    this.worker = new Worker(
      "network-discovery",
      async (job: Job) => {
        if (job.name === "full-discovery") {
          return this.runFullDiscovery();
        }
        if (job.name === "device-discovery" && job.data?.device) {
          return this.discoverFromDevice(job.data.device);
        }
      },
      { connection: this.redis },
    );

    const interval = (this.config.discoveryInterval || 3600) * 1000;
    this.queue.add("full-discovery", {}, {
      repeat: { every: interval },
      jobId: "scheduled-full-discovery",
      removeOnComplete: 50,
      removeOnFail: 20,
    });

    return { queue: this.queue, worker: this.worker };
  }

  async shutdown() {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
    if (this.redis) this.redis.disconnect();
  }

  async runFullDiscovery(): Promise<DiscoveryResult[]> {
    if (!this.db) throw new Error("DiscoveryEngine not started");

    const allDevices = await this.db
      .select()
      .from(devices)
      .where(eq(devices.pollingEnabled, true));

    const results: DiscoveryResult[] = [];
    for (const device of allDevices) {
      try {
        const result = await this.discoverFromDevice(device);
        results.push(result);
      } catch (err) {
        results.push({
          sourceDeviceId: device.id,
          sourceDeviceName: device.name,
          neighborsFound: [],
          newDevicesCreated: 0,
          alreadyKnown: 0,
          errors: [err instanceof Error ? err.message : String(err)],
        });
      }
    }
    return results;
  }

  async discoverFromDevice(device: {
    id: string;
    name: string;
    ip: string;
    snmpCommunity?: string | null;
    snmpPort?: number | null;
  }): Promise<DiscoveryResult> {
    if (!this.db) throw new Error("DiscoveryEngine not started");

    const community = device.snmpCommunity || this.config.defaultSnmpCommunity;
    if (!community) {
      return {
        sourceDeviceId: device.id,
        sourceDeviceName: device.name,
        neighborsFound: [],
        newDevicesCreated: 0,
        alreadyKnown: 0,
        errors: ["No SNMP community configured"],
      };
    }

    const port = device.snmpPort || 161;
    const errors: string[] = [];
    const neighborMap = new Map<string, DiscoveredNeighbor>();

    // ── LLDP ──────────────────────────────────────────
    try {
      const [addrResults, nameResults, descResults, portResults] = await Promise.all([
        snmpWalk(device.ip, community, LLDP_OID.remManAddr, port),
        snmpWalk(device.ip, community, LLDP_OID.remSysName, port),
        snmpWalk(device.ip, community, LLDP_OID.remSysDesc, port),
        snmpWalk(device.ip, community, LLDP_OID.remPortId, port),
      ]);

      const nameMap = new Map<string, string>();
      for (const entry of nameResults) {
        const key = entry.oid.replace(LLDP_OID.remSysName + ".", "");
        nameMap.set(key, String(entry.value));
      }

      const descMap = new Map<string, string>();
      for (const entry of descResults) {
        const key = entry.oid.replace(LLDP_OID.remSysDesc + ".", "");
        descMap.set(key, String(entry.value));
      }

      const portMap = new Map<string, string>();
      for (const entry of portResults) {
        const key = entry.oid.replace(LLDP_OID.remPortId + ".", "");
        portMap.set(key, String(entry.value));
      }

      for (const entry of addrResults) {
        const ip = extractIpFromOidSuffix(entry.oid);
        if (!ip || ip === device.ip) continue;

        const suffix = entry.oid.replace(LLDP_OID.remManAddr + ".", "");
        const indexParts = suffix.split(".");
        const indexKey = indexParts.slice(0, 3).join(".");

        neighborMap.set(ip, {
          ip,
          hostname: nameMap.get(indexKey),
          description: descMap.get(indexKey),
          sourcePort: portMap.get(indexKey),
          discoveryMethod: "lldp",
          isNew: false,
        });
      }
    } catch (err) {
      errors.push(`LLDP walk failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── ARP ───────────────────────────────────────────
    try {
      const [ipResults, macResults] = await Promise.all([
        snmpWalk(device.ip, community, ARP_OID.ipNetToMediaNetAddress, port),
        snmpWalk(device.ip, community, ARP_OID.ipNetToMediaPhysAddress, port),
      ]);

      const macMap = new Map<string, string>();
      for (const entry of macResults) {
        const key = entry.oid.replace(ARP_OID.ipNetToMediaPhysAddress + ".", "");
        macMap.set(key, String(entry.value));
      }

      for (const entry of ipResults) {
        const ip = String(entry.value);
        if (ip === device.ip) continue;

        const key = entry.oid.replace(ARP_OID.ipNetToMediaNetAddress + ".", "");
        const mac = macMap.get(key);

        if (neighborMap.has(ip)) {
          const existing = neighborMap.get(ip)!;
          if (mac && !existing.macAddress) {
            existing.macAddress = mac;
          }
        } else {
          neighborMap.set(ip, {
            ip,
            macAddress: mac,
            discoveryMethod: "arp",
            isNew: false,
          });
        }
      }
    } catch (err) {
      errors.push(`ARP walk failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── Deduplicate against DB & create new devices ──
    const neighbors = Array.from(neighborMap.values());
    let newDevicesCreated = 0;
    let alreadyKnown = 0;

    for (const neighbor of neighbors) {
      try {
        const existing = await this.db
          .select({ id: devices.id })
          .from(devices)
          .where(eq(devices.ip, neighbor.ip))
          .limit(1);

        if (existing.length > 0) {
          alreadyKnown++;
          neighbor.isNew = false;
        } else {
          neighbor.isNew = true;
          await this.db.insert(devices).values({
            name: neighbor.hostname || `discovered-${neighbor.ip}`,
            ip: neighbor.ip,
            type: "other",
            status: "unknown",
            snmpCommunity: this.config.defaultSnmpCommunity || null,
            pollingEnabled: true,
          });
          newDevicesCreated++;
        }
      } catch (err) {
        errors.push(`DB error for ${neighbor.ip}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      sourceDeviceId: device.id,
      sourceDeviceName: device.name,
      neighborsFound: neighbors,
      newDevicesCreated,
      alreadyKnown,
      errors,
    };
  }
}
