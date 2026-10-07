import type { FastifyInstance } from "fastify";
import { sql, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { devices, incidents, metrics } from "@netpulse/shared";
import { authenticate } from "../middleware/auth.js";
import { deviceScope } from "../services/access.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/summary", { preHandler: [authenticate] }, async (request) => {
    const [deviceCounts] = await app.db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE status = 'up') AS up_count,
        COUNT(*) FILTER (WHERE status = 'down') AS down_count,
        COUNT(*) FILTER (WHERE status = 'warning') AS warning_count,
        COUNT(*) FILTER (WHERE status = 'unknown') AS unknown_count,
        COUNT(*) FILTER (WHERE status = 'maintenance') AS maintenance_count, COUNT(*) AS total
      FROM devices WHERE ${deviceScope(request, devices.id)}
    `);
    const [incidentCounts] = await app.db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE status = 'problem') AS problem_count,
        COUNT(*) FILTER (WHERE status = 'acknowledged') AS acknowledged_count,
        COUNT(*) FILTER (WHERE status = 'resolved' AND resolved_at >= NOW() - INTERVAL '24 hours') AS resolved_today,
        COUNT(*) FILTER (WHERE status != 'resolved') AS active_count
      FROM incidents WHERE ${deviceScope(request, incidents.deviceId)}
    `);
    return { devices: deviceCounts, incidents: incidentCounts };
  });
  app.get("/top-devices", { preHandler: [authenticate] }, async (request) => {
    const query = z.object({ metric: z.string().default("cpu"), limit: z.coerce.number().int().min(1).max(50).default(10) }).parse(request.query);
    const result = await app.db.execute(sql`
      SELECT DISTINCT ON (m.device_id) m.device_id, d.name, d.ip, d.type, d.status, m.metric_name, m.value, m.timestamp
      FROM metrics m JOIN devices d ON d.id = m.device_id
      WHERE m.metric_name = ${query.metric} AND m.timestamp >= NOW() - INTERVAL '10 minutes'
        AND ${deviceScope(request, sql`d.id`)}
      ORDER BY m.device_id, m.timestamp DESC
    `);
    return [...result].sort((a, b) => Number(b.value) - Number(a.value)).slice(0, query.limit);
  });
  app.get("/recent-alerts", { preHandler: [authenticate] }, async (request) => {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(request.query);
    return app.db.select({ incident: incidents, deviceName: devices.name, deviceIp: devices.ip }).from(incidents)
      .leftJoin(devices, eq(incidents.deviceId, devices.id)).where(deviceScope(request, incidents.deviceId))
      .orderBy(desc(incidents.startedAt)).limit(query.limit);
  });
  app.get("/throughput", { preHandler: [authenticate] }, async (request) => {
    const query = z.object({ hours: z.coerce.number().int().min(1).max(8760).default(6) }).parse(request.query);
    return app.db.execute(sql`
      SELECT time_bucket('5 minutes', timestamp) AS bucket,
        SUM(CASE WHEN metric_name = 'bandwidth_in' THEN value ELSE 0 END) AS total_in,
        SUM(CASE WHEN metric_name = 'bandwidth_out' THEN value ELSE 0 END) AS total_out
      FROM metrics WHERE metric_name IN ('bandwidth_in', 'bandwidth_out')
        AND timestamp >= NOW() - make_interval(hours => ${query.hours}) AND ${deviceScope(request, metrics.deviceId)}
      GROUP BY bucket ORDER BY bucket ASC
    `);
  });
}
