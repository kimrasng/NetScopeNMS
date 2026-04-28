import { Worker, Queue, Job } from "bullmq";
import IORedis from "ioredis";
import snmp from "net-snmp";
import ping from "ping";
import { createDb, devices, metrics, interfaces as ifTable } from "@netpulse/shared";
import { eq, and } from "drizzle-orm";

export interface PollingConfig {
  redisUrl: string;
  databaseUrl: string;
  concurrency?: number;
}

export interface PollResult {
  deviceId: string;
  metrics: { name: string; value: number; unit?: string }[];
  interfaces?: { ifIndex: number; name: string; status: string; inBps: number; outBps: number }[];
  reachable: boolean;
  latency?: number;
}

export interface SnmpV3Config {
  securityLevel: "noAuthNoPriv" | "authNoPriv" | "authPriv";
  username: string;
  authProtocol?: "MD5" | "SHA" | "SHA224" | "SHA256" | "SHA384" | "SHA512";
  authKey?: string;
  privProtocol?: "DES" | "AES" | "AES256";
  privKey?: string;
}

const SECURITY_LEVEL_MAP: Record<string, number> = {
  noAuthNoPriv: 1,
  authNoPriv: 2,
  authPriv: 3,
};

const AUTH_PROTOCOL_MAP: Record<string, number> = {
  MD5: 2,
  SHA: 3,
  SHA224: 4,
  SHA256: 5,
  SHA384: 6,
  SHA512: 7,
};

const PRIV_PROTOCOL_MAP: Record<string, number> = {
  DES: 2,
  AES: 4,
  AES256: 6,
};

/** Standard SNMP OIDs */
const OID = {
  sysDescr: "1.3.6.1.2.1.1.1.0",
  sysName: "1.3.6.1.2.1.1.5.0",
  sysObjectID: "1.3.6.1.2.1.1.2.0",
  cpuLoad1min: "1.3.6.1.4.1.2021.10.1.3.1",
  memTotalReal: "1.3.6.1.4.1.2021.4.5.0",
  memAvailReal: "1.3.6.1.4.1.2021.4.6.0",
  ifDescr: "1.3.6.1.2.1.2.2.1.2",
  ifOperStatus: "1.3.6.1.2.1.2.2.1.8",
  ifInOctets: "1.3.6.1.2.1.2.2.1.10",
  ifOutOctets: "1.3.6.1.2.1.2.2.1.16",
  ifSpeed: "1.3.6.1.2.1.2.2.1.5",
  hrDiskStorageUsed: "1.3.6.1.2.1.25.2.3.1.6",
  hrDiskStorageSize: "1.3.6.1.2.1.25.2.3.1.5",
};

/** Previous counter values for bandwidth delta calculation */
const prevCounters = new Map<string, { inOctets: number; outOctets: number; timestamp: number }>();

/**
 * ICMP ping a host and return latency + reachability.
 */
async function icmpPing(host: string): Promise<{ alive: boolean; time: number }> {
  const result = await ping.promise.probe(host, { timeout: 5 });
  return { alive: result.alive, time: parseFloat(String(result.time)) || 0 };
}

function createSnmpV3Session(host: string, v3Config: SnmpV3Config, port = 161) {
  const user: Record<string, unknown> = {
    name: v3Config.username,
    level: SECURITY_LEVEL_MAP[v3Config.securityLevel],
  };
  if (v3Config.authProtocol && v3Config.authKey) {
    user.authProtocol = AUTH_PROTOCOL_MAP[v3Config.authProtocol];
    user.authKey = v3Config.authKey;
  }
  if (v3Config.privProtocol && v3Config.privKey) {
    user.privProtocol = PRIV_PROTOCOL_MAP[v3Config.privProtocol];
    user.privKey = v3Config.privKey;
  }
  return snmp.createV3Session(host, user, { port, timeout: 5000, retries: 1 });
}

function snmpGet(host: string, community: string, oids: string[], port = 161): Promise<Record<string, string | number>> {
  const session = snmp.createSession(host, community, { port, timeout: 5000, retries: 1 });
  return snmpGetWithSession(session, oids);
}

function snmpWalk(host: string, community: string, oid: string, port = 161): Promise<{ oid: string; value: string | number }[]> {
  const session = snmp.createSession(host, community, { port, timeout: 5000, retries: 1 });
  return snmpWalkWithSession(session, oid);
}

function snmpGetWithSession(session: any, oids: string[]): Promise<Record<string, string | number>> {
  return new Promise((resolve, reject) => {
    session.get(oids, (error: Error | null, varbinds: any[]) => {
      session.close();
      if (error) return reject(error);
      const result: Record<string, string | number> = {};
      for (const vb of varbinds) {
        if (snmp.isVarbindError(vb)) continue;
        result[vb.oid] = typeof vb.value === "object" && vb.value.toString ? vb.value.toString() : vb.value;
      }
      resolve(result);
    });
  });
}

function snmpWalkWithSession(session: any, oid: string): Promise<{ oid: string; value: string | number }[]> {
  return new Promise((resolve, reject) => {
    const results: { oid: string; value: string | number }[] = [];
    session.subtree(oid, 20, (varbinds: any[]) => {
      for (const vb of varbinds) {
        if (!snmp.isVarbindError(vb)) {
          results.push({
            oid: vb.oid,
            value: typeof vb.value === "object" && vb.value.toString ? vb.value.toString() : vb.value,
          });
        }
      }
    }, (error: Error | null) => {
      session.close();
      if (error) return reject(error);
      resolve(results);
    });
  });
}

/**
 * Poll a single device: ICMP + SNMP metrics + interfaces.
 */
async function pollDevice(device: {
  id: string; ip: string; snmpVersion?: string | null; snmpCommunity?: string | null; snmpPort?: number | null;
  snmpV3Config?: SnmpV3Config | null;
}): Promise<PollResult> {
  const result: PollResult = { deviceId: device.id, metrics: [], reachable: false };

  // ICMP Ping
  const pingResult = await icmpPing(device.ip);
  result.reachable = pingResult.alive;
  result.latency = pingResult.time;
  result.metrics.push({ name: "ping", value: pingResult.alive ? 1 : 0 });
  result.metrics.push({ name: "latency", value: pingResult.time, unit: "ms" });

  const port = device.snmpPort || 161;
  let createSession: (() => any) | null = null;

  if (device.snmpVersion === "v3" && device.snmpV3Config) {
    createSession = () => createSnmpV3Session(device.ip, device.snmpV3Config!, port);
  } else if (device.snmpCommunity && (device.snmpVersion === "v1" || device.snmpVersion === "v2c")) {
    createSession = () => snmp.createSession(device.ip, device.snmpCommunity!, { port, timeout: 5000, retries: 1 });
  }

  // SNMP polling
  if (createSession) {
    try {
      // CPU & Memory
      const sysMetrics = await snmpGetWithSession(createSession(), [
        OID.cpuLoad1min, OID.memTotalReal, OID.memAvailReal,
      ]);

      if (sysMetrics[OID.cpuLoad1min] !== undefined) {
        result.metrics.push({ name: "cpu", value: parseFloat(String(sysMetrics[OID.cpuLoad1min])), unit: "%" });
      }
      if (sysMetrics[OID.memTotalReal] && sysMetrics[OID.memAvailReal]) {
        const total = Number(sysMetrics[OID.memTotalReal]);
        const avail = Number(sysMetrics[OID.memAvailReal]);
        if (total > 0) {
          result.metrics.push({ name: "memory", value: Math.round(((total - avail) / total) * 100), unit: "%" });
        }
      }

      // Interfaces
      try {
        const ifNames = await snmpWalkWithSession(createSession(), OID.ifDescr);
        const ifStatuses = await snmpWalkWithSession(createSession(), OID.ifOperStatus);
        const ifIn = await snmpWalkWithSession(createSession(), OID.ifInOctets);
        const ifOut = await snmpWalkWithSession(createSession(), OID.ifOutOctets);

        const now = Date.now();
        result.interfaces = ifNames.map((iface, idx) => {
          const ifIndex = idx + 1;
          const status = ifStatuses[idx]?.value === 1 ? "up" : "down";
          const inOctets = Number(ifIn[idx]?.value || 0);
          const outOctets = Number(ifOut[idx]?.value || 0);

          const key = `${device.id}:${ifIndex}`;
          const prev = prevCounters.get(key);
          let inBps = 0;
          let outBps = 0;
          if (prev) {
            const elapsed = (now - prev.timestamp) / 1000;
            if (elapsed > 0) {
              // Handle 32-bit counter wrap (max = 4294967295)
              const inDelta = inOctets >= prev.inOctets
                ? inOctets - prev.inOctets
                : (4294967295 - prev.inOctets) + inOctets;
              const outDelta = outOctets >= prev.outOctets
                ? outOctets - prev.outOctets
                : (4294967295 - prev.outOctets) + outOctets;
              inBps = (inDelta * 8) / elapsed;
              outBps = (outDelta * 8) / elapsed;
            }
          }
          prevCounters.set(key, { inOctets, outOctets, timestamp: now });

          return {
            ifIndex,
            name: String(iface.value),
            status,
            inBps,
            outBps,
          };
        });

        // Aggregate bandwidth
        const totalIn = result.interfaces.reduce((s, i) => s + i.inBps, 0);
        const totalOut = result.interfaces.reduce((s, i) => s + i.outBps, 0);
        result.metrics.push({ name: "bandwidth_in", value: totalIn, unit: "bps" });
        result.metrics.push({ name: "bandwidth_out", value: totalOut, unit: "bps" });
      } catch {
        // Interface walk failed, skip
      }
    } catch {
      // SNMP failed, device may not support it
    }
  }

  return result;
}

/**
 * Start the polling engine with BullMQ workers.
 */
export function startPollingEngine(cfg: PollingConfig) {
  const redis = new IORedis(cfg.redisUrl, { maxRetriesPerRequest: null });
  const { db } = createDb(cfg.databaseUrl);

  const pollQueue = new Queue("device-polling", { connection: redis });
  const metricQueue = new Queue("metric-events", { connection: redis });

  // Worker processes poll jobs
  const worker = new Worker("device-polling", async (job: Job) => {
    const device = job.data;
    const result = await pollDevice(device);

    // Store metrics
    if (result.metrics.length > 0) {
      await db.insert(metrics).values(
        result.metrics.map((m) => ({
          deviceId: result.deviceId,
          metricName: m.name,
          value: m.value,
          unit: m.unit,
          timestamp: new Date(),
        }))
      );

      for (const m of result.metrics) {
        await metricQueue.add("evaluate", {
          deviceId: result.deviceId,
          metricName: m.name,
          value: m.value,
          timestamp: new Date().toISOString(),
        }, { removeOnComplete: 100, removeOnFail: 50 });
      }
    }

    // Update device status
    const newStatus = result.reachable ? "up" : "down";
    await db.update(devices)
      .set({ status: newStatus, lastPolledAt: new Date(), updatedAt: new Date() })
      .where(eq(devices.id, result.deviceId));

    // Update interfaces
    if (result.interfaces) {
      for (const iface of result.interfaces) {
        const existing = await db.select({ id: ifTable.id })
          .from(ifTable)
          .where(and(eq(ifTable.deviceId, result.deviceId), eq(ifTable.ifIndex, iface.ifIndex)))
          .limit(1);

        if (existing.length > 0) {
          await db.update(ifTable)
            .set({
              name: iface.name,
              status: iface.status,
              inBps: iface.inBps,
              outBps: iface.outBps,
              lastUpdatedAt: new Date(),
            })
            .where(eq(ifTable.id, existing[0].id));
        } else {
          await db.insert(ifTable).values({
            deviceId: result.deviceId,
            ifIndex: iface.ifIndex,
            name: iface.name,
            status: iface.status,
            inBps: iface.inBps,
            outBps: iface.outBps,
            lastUpdatedAt: new Date(),
          });
        }
      }
    }

    return result;
  }, { connection: redis, concurrency: cfg.concurrency || 10 });

  // Schedule polling for all devices
  async function schedulePolling() {
    const allDevices = await db.select().from(devices).where(eq(devices.pollingEnabled, true));
    for (const device of allDevices) {
      await pollQueue.add(`poll-${device.id}`, device, {
        repeat: { every: (device.pollingInterval || 60) * 1000 },
        jobId: `poll-${device.id}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    }
    console.log(`Scheduled polling for ${allDevices.length} devices`);
  }

  // Graceful shutdown
  async function shutdown() {
    console.log("Polling engine shutting down...");
    await worker.close();
    await pollQueue.close();
    await metricQueue.close();
    redis.disconnect();
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return { pollQueue, worker, schedulePolling, shutdown, pollDevice };
}

export { icmpPing, snmpGet, snmpWalk, snmpGetWithSession, snmpWalkWithSession, createSnmpV3Session, pollDevice };
export { TrapReceiver } from "./trap-receiver.js";
export type { TrapReceiverConfig, TrapEvent } from "./trap-receiver.js";
export { DiscoveryEngine } from "./discovery.js";
export type { DiscoveryConfig, DiscoveryResult, DiscoveredNeighbor } from "./discovery.js";
