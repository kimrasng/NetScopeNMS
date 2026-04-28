import type { FastifyInstance } from "fastify";
import { sql, eq, desc } from "drizzle-orm";
import { devices, incidents } from "@netpulse/shared";
import { authenticate } from "../middleware/auth.js";

/**
 * Dashboard summary and widget data routes
 */
export async function dashboardRoutes(app: FastifyInstance) {
  // Overall summary
  app.get("/summary", { preHandler: [authenticate] }, async () => {
    const [deviceCounts] = await app.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'up') AS up_count,
        COUNT(*) FILTER (WHERE status = 'down') AS down_count,
        COUNT(*) FILTER (WHERE status = 'warning') AS warning_count,
        COUNT(*) FILTER (WHERE status = 'unknown') AS unknown_count,
        COUNT(*) FILTER (WHERE status = 'maintenance') AS maintenance_count,
        COUNT(*) AS total
      FROM devices
    `);

    const [incidentCounts] = await app.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'problem') AS problem_count,
        COUNT(*) FILTER (WHERE status = 'acknowledged') AS acknowledged_count,
        COUNT(*) FILTER (WHERE status = 'resolved' AND resolved_at >= NOW() - INTERVAL '24 hours') AS resolved_today,
        COUNT(*) FILTER (WHERE status != 'resolved') AS active_count
      FROM incidents
    `);

    return { devices: deviceCounts, incidents: incidentCounts };
  });

  // Top N devices by metric
  app.get("/top-devices", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as { metric?: string; limit?: string };
    const metric = query.metric || "cpu";
    const limit = Math.min(parseInt(query.limit || "10", 10), 50);

    const result = await app.db.execute(sql`
      SELECT DISTINCT ON (m.device_id)
        m.device_id, d.name, d.ip, d.type, d.status,
        m.metric_name, m.value, m.timestamp
      FROM metrics m
      JOIN devices d ON d.id = m.device_id
      WHERE m.metric_name = ${metric}
        AND m.timestamp >= NOW() - INTERVAL '10 minutes'
      ORDER BY m.device_id, m.timestamp DESC
    `);

    const sorted = (result as any[]).sort((a, b) => b.value - a.value).slice(0, limit);
    return sorted;
  });

  // Recent alerts feed
  app.get("/recent-alerts", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || "20", 10), 100);

    return app.db.select({
      incident: incidents,
      deviceName: devices.name,
      deviceIp: devices.ip,
    })
      .from(incidents)
      .leftJoin(devices, eq(incidents.deviceId, devices.id))
      .orderBy(desc(incidents.startedAt))
      .limit(limit);
  });

  // Aggregate throughput
  app.get("/throughput", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as { hours?: string };
    const hours = parseInt(query.hours || "6", 10);

    const result = await app.db.execute(sql`
      SELECT
        time_bucket('5 minutes', timestamp) AS bucket,
        SUM(CASE WHEN metric_name = 'bandwidth_in' THEN value ELSE 0 END) AS total_in,
        SUM(CASE WHEN metric_name = 'bandwidth_out' THEN value ELSE 0 END) AS total_out
      FROM metrics
      WHERE metric_name IN ('bandwidth_in', 'bandwidth_out')
        AND timestamp >= NOW() - make_interval(hours => ${hours})
      GROUP BY bucket
      ORDER BY bucket ASC
    `);
    return result;
  });
}
