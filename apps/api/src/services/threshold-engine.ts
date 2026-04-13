import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import { createDb, alertRules, incidents, incidentEvents, devices } from "@netpulse/shared";
import { eq, and, ne } from "drizzle-orm";

export interface ThresholdEngineConfig {
  redisUrl: string;
  databaseUrl: string;
}

interface MetricEvent {
  deviceId: string;
  metricName: string;
  value: number;
  timestamp: string;
}

// Track flap state per device+metric
const flapCounters = new Map<string, { count: number; timestamps: number[] }>();

/**
 * Evaluate a threshold condition.
 */
function evaluateCondition(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case ">": return value > threshold;
    case ">=": return value >= threshold;
    case "<": return value < threshold;
    case "<=": return value <= threshold;
    case "==": return value === threshold;
    case "!=": return value !== threshold;
    default: return false;
  }
}

/**
 * Check flap detection: must fail N out of M recent checks.
 */
function checkFlap(key: string, triggered: boolean, flapThreshold: number, flapWindow: number): boolean {
  const now = Date.now();
  let state = flapCounters.get(key);
  if (!state) {
    state = { count: 0, timestamps: [] };
    flapCounters.set(key, state);
  }

  // Keep only timestamps within the window
  state.timestamps = state.timestamps.filter((t) => now - t < flapWindow * 60000);

  if (triggered) {
    state.timestamps.push(now);
    state.count = state.timestamps.length;
  }

  return state.count >= flapThreshold;
}

/**
 * Start the threshold evaluation engine.
 * Listens for metric events on a BullMQ queue and evaluates alert rules.
 */
export function startThresholdEngine(cfg: ThresholdEngineConfig) {
  const redis = new IORedis(cfg.redisUrl, { maxRetriesPerRequest: null });
  const { db } = createDb(cfg.databaseUrl);

  const metricQueue = new Queue("metric-events", { connection: redis });

  const worker = new Worker("metric-events", async (job) => {
    const event: MetricEvent = job.data;

    // Find matching alert rules (global rules or device-specific)
    const rules = await db.select().from(alertRules).where(
      and(
        eq(alertRules.metricName, event.metricName),
        eq(alertRules.enabled, true)
      )
    );

    for (const rule of rules) {
      // Skip if rule is device-specific and doesn't match
      if (rule.deviceId && rule.deviceId !== event.deviceId) continue;

      const triggered = evaluateCondition(event.value, rule.operator, rule.threshold);
      const flapKey = `${event.deviceId}:${rule.id}`;
      const flapPassed = checkFlap(flapKey, triggered, rule.flapThreshold || 3, rule.flapWindow || 5);

      if (flapPassed) {
        // Check if there's already an active incident for this device+rule
        const existing = await db.select().from(incidents).where(
          and(
            eq(incidents.deviceId, event.deviceId),
            eq(incidents.ruleId, rule.id),
            ne(incidents.status, "resolved")
          )
        ).limit(1);

        if (existing.length === 0) {
          // Create new incident
          const device = await db.select().from(devices).where(eq(devices.id, event.deviceId)).limit(1);
          const deviceName = device[0]?.name || event.deviceId;

          const [incident] = await db.insert(incidents).values({
            deviceId: event.deviceId,
            ruleId: rule.id,
            severity: rule.severity,
            status: "problem",
            title: `${rule.name}: ${event.metricName} ${rule.operator} ${rule.threshold} on ${deviceName}`,
            metricName: event.metricName,
            metricValue: event.value,
          }).returning();

          // Create initial event
          await db.insert(incidentEvents).values({
            incidentId: incident.id,
            type: "created",
            message: `Alert triggered: ${event.metricName} = ${event.value} (threshold: ${rule.operator} ${rule.threshold})`,
          });

          console.log(`[INCIDENT] Created: ${incident.title} (${incident.severity})`);

          // Reset flap counter
          flapCounters.delete(flapKey);
        }
      }
    }

    // Auto-resolve: check if any active incidents for this device+metric should be resolved
    const activeIncidents = await db.select({ incident: incidents, rule: alertRules })
      .from(incidents)
      .leftJoin(alertRules, eq(incidents.ruleId, alertRules.id))
      .where(
        and(
          eq(incidents.deviceId, event.deviceId),
          eq(incidents.metricName, event.metricName),
          ne(incidents.status, "resolved")
        )
      );

    for (const { incident, rule } of activeIncidents) {
      if (rule && !evaluateCondition(event.value, rule.operator, rule.threshold)) {
        // Condition no longer met, auto-resolve
        await db.update(incidents)
          .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
          .where(eq(incidents.id, incident.id));

        await db.insert(incidentEvents).values({
          incidentId: incident.id,
          type: "resolved",
          message: `Auto-resolved: ${event.metricName} = ${event.value} (back to normal)`,
        });

        console.log(`[RESOLVED] Auto-resolved: ${incident.title}`);
      }
    }
  }, { connection: redis, concurrency: 5 });

  /**
   * Push a metric event for threshold evaluation.
   */
  async function pushMetricEvent(event: MetricEvent) {
    await metricQueue.add("evaluate", event, {
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  async function shutdown() {
    console.log("Threshold engine shutting down...");
    await worker.close();
    await metricQueue.close();
    redis.disconnect();
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return { worker, pushMetricEvent, shutdown };
}
