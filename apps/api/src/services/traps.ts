import type { FastifyInstance } from "fastify";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { z } from "zod";
import { and, eq, ne, sql, asc } from "drizzle-orm";
import { devices, incidents, incidentEvents, notificationChannels } from "@netpulse/shared";
import { isDeviceInMaintenance } from "./maintenance.js";
import { enqueueDeliveries } from "./delivery.js";
import { refreshDeviceStatus } from "./device-status.js";
import { emitDeviceEvent } from "./realtime.js";

const trapSchema = z.object({ sourceIp: z.string().ip(), oid: z.string().min(1), timestamp: z.coerce.date(), varbinds: z.array(z.object({ oid: z.string(), type: z.number(), value: z.unknown() })) });
export function startTrapEngine(app: FastifyInstance, redisUrl: string) {
  const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const worker = new Worker("trap-events", async job => {
    const trap = trapSchema.parse(job.data);
    const device = await app.db.query.devices.findFirst({ where: eq(devices.ip, trap.sourceIp), orderBy: [asc(devices.createdAt), asc(devices.id)] });
    if (!device || await isDeviceInMaintenance(app.db, device, trap.timestamp)) return;
    const isLink = trap.oid === "1.3.6.1.6.3.1.1.5.3" || trap.oid === "1.3.6.1.6.3.1.1.5.4";
    const port = trap.varbinds.find(v => v.oid.startsWith("1.3.6.1.2.1.2.2.1.1."))?.value;
    const metricName = isLink ? `trap:link:${String(port ?? "device")}` : `trap:${trap.oid}`;
    const updated = await app.db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${device.id}), hashtext(${metricName}))`);
      const existing = await tx.query.incidents.findFirst({ where: and(eq(incidents.deviceId, device.id), eq(incidents.metricName, metricName), ne(incidents.status, "resolved")) });
      if (existing && trap.oid !== "1.3.6.1.6.3.1.1.5.4") {
        await tx.insert(incidentEvents).values({ incidentId: existing.id, type: "trap", message: `Repeated SNMP trap ${trap.oid}`, metadata: { varbinds: trap.varbinds } });
        return existing;
      }
      if (!existing && trap.oid === "1.3.6.1.6.3.1.1.5.4") return undefined;
      const phase = trap.oid === "1.3.6.1.6.3.1.1.5.4" ? "resolved" : "trigger";
      const [incident] = existing
        ? await tx.update(incidents).set({ status: "resolved", resolvedAt: trap.timestamp, updatedAt: new Date() }).where(eq(incidents.id, existing.id)).returning()
        : await tx.insert(incidents).values({ deviceId: device.id, severity: isLink ? "high" : "medium", title: `SNMP ${isLink ? "link down" : "trap"}: ${device.name} (${trap.oid})`, metricName, description: `Received from ${trap.sourceIp}` }).returning();
      await tx.insert(incidentEvents).values({ incidentId: incident.id, type: phase === "trigger" ? "created" : "resolved", message: `SNMP trap ${trap.oid}`, metadata: { varbinds: trap.varbinds } });
      const channels = await tx.select({ id: notificationChannels.id }).from(notificationChannels).where(eq(notificationChannels.enabled, true));
      await enqueueDeliveries(tx, channels.map(c => c.id), { deviceName: device.name, deviceIp: device.ip, alertType: incident.title, severity: incident.severity, timestamp: trap.timestamp.toISOString(), metricValue: trap.oid, incidentUrl: `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/incidents/${incident.id}`, incidentId: incident.id, event: phase }, phase);
      return incident;
    });
    if (updated) await refreshDeviceStatus(app, device.id);
    if (updated) await emitDeviceEvent(app, "incident:updated", device.id, updated);
  }, { connection: redis, concurrency: 5 });
  return { worker, shutdown: async () => { await worker.close(); redis.disconnect(); } };
}
