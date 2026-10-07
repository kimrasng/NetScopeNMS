import { bodySchema } from "../services/contracts.js";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { eq, desc, sql, and, inArray, getTableColumns } from "drizzle-orm";
import { reports, devices, users } from "@netpulse/shared";
import { authenticate } from "../middleware/auth.js";
import { deviceScope } from "../services/access.js";
import { pagination, pageResult } from "../services/validation.js";
import { getDefaultEngine } from "../services/ai.js";

export const generateReportSchema = z.object({
  type: z.enum(["availability", "performance", "alert_summary", "ai_narrative"]),
  period: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
  deviceIds: z.array(z.string().uuid()).optional(), groupId: z.string().uuid().optional(),
});
const periodDays = { daily: 1, weekly: 7, monthly: 30 };
function reportScope(request: FastifyRequest) {
  return request.userDeviceIds === null ? sql`true` : and(eq(reports.generatedBy, request.userId!),
    sql`${reports.content}->'deviceIds' <@ ${JSON.stringify(request.userDeviceIds ?? [])}::jsonb`);
}
export async function reportRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const { page, limit, offset } = pagination(request.query);
    const query = z.object({ type: z.string().optional() }).parse(request.query);
    const where = and(reportScope(request), query.type ? eq(reports.type, query.type) : undefined);
    const [data, [count]] = await Promise.all([
      app.db.select({ ...getTableColumns(reports), generatedByName: users.name }).from(reports).leftJoin(users, eq(reports.generatedBy, users.id)).where(where).orderBy(desc(reports.generatedAt)).limit(limit).offset(offset),
      app.db.select({ total: sql<number>`count(*)` }).from(reports).where(where),
    ]);
    return pageResult(data, page, limit, Number(count.total));
  });
  app.get("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [report] = await app.db.select().from(reports).where(and(eq(reports.id, id), reportScope(request))).limit(1);
    if (!report) return reply.code(404).send({ error: "Report not found" });
    return report;
  });
  app.post("/generate", { schema: bodySchema(generateReportSchema), preHandler: [authenticate] }, async (request, reply) => {
    const body = generateReportSchema.parse(request.body);
    const selected = await app.db.select({ id: devices.id }).from(devices).where(and(deviceScope(request, devices.id),
      body.groupId ? eq(devices.groupId, body.groupId) : undefined,
      body.deviceIds ? body.deviceIds.length ? inArray(devices.id, body.deviceIds) : sql`false` : undefined));
    const ids = selected.map(d => d.id);
    const include = ids.length ? inArray(sql`d.id`, ids) : sql`false`;
    const days = periodDays[body.period];
    const availability = await app.db.execute(sql`
      SELECT d.id, d.name, d.ip, count(m.value) AS samples,
        COUNT(*) FILTER (WHERE m.value = 1) * 100.0 / NULLIF(COUNT(m.value), 0) AS uptime_pct
      FROM devices d LEFT JOIN metrics m ON m.device_id = d.id AND m.metric_name = 'ping'
        AND m.timestamp >= NOW() - make_interval(days => ${days})
      WHERE ${include} GROUP BY d.id, d.name, d.ip ORDER BY uptime_pct ASC NULLS LAST
    `);
    let content: Record<string, unknown> = { deviceIds: ids, periodDays: days };
    let aiSummary: string | undefined;
    if (body.type === "availability") content.availability = availability;
    else if (body.type === "performance") content.performance = await app.db.execute(sql`
      SELECT d.id, d.name, d.ip, m.metric_name, AVG(m.value) AS avg_val, MAX(m.value) AS max_val, MIN(m.value) AS min_val
      FROM metrics m JOIN devices d ON d.id = m.device_id
      WHERE ${include} AND m.timestamp >= NOW() - make_interval(days => ${days})
        AND m.metric_name IN ('cpu', 'memory', 'bandwidth_in', 'bandwidth_out')
      GROUP BY d.id, d.name, d.ip, m.metric_name ORDER BY d.name, m.metric_name
    `);
    else {
      const alertSummary = await app.db.execute(sql`
        SELECT i.severity, COUNT(*) AS total, COUNT(*) FILTER (WHERE i.status = 'resolved') AS resolved,
          AVG(EXTRACT(EPOCH FROM (COALESCE(i.resolved_at, NOW()) - i.started_at))) AS avg_mttr_seconds
        FROM incidents i JOIN devices d ON d.id = i.device_id
        WHERE ${include} AND i.started_at >= NOW() - make_interval(days => ${days}) GROUP BY i.severity ORDER BY i.severity
      `);
      content.alertSummary = alertSummary;
      if (body.type === "ai_narrative") {
        const engine = await getDefaultEngine(app);
        aiSummary = await engine.chat([
          { role: "system", content: "Write a network health report using only the supplied observations. Identify missing data; never invent SLA or historical availability." },
          { role: "user", content: JSON.stringify({ period: body.period, availability, alertSummary }) },
        ]);
        if (!aiSummary.trim()) return reply.code(502).send({ error: "AI returned an empty narrative" });
        content = { ...content, availability, narrative: aiSummary };
      }
    }
    const [report] = await app.db.insert(reports).values({ type: body.type, title: `${body.type.replaceAll("_", " ")} Report - ${body.period}`, period: body.period, content, aiSummary, generatedBy: request.userId }).returning();
    return reply.code(201).send(report);
  });
}
