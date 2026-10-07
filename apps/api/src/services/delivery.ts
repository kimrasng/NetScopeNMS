import type { FastifyInstance } from "fastify";
import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { notifications, notificationChannels, incidents, devices, alertRules, type Database } from "@netpulse/shared";
import { dispatchNotification, type NotificationPayload } from "@netpulse/notification";
import { emitDeviceEvent } from "./realtime.js";
import { isDeviceInMaintenance } from "./maintenance.js";

const payloadSchema = z.object({ deviceName: z.string(), deviceIp: z.string(), alertType: z.string(), severity: z.enum(["critical", "high", "medium", "low"]), timestamp: z.string(), metricValue: z.string(), incidentUrl: z.string(), incidentId: z.string(), aiSummary: z.string().optional(), event: z.enum(["trigger", "resolved", "escalated", "test"]).optional(), runbookUrl: z.string().optional() });

export async function enqueueDeliveries(db: Pick<Database, "select" | "insert">, channelIds: string[], payload: NotificationPayload, phase: string) {
  if (!channelIds.length) return;
  const channels = await db.select().from(notificationChannels).where(and(inArray(notificationChannels.id, channelIds), eq(notificationChannels.enabled, true)));
  for (const channel of channels) await db.insert(notifications).values({
    incidentId: payload.event === "test" ? null : payload.incidentId,
    channelId: channel.id, channelType: channel.type, status: "pending", payload,
    dedupKey: `${payload.incidentId}:${phase}:${channel.id}`,
  }).onConflictDoNothing();
}

export async function deliverRecord(app: FastifyInstance, id: string) {
  const [record] = await app.db.update(notifications).set({ status: "sending", attempts: sql`${notifications.attempts} + 1`, nextAttemptAt: new Date(Date.now() + 60000) })
    .where(and(eq(notifications.id, id), inArray(notifications.status, ["pending", "sending"]), lte(notifications.nextAttemptAt, new Date()))).returning();
  if (!record) return;
  try {
    const channel = record.channelId ? await app.db.query.notificationChannels.findFirst({ where: eq(notificationChannels.id, record.channelId) }) : undefined;
    const payload = payloadSchema.parse(record.payload);
    if (!channel || (!channel.enabled && payload.event !== "test")) {
      await app.db.update(notifications).set({ status: "cancelled", error: "Channel disabled or removed" }).where(eq(notifications.id, id));
      return;
    }
    if (record.incidentId) {
      const incident = await app.db.query.incidents.findFirst({ where: eq(incidents.id, record.incidentId) });
      const device = incident ? await app.db.query.devices.findFirst({ where: eq(devices.id, incident.deviceId) }) : undefined;
      if (device && await isDeviceInMaintenance(app.db, device)) {
        await app.db.update(notifications).set({ status: "suppressed", error: "Active maintenance" }).where(eq(notifications.id, id));
        return;
      }
      if (payload.event === "escalated" && incident?.status !== "problem") {
        await app.db.update(notifications).set({ status: "cancelled", error: "Incident acknowledged or resolved" }).where(eq(notifications.id, id));
        return;
      }
    }
    const config = z.record(z.unknown()).parse(channel.config);
    await dispatchNotification({ type: channel.type, config }, payload);
    await app.db.update(notifications).set({ status: "sent", sentAt: new Date(), error: null }).where(eq(notifications.id, id));
    if (record.incidentId) {
      const incident = await app.db.query.incidents.findFirst({ where: eq(incidents.id, record.incidentId) });
      if (incident) await emitDeviceEvent(app, "notification", incident.deviceId, { incidentId: incident.id, notificationId: id, status: "sent" });
    }
  } catch (error) {
    await app.db.update(notifications).set({ status: record.attempts >= 4 ? "failed" : "pending", error: error instanceof Error ? error.message : "Delivery failed", nextAttemptAt: new Date(Date.now() + 1000 * 2 ** record.attempts) }).where(eq(notifications.id, id));
    app.log.error({ notificationId: id, attempt: record.attempts }, "Notification delivery failed");
  }
}

export function startDeliveryEngine(app: FastifyInstance, redisUrl: string) {
  const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue("notification-delivery", { connection: redis });
  const worker = new Worker<{ id: string }>("notification-delivery", job => deliverRecord(app, job.data.id), { connection: redis, concurrency: 5 });
  let ticking = false;
  let inFlight: Promise<void> = Promise.resolve();
  const tick = async () => {
    if (ticking) return;
    ticking = true;
    try {
      const active = await app.db.select({ incident: incidents, rule: alertRules, device: devices }).from(incidents)
        .innerJoin(alertRules, eq(incidents.ruleId, alertRules.id)).innerJoin(devices, eq(incidents.deviceId, devices.id))
        .where(and(eq(incidents.status, "problem"), eq(alertRules.enabled, true)));
      for (const { incident, rule, device } of active) {
        if (!rule.escalationMinutes || Date.now() < incident.startedAt.getTime() + rule.escalationMinutes * 60000 || await isDeviceInMaintenance(app.db, device)) continue;
        await enqueueDeliveries(app.db, rule.escalationChannels ?? [], { deviceName: device.name, deviceIp: device.ip, alertType: incident.title, severity: incident.severity, timestamp: new Date().toISOString(), metricValue: String(incident.metricValue ?? ""), incidentUrl: `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/incidents/${incident.id}`, incidentId: incident.id, event: "escalated", runbookUrl: rule.runbookUrl ?? undefined }, "escalated");
      }
      const pending = await app.db.select({ id: notifications.id }).from(notifications).where(and(inArray(notifications.status, ["pending", "sending"]), lte(notifications.nextAttemptAt, new Date()))).limit(200);
      for (const record of pending) await queue.add("deliver", record, { jobId: `delivery-${record.id}`, removeOnComplete: true, removeOnFail: 100, attempts: 3, backoff: { type: "exponential", delay: 1000 } });
    } catch (error) { app.log.error({ err: error }, "Delivery scheduler failed"); }
    finally { ticking = false; }
  };
  const interval = setInterval(() => { if (!ticking) inFlight = tick(); }, 1000);
  interval.unref();
  inFlight = tick();
  return { worker, queue, shutdown: async () => { clearInterval(interval); await inFlight; await worker.close(); await queue.close(); redis.disconnect(); } };
}
