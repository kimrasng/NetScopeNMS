import { Worker, Queue, Job } from "bullmq";
import IORedis from "ioredis";
import snmp from "net-snmp";
import ping from "ping";
import { createDb, devices, metrics, interfaces as ifTable, incidents, snmpV3Schema } from "@netpulse/shared";
import { eq, and, ne } from "drizzle-orm";

export interface PollingConfig {
  redisUrl: string;
  databaseUrl: string;
  concurrency?: number;
  onResult?: (result: PollResult) => Promise<void>;
  isInMaintenance?: (device: { id: string; groupId: string | null }) => Promise<boolean>;
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

function snmpGet(host: string, community: string, oids: string[], port = 161, version: "v1" | "v2c" = "v2c"): Promise<Record<string, string | number>> {
  const session = snmp.createSession(host, community, { port, version: version === "v1" ? 0 : 1, timeout: 5000, retries: 1 });
  return snmpGetWithSession(session, oids);
}

function snmpWalk(host: string, community: string, oid: string, port = 161, version: "v1" | "v2c" = "v2c"): Promise<{ oid: string; value: string | number }[]> {
  const session = snmp.createSession(host, community, { port, version: version === "v1" ? 0 : 1, timeout: 5000, retries: 1 });
  return snmpWalkWithSession(session, oid);
}

function snmpGetWithSession(session: snmp.Session, oids: string[]): Promise<Record<string, string | number>> {
  return new Promise((resolve, reject) => {
    session.get(oids, (error: Error | null, varbinds: snmp.Varbind[]) => {
      session.close();
      if (error) return reject(error);
      const result: Record<string, string | number> = {};
      for (const vb of varbinds) {
        if (snmp.isVarbindError(vb)) continue;
        result[vb.oid] = typeof vb.value === "number" ? vb.value : String(vb.value);
      }
      resolve(result);
    });
  });
}

function snmpWalkWithSession(session: snmp.Session, oid: string): Promise<{ oid: string; value: string | number }[]> {
  return new Promise((resolve, reject) => {
    const results: { oid: string; value: string | number }[] = [];
    session.subtree(oid, 20, (varbinds: snmp.Varbind[]) => {
      for (const vb of varbinds) {
        if (!snmp.isVarbindError(vb)) {
          results.push({
            oid: vb.oid,
            value: typeof vb.value === "number" ? vb.value : String(vb.value),
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
  let createSession: (() => snmp.Session) | null = null;

  if (device.snmpVersion === "v3" && device.snmpV3Config) {
    createSession = () => createSnmpV3Session(device.ip, device.snmpV3Config!, port);
  } else if (device.snmpCommunity && (device.snmpVersion === "v1" || device.snmpVersion === "v2c")) {
    createSession = () => snmp.createSession(device.ip, device.snmpCommunity!, { port, version: device.snmpVersion === "v1" ? 0 : 1, timeout: 5000, retries: 1 });
  }

  // SNMP polling
  if (createSession) {
    try {
      // CPU & Memory
      const sysMetrics = await snmpGetWithSession(createSession(), [
        OID.cpuLoad1min, OID.memTotalReal, OID.memAvailReal,
      ]);

      if (sysMetrics[OID.cpuLoad1min] !== undefined) {
        result.metrics.push({ name: "load_1m", value: parseFloat(String(sysMetrics[OID.cpuLoad1min])) });
      }
      if (sysMetrics[OID.memTotalReal] !== undefined && sysMetrics[OID.memAvailReal] !== undefined) {
        const total = Number(sysMetrics[OID.memTotalReal]);
        const avail = Number(sysMetrics[OID.memAvailReal]);
        if (total > 0) {
          result.metrics.push({ name: "memory", value: Math.round(((total - avail) / total) * 100), unit: "%" });
        }
      }

      try {
        const processors = await snmpWalkWithSession(createSession(), "1.3.6.1.2.1.25.3.3.1.2");
        const loads = processors.map(p => Number(p.value)).filter(v => Number.isFinite(v) && v >= 0 && v <= 100);
        if (loads.length) result.metrics.push({ name: "cpu", value: loads.reduce((sum, value) => sum + value, 0) / loads.length, unit: "%" });
      } catch { /* A device may not implement HOST-RESOURCES-MIB. */ }

      // Interfaces
      try {
        const ifNames = await snmpWalkWithSession(createSession(), OID.ifDescr);
        const ifStatuses = await snmpWalkWithSession(createSession(), OID.ifOperStatus);
        const ifIn = await snmpWalkWithSession(createSession(), OID.ifInOctets);
        const ifOut = await snmpWalkWithSession(createSession(), OID.ifOutOctets);

        const now = Date.now();
        const byIndex = (rows: { oid: string; value: string | number }[]) => new Map(rows.map(row => [Number(row.oid.split(".").at(-1)), row.value]));
        const statuses = byIndex(ifStatuses), incoming = byIndex(ifIn), outgoing = byIndex(ifOut);
        result.interfaces = ifNames.map((iface) => {
          const ifIndex = Number(iface.oid.split(".").at(-1));
          const status = statuses.has(ifIndex) ? Number(statuses.get(ifIndex)) === 1 ? "up" : "down" : "unknown";
          const inOctets = Number(incoming.get(ifIndex) ?? 0);
          const outOctets = Number(outgoing.get(ifIndex) ?? 0);

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
                : (4294967296 - prev.inOctets) + inOctets;
              const outDelta = outOctets >= prev.outOctets
                ? outOctets - prev.outOctets
                : (4294967296 - prev.outOctets) + outOctets;
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
  const { db, client } = createDb(cfg.databaseUrl);

  const pollQueue = new Queue("device-polling", { connection: redis });
  const metricQueue = new Queue("metric-events", { connection: redis });

  // Worker processes poll jobs
  const worker = new Worker("device-polling", async (job: Job) => {
    const deviceId = String(job.data.deviceId ?? job.data.id);
    const device = await db.query.devices.findFirst({ where: eq(devices.id, deviceId) });
    if (!device?.pollingEnabled) return;
    const v3 = device.snmpV3Config ? snmpV3Schema.parse(device.snmpV3Config) : null;
    const result = await pollDevice({ ...device, snmpV3Config: v3 });

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

    const active = await db.query.incidents.findFirst({ where: and(eq(incidents.deviceId, device.id), ne(incidents.status, "resolved")) });
    const maintenance = cfg.isInMaintenance ? await cfg.isInMaintenance(device) : false;
    const newStatus = maintenance ? "maintenance" : result.reachable ? active ? "warning" : "up" : "down";

    await db.update(devices)
      .set({ status: newStatus, lastPolledAt: new Date(), updatedAt: new Date() })
      .where(eq(devices.id, result.deviceId));

    // Update interfaces
    if (result.interfaces) {
      for (const iface of result.interfaces) {
        await db.insert(ifTable).values({ deviceId: result.deviceId, ...iface, lastUpdatedAt: new Date() })
          .onConflictDoUpdate({ target: [ifTable.deviceId, ifTable.ifIndex], set: { ...iface, lastUpdatedAt: new Date() } });
      }
    }

    if (cfg.onResult) await cfg.onResult(result);
    return result;
  }, { connection: redis, concurrency: cfg.concurrency || 10 });

  async function syncDevice(deviceId: string) {
    const device = await db.query.devices.findFirst({ where: eq(devices.id, deviceId) });
    const schedulerId = `poll-${deviceId}`;
    if (!device?.pollingEnabled) { await pollQueue.removeJobScheduler(schedulerId); return; }
    await pollQueue.upsertJobScheduler(schedulerId, { every: device.pollingInterval * 1000 }, { name: schedulerId, data: { deviceId }, opts: { removeOnComplete: 100, removeOnFail: 50 } });
  }
  async function schedulePolling() {
    const allDevices = await db.select({ id: devices.id }).from(devices).where(eq(devices.pollingEnabled, true));
    const valid = new Set(allDevices.map(d => `poll-${d.id}`));
    for (const legacy of await pollQueue.getRepeatableJobs()) await pollQueue.removeRepeatableByKey(legacy.key);
    for (const scheduler of await pollQueue.getJobSchedulers(0, -1)) if (scheduler.id && !valid.has(scheduler.id)) await pollQueue.removeJobScheduler(scheduler.id);
    for (const device of allDevices) await syncDevice(device.id);
  }

  // Graceful shutdown
  async function shutdown() {
    console.log("Polling engine shutting down...");
    await worker.close();
    await pollQueue.close();
    await metricQueue.close();
    redis.disconnect();
    await client.end();
  }


  return { pollQueue, worker, schedulePolling, syncDevice, shutdown, pollDevice };
}

export { icmpPing, snmpGet, snmpWalk, snmpGetWithSession, snmpWalkWithSession, createSnmpV3Session, pollDevice };
export { TrapReceiver } from "./trap-receiver.js";
export type { TrapReceiverConfig, TrapEvent } from "./trap-receiver.js";
export { DiscoveryEngine } from "./discovery.js";
export type { DiscoveryConfig, DiscoveryResult, DiscoveredNeighbor } from "./discovery.js";
