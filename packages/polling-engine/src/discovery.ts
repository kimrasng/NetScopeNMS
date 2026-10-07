import { Worker, Queue, Job } from "bullmq";
import IORedis from "ioredis";
import { createDb, devices, topologyEdges, snmpV3Schema, type SnmpV3Config } from "@netpulse/shared";
import { isIP } from "node:net";
import { eq } from "drizzle-orm";
import { snmpWalk, snmpWalkWithSession, createSnmpV3Session } from "./index.js";

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
  onDiscovered?: (deviceIds: string[]) => Promise<void>;
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
  private client: ReturnType<typeof createDb>["client"] | null = null;
  private db: ReturnType<typeof createDb>["db"] | null = null;

  constructor(config: DiscoveryConfig) {
    this.config = config;
  }

  start() {
    this.redis = new IORedis(this.config.redisUrl, { maxRetriesPerRequest: null });
    const { db, client } = createDb(this.config.databaseUrl);
    this.db = db;
    this.client = client;

    this.queue = new Queue("network-discovery", { connection: this.redis });

    this.worker = new Worker(
      "network-discovery",
      async (job: Job) => {
        if (job.name === "full-discovery") {
          return this.runFullDiscovery();
        }
        if (job.name === "device-discovery" && job.data?.deviceId) {
          const device = await this.db!.query.devices.findFirst({ where: eq(devices.id, String(job.data.deviceId)) });
          if (!device) throw new Error("Device not found");
          return this.discoverFromDevice(device);
        }
      },
      { connection: this.redis },
    );

    const interval = (this.config.discoveryInterval || 3600) * 1000;
    void this.queue.upsertJobScheduler("scheduled-full-discovery", { every: interval }, {
      name: "full-discovery", data: {}, opts: { removeOnComplete: 50, removeOnFail: 20 },
    }).catch(error => console.error("Discovery scheduling failed", error));

    return { queue: this.queue, worker: this.worker };
  }

  async shutdown() {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
    if (this.redis) this.redis.disconnect();
    if (this.client) await this.client.end();
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
    snmpVersion?: string | null;
    snmpV3Config?: SnmpV3Config | null;
    groupId?: string | null;
    snmpPort?: number | null;
  }): Promise<DiscoveryResult> {
    if (!this.db) throw new Error("DiscoveryEngine not started");

    const community = device.snmpCommunity || this.config.defaultSnmpCommunity;
    if (device.snmpVersion === "v3" ? !device.snmpV3Config : !community) {
      return {
        sourceDeviceId: device.id,
        sourceDeviceName: device.name,
        neighborsFound: [],
        newDevicesCreated: 0,
        alreadyKnown: 0,
        errors: [device.snmpVersion === "v3" ? "No SNMPv3 credentials configured" : "No SNMP community configured"],
      };
    }

    const port = device.snmpPort || 161;
    const walk = (oid: string) => device.snmpVersion === "v3"
      ? snmpWalkWithSession(createSnmpV3Session(device.ip, snmpV3Schema.parse(device.snmpV3Config), port), oid)
      : snmpWalk(device.ip, community!, oid, port, device.snmpVersion === "v1" ? "v1" : "v2c");
    const errors: string[] = [];
    const neighborMap = new Map<string, DiscoveredNeighbor>();

    // ── LLDP ──────────────────────────────────────────
    try {
      const [addrResults, nameResults, descResults, portResults] = await Promise.all([
        walk(LLDP_OID.remManAddr),
        walk(LLDP_OID.remSysName),
        walk(LLDP_OID.remSysDesc),
        walk(LLDP_OID.remPortId),
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
        walk(ARP_OID.ipNetToMediaNetAddress),
        walk(ARP_OID.ipNetToMediaPhysAddress),
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

    const affected = new Set<string>([device.id]);
    for (const neighbor of neighbors) {
      if (!isIP(neighbor.ip)) { errors.push("Invalid neighbor IP"); continue; }
      try {
        const existing = await this.db
          .select({ id: devices.id })
          .from(devices)
          .where(eq(devices.ip, neighbor.ip))
          .limit(1);

        let neighborId = existing[0]?.id;
        if (existing.length > 0) {
          alreadyKnown++;
          neighbor.isNew = false;
        } else {
          neighbor.isNew = true;
          const [created] = await this.db.insert(devices).values({
            name: neighbor.hostname || `discovered-${neighbor.ip}`,
            ip: neighbor.ip,
            type: "other",
            status: "unknown",
            snmpCommunity: device.snmpVersion === "v3" ? null : community, snmpVersion: device.snmpVersion === "v3" ? "v3" : device.snmpVersion === "v1" ? "v1" : "v2c", snmpV3Config: device.snmpV3Config, snmpPort: port, groupId: device.groupId,
            pollingEnabled: true,
          }).returning({ id: devices.id });
          neighborId = created.id;
          newDevicesCreated++;
        }
        if (neighborId) {
          affected.add(neighborId);
          await this.db.insert(topologyEdges).values({ sourceDeviceId: device.id, targetDeviceId: neighborId, sourcePort: neighbor.sourcePort ?? "", discoveryMethod: neighbor.discoveryMethod })
            .onConflictDoUpdate({ target: [topologyEdges.sourceDeviceId, topologyEdges.targetDeviceId, topologyEdges.sourcePort], set: { lastSeenAt: new Date(), discoveryMethod: neighbor.discoveryMethod } });
        }
      } catch (err) {
        errors.push(`DB error for ${neighbor.ip}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (this.config.onDiscovered) await this.config.onDiscovered([...affected]);
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
