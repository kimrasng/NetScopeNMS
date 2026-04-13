import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { reports } from "@netpulse/shared";
import { authenticate } from "../middleware/auth.js";
import { config } from "../config.js";

const generateReportSchema = z.object({
  type: z.enum(["availability", "performance", "alert_summary", "ai_narrative"]),
  period: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
  deviceIds: z.array(z.string().uuid()).optional(),
  groupId: z.string().uuid().optional(),
});

/**
 * Report generation and listing routes
 */
const PERIOD_INTERVALS: Record<string, string> = {
  daily: "1 day",
  weekly: "7 days",
  monthly: "30 days",
};

export async function reportRoutes(app: FastifyInstance) {
  // List reports
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as { type?: string; page?: string; limit?: string };
    const page = parseInt(query.page || "1", 10);
    const limit = Math.min(parseInt(query.limit || "20", 10), 100);
    const offset = (page - 1) * limit;

    const where = query.type ? eq(reports.type, query.type) : undefined;
    return app.db.select().from(reports).where(where)
      .orderBy(desc(reports.generatedAt)).limit(limit).offset(offset);
  });

  // Get single report
  app.get("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const report = await app.db.query.reports.findFirst({ where: eq(reports.id, id) });
    if (!report) return reply.code(404).send({ error: "Report not found" });
    return report;
  });

  // Generate report
  app.post("/generate", { preHandler: [authenticate] }, async (request, reply) => {
    const body = generateReportSchema.parse(request.body);
    const periodInterval = PERIOD_INTERVALS[body.period];

    let content: Record<string, unknown> = {};
    let aiSummary: string | undefined;

    if (body.type === "availability") {
      const result = await app.db.execute(sql`
        SELECT d.id, d.name, d.ip,
          COUNT(*) FILTER (WHERE d.status = 'up') * 100.0 / GREATEST(COUNT(*), 1) AS uptime_pct
        FROM devices d
        LEFT JOIN metrics m ON m.device_id = d.id AND m.metric_name = 'ping'
          AND m.timestamp >= NOW() - ${sql.raw(`'${periodInterval}'::interval`)}
        GROUP BY d.id, d.name, d.ip
        ORDER BY uptime_pct ASC
      `);
      content = { availability: result };
    } else if (body.type === "performance") {
      const result = await app.db.execute(sql`
        SELECT d.name, d.ip, m.metric_name,
          AVG(m.value) AS avg_val, MAX(m.value) AS max_val, MIN(m.value) AS min_val
        FROM metrics m
        JOIN devices d ON d.id = m.device_id
        WHERE m.timestamp >= NOW() - ${sql.raw(`'${periodInterval}'::interval`)}
          AND m.metric_name IN ('cpu', 'memory', 'bandwidth_in', 'bandwidth_out')
        GROUP BY d.name, d.ip, m.metric_name
        ORDER BY d.name, m.metric_name
      `);
      content = { performance: result };
    } else if (body.type === "alert_summary") {
      const result = await app.db.execute(sql`
        SELECT
          severity,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
          AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - started_at))) AS avg_mttr_seconds
        FROM incidents
        WHERE started_at >= NOW() - ${sql.raw(`'${periodInterval}'::interval`)}
        GROUP BY severity
        ORDER BY severity
      `);
      content = { alertSummary: result };
    }

    // AI narrative generation
    if (body.type === "ai_narrative" && config.anthropicApiKey) {
      try {
        const summaryData = await app.db.execute(sql`
          SELECT
            (SELECT COUNT(*) FROM incidents WHERE started_at >= NOW() - ${sql.raw(`'${periodInterval}'::interval`)}) AS total_incidents,
            (SELECT COUNT(*) FROM incidents WHERE severity = 'critical' AND started_at >= NOW() - ${sql.raw(`'${periodInterval}'::interval`)}) AS critical_incidents,
            (SELECT COUNT(DISTINCT device_id) FROM incidents WHERE started_at >= NOW() - ${sql.raw(`'${periodInterval}'::interval`)}) AS affected_devices,
            (SELECT COUNT(*) FROM devices WHERE status = 'up') AS devices_up,
            (SELECT COUNT(*) FROM devices) AS total_devices
        `);

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.anthropicApiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 3000,
            messages: [{
              role: "user",
              content: `Generate a ${body.period} network health report narrative based on this data:
${JSON.stringify(summaryData, null, 2)}
Include: executive summary, top issues, availability SLA, unusual patterns, and recommendations.
Write in a professional tone suitable for IT management.`,
            }],
          }),
        });
        const aiResult = await response.json() as any;
        aiSummary = aiResult.content?.[0]?.text;
        content = { ...content, narrative: aiSummary };
      } catch (err) {
        app.log.error(err, "AI report generation failed");
      }
    }

    const [report] = await app.db.insert(reports).values({
      type: body.type,
      title: `${body.type.replace("_", " ")} Report - ${body.period}`,
      period: body.period,
      content,
      aiSummary,
      generatedBy: request.userId!,
    }).returning();

    return reply.code(201).send(report);
  });
}
