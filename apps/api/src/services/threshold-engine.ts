import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import { createDb, alertRules, incidents, incidentEvents, devices, alertEvaluations } from "@netpulse/shared";
import { eq, and, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { isDeviceInMaintenance } from "./maintenance.js";
import { enqueueDeliveries } from "./delivery.js";

export interface ThresholdEngineConfig {
  redisUrl: string; databaseUrl: string;
  onIncident?: (deviceId: string, incidentId: string) => Promise<void>;
}
export const metricEventSchema = z.object({ deviceId: z.string().uuid(), metricName: z.string().min(1), value: z.number().finite(), timestamp: z.string().datetime({ offset: true }) });
export type MetricEvent = z.infer<typeof metricEventSchema>;
export function evaluateCondition(value: number, operator: string, threshold: number) {
  switch (operator) {
    case ">": return value > threshold; case ">=": return value >= threshold;
    case "<": return value < threshold; case "<=": return value <= threshold;
    case "==": return value === threshold; case "!=": return value !== threshold; default: return false;
  }
}
export function startThresholdEngine(cfg: ThresholdEngineConfig) {
  const redis = new IORedis(cfg.redisUrl, { maxRetriesPerRequest: null });
  const { db, client } = createDb(cfg.databaseUrl);
  const metricQueue = new Queue<MetricEvent>("metric-events", { connection: redis });
  const worker = new Worker<MetricEvent>("metric-events", async job => {
    const event = metricEventSchema.parse(job.data);
    const device = await db.query.devices.findFirst({ where: eq(devices.id, event.deviceId) });
    if (!device || !device.pollingEnabled) return;
    const rules = await db.select().from(alertRules).where(and(eq(alertRules.metricName, event.metricName), eq(alertRules.enabled, true)));
    for (const rule of rules) {
      if ((rule.deviceId && rule.deviceId !== device.id) || (rule.groupId && rule.groupId !== device.groupId)) continue;
      const updated = await db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${device.id}), hashtext(${rule.id}))`);
        const at = new Date(event.timestamp);
        const state = await tx.query.alertEvaluations.findFirst({ where: and(eq(alertEvaluations.deviceId, device.id), eq(alertEvaluations.ruleId, rule.id)) });
        if (state && state.lastEvaluatedAt >= at) return undefined;
        const maintenance = await isDeviceInMaintenance(tx, device, at);
        const triggered = !maintenance && evaluateCondition(event.value, rule.operator, rule.threshold);
        const first = triggered ? state?.firstFailureAt && at.getTime() - state.firstFailureAt.getTime() < (rule.flapWindow ?? 5) * 60000 ? state.firstFailureAt : at : null;
        const count = triggered ? first === state?.firstFailureAt ? (state?.failureCount ?? 0) + 1 : 1 : 0;
        await tx.insert(alertEvaluations).values({ deviceId: device.id, ruleId: rule.id, failureCount: count, firstFailureAt: first, lastEvaluatedAt: at })
          .onConflictDoUpdate({ target: [alertEvaluations.deviceId, alertEvaluations.ruleId], set: { failureCount: count, firstFailureAt: first, lastEvaluatedAt: at } });
        if (maintenance) return undefined;
        const current = await tx.query.incidents.findFirst({ where: and(eq(incidents.deviceId, device.id), eq(incidents.ruleId, rule.id), ne(incidents.status, "resolved")) });
        let incident: typeof incidents.$inferSelect | undefined;
        let phase: "trigger" | "resolved";
        if (triggered && count >= (rule.flapThreshold ?? 3) && !current) {
          [incident] = await tx.insert(incidents).values({ deviceId: device.id, ruleId: rule.id, severity: rule.severity, title: `${rule.name}: ${event.metricName} ${rule.operator} ${rule.threshold} on ${device.name}`, metricName: event.metricName, metricValue: event.value }).onConflictDoNothing().returning();
          phase = "trigger";
        } else if (!triggered && current) {
          [incident] = await tx.update(incidents).set({ status: "resolved", resolvedAt: at, updatedAt: new Date() }).where(eq(incidents.id, current.id)).returning();
          phase = "resolved";
        } else return undefined;
        if (!incident) return undefined;
        await tx.insert(incidentEvents).values({ incidentId: incident.id, type: phase === "trigger" ? "created" : "resolved", message: `${phase === "trigger" ? "Triggered" : "Auto-resolved"}: ${event.metricName} = ${event.value}` });
        await enqueueDeliveries(tx, rule.channels ?? [], { deviceName: device.name, deviceIp: device.ip, alertType: incident.title, severity: incident.severity, timestamp: at.toISOString(), metricValue: String(event.value), incidentUrl: `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/incidents/${incident.id}`, incidentId: incident.id, event: phase, runbookUrl: rule.runbookUrl ?? undefined }, phase);
        return incident;
      });
      if (updated && cfg.onIncident) await cfg.onIncident(device.id, updated.id);
    }
  }, { connection: redis, concurrency: 5 });
  const pushMetricEvent = (event: MetricEvent) => metricQueue.add("evaluate", metricEventSchema.parse(event), { removeOnComplete: 100, removeOnFail: 50, attempts: 3, backoff: { type: "exponential", delay: 1000 } });
  const shutdown = async () => { await worker.close(); await metricQueue.close(); redis.disconnect(); await client.end(); };
  return { worker, pushMetricEvent, shutdown };
}
