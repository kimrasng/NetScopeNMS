import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { authenticate } from "../middleware/auth.js";

const ALLOWED_BUCKETS = ["1 minute", "5 minutes", "15 minutes", "30 minutes", "1 hour", "6 hours", "1 day"] as const;

export async function metricsRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const query = request.query as {
      deviceId: string; metric: string;
      from?: string; to?: string; bucket?: string;
    };

    if (!query.deviceId || !query.metric) {
      return reply.code(400).send({ error: "deviceId and metric are required" });
    }

    const from = query.from ? new Date(query.from) : new Date(Date.now() - 3600000);
    const to = query.to ? new Date(query.to) : new Date();
    const bucket = query.bucket || "1 minute";

    if (!ALLOWED_BUCKETS.includes(bucket as any)) {
      return reply.code(400).send({ error: `Invalid bucket. Allowed values: ${ALLOWED_BUCKETS.join(", ")}` });
    }

    const result = await app.db.execute(sql`
      SELECT
        time_bucket(${sql.raw(`'${bucket}'::interval`)}, timestamp) AS time,
        AVG(value) AS avg_value,
        MAX(value) AS max_value,
        MIN(value) AS min_value
      FROM metrics
      WHERE device_id = ${query.deviceId}
        AND metric_name = ${query.metric}
        AND timestamp >= ${from.toISOString()}::timestamptz
        AND timestamp <= ${to.toISOString()}::timestamptz
      GROUP BY time
      ORDER BY time ASC
    `);

    return { data: result, meta: { deviceId: query.deviceId, metric: query.metric, from, to, bucket } };
  });

  // Anomaly detection: values outside 2σ from 7-day rolling average
  app.get("/anomalies", { preHandler: [authenticate] }, async (request, reply) => {
    const query = request.query as { deviceId: string; metric: string; hours?: string };
    if (!query.deviceId || !query.metric) {
      return reply.code(400).send({ error: "deviceId and metric are required" });
    }
    const hours = parseInt(query.hours || "24", 10);

    const result = await app.db.execute(sql`
      WITH stats AS (
        SELECT
          AVG(value) AS mean,
          STDDEV(value) AS stddev
        FROM metrics
        WHERE device_id = ${query.deviceId}
          AND metric_name = ${query.metric}
          AND timestamp >= NOW() - INTERVAL '7 days'
      ),
      recent AS (
        SELECT value, timestamp
        FROM metrics
        WHERE device_id = ${query.deviceId}
          AND metric_name = ${query.metric}
          AND timestamp >= NOW() - make_interval(hours => ${hours})
        ORDER BY timestamp ASC
      )
      SELECT r.value, r.timestamp, s.mean, s.stddev,
        CASE WHEN ABS(r.value - s.mean) > 2 * s.stddev THEN true ELSE false END AS is_anomaly
      FROM recent r, stats s
    `);

    return { data: result };
  });

  // Prediction: linear trend extrapolation
  app.get("/predict", { preHandler: [authenticate] }, async (request, reply) => {
    const query = request.query as { deviceId: string; metric: string; threshold?: string };
    if (!query.deviceId || !query.metric) {
      return reply.code(400).send({ error: "deviceId and metric are required" });
    }

    const result = await app.db.execute(sql`
      WITH trend AS (
        SELECT
          EXTRACT(EPOCH FROM timestamp) AS ts,
          value
        FROM metrics
        WHERE device_id = ${query.deviceId}
          AND metric_name = ${query.metric}
          AND timestamp >= NOW() - INTERVAL '7 days'
      ),
      regression AS (
        SELECT
          regr_slope(value, ts) AS slope,
          regr_intercept(value, ts) AS intercept,
          AVG(value) AS current_avg
        FROM trend
      )
      SELECT slope, intercept, current_avg,
        CASE
          WHEN slope > 0 AND ${query.threshold || "100"}::float > current_avg THEN
            ((${query.threshold || "100"}::float - intercept) / NULLIF(slope, 0)) - EXTRACT(EPOCH FROM NOW())
          ELSE NULL
        END AS seconds_until_threshold
      FROM regression
    `);

    const row = (result as any[])[0];
    if (row?.seconds_until_threshold && row.seconds_until_threshold > 0) {
      const days = Math.round(row.seconds_until_threshold / 86400 * 10) / 10;
      return { prediction: { daysUntilThreshold: days, slope: row.slope, currentAvg: row.current_avg } };
    }
    return { prediction: null, message: "No threshold breach predicted" };
  });
}
