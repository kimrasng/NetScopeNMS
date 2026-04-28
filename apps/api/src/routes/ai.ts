import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, sql, desc } from "drizzle-orm";
import { incidents, aiProviders } from "@netpulse/shared";
import { AIEngine, type AIProviderConfig } from "@netpulse/ai-engine";
import { authenticate, requireRole } from "../middleware/auth.js";

const querySchema = z.object({ query: z.string().min(1).max(1000) });
const chatSchema = z.object({ message: z.string().min(1).max(2000), incidentId: z.string().uuid() });

const SQL_DANGEROUS_PATTERN = /;|--|\/\*|\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b/i;

/** Validate AI-generated SQL is a safe read-only SELECT */
function sanitizeSQL(rawSql: string): string {
  const trimmed = rawSql.trim();
  if (!trimmed.toUpperCase().startsWith("SELECT")) {
    throw new Error("Only SELECT statements are allowed");
  }
  if (SQL_DANGEROUS_PATTERN.test(trimmed)) {
    throw new Error("SQL contains disallowed keywords or characters");
  }
  return trimmed;
}

/** Get the default AI engine from DB, or null if none configured */
async function getDefaultEngine(app: FastifyInstance): Promise<AIEngine | null> {
  // Try default provider first, then any enabled provider
  let provider = await app.db.query.aiProviders.findFirst({
    where: eq(aiProviders.isDefault, true),
  });
  if (!provider || !provider.enabled) {
    provider = await app.db.query.aiProviders.findFirst({
      where: eq(aiProviders.enabled, true),
    });
  }
  if (!provider) return null;

  const config: AIProviderConfig = {
    type: provider.type as any,
    apiKey: provider.apiKey,
    model: provider.model || undefined,
    baseUrl: provider.baseUrl || undefined,
    enabled: provider.enabled,
  };
  return new AIEngine(config);
}

/**
 * AI routes: query, chat, RCA - now using multi-provider ai-engine
 */
export async function aiRoutes(app: FastifyInstance) {
  // Natural language query
  app.post("/query", { preHandler: [authenticate] }, async (request, reply) => {
    const { query } = querySchema.parse(request.body);
    const engine = await getDefaultEngine(app);
    if (!engine) return reply.code(503).send({ error: "No AI provider configured. Add one in Settings > AI." });

    try {
      const dbSchema = `Tables: devices(id,name,ip,type,status,location,tags), metrics(device_id,metric_name,value,timestamp), incidents(id,device_id,severity,status,title,started_at,resolved_at), interfaces(id,device_id,name,speed,status,in_bps,out_bps)`;
      const result = await engine.naturalLanguageQuery(query, dbSchema);

      if (result.type === "sql" && result.sql) {
        let validatedSql: string;
        try {
          validatedSql = sanitizeSQL(result.sql);
        } catch {
          return { type: "answer", answer: "Only safe read queries are allowed.", explanation: result.explanation };
        }
        const data = await app.db.execute(sql.raw(validatedSql));
        return { type: "data", data, explanation: result.explanation, sql: validatedSql };
      }
      return result;
    } catch (err: any) {
      app.log.error(err, "AI query failed");
      return reply.code(500).send({ error: `AI query failed: ${err.message}` });
    }
  });

  // Incident AI chat
  app.post("/chat", { preHandler: [authenticate] }, async (request, reply) => {
    const { message, incidentId } = chatSchema.parse(request.body);
    const engine = await getDefaultEngine(app);
    if (!engine) return reply.code(503).send({ error: "No AI provider configured" });

    const incident = await app.db.query.incidents.findFirst({
      where: eq(incidents.id, incidentId),
      with: { device: true, events: { orderBy: (e: any, { desc }: any) => [desc(e.createdAt)], limit: 20 } },
    });
    if (!incident) return reply.code(404).send({ error: "Incident not found" });

    const recentMetrics = await app.db.execute(sql`
      SELECT metric_name, value, timestamp FROM metrics
      WHERE device_id = ${incident.deviceId} AND timestamp >= NOW() - INTERVAL '60 minutes'
      ORDER BY timestamp DESC LIMIT 50
    `);

    try {
      const response = await engine.chat([
        {
          role: "system",
          content: `You are a network incident analysis assistant.
Incident: ${JSON.stringify({ title: incident.title, severity: incident.severity, status: incident.status, metric: incident.metricName, value: incident.metricValue })}
Device: ${JSON.stringify({ name: (incident as any).device?.name, ip: (incident as any).device?.ip, type: (incident as any).device?.type })}
Recent metrics: ${JSON.stringify(recentMetrics)}
Events: ${JSON.stringify((incident as any).events?.map((e: any) => ({ type: e.type, message: e.message, at: e.createdAt })))}
Provide concise, actionable answers.`,
        },
        { role: "user", content: message },
      ]);
      return { response };
    } catch (err: any) {
      app.log.error(err, "AI chat failed");
      return reply.code(500).send({ error: `AI chat failed: ${err.message}` });
    }
  });

  // Generate RCA
  app.post("/rca/:incidentId", { preHandler: [authenticate] }, async (request, reply) => {
    const { incidentId } = request.params as { incidentId: string };
    const engine = await getDefaultEngine(app);
    if (!engine) return reply.code(503).send({ error: "No AI provider configured" });

    const incident = await app.db.query.incidents.findFirst({
      where: eq(incidents.id, incidentId),
      with: { device: true },
    });
    if (!incident) return reply.code(404).send({ error: "Incident not found" });

    const recentMetrics = await app.db.execute(sql`
      SELECT metric_name, AVG(value) as avg_val, MAX(value) as max_val, MIN(value) as min_val,
             time_bucket('5 minutes', timestamp) AS bucket
      FROM metrics WHERE device_id = ${incident.deviceId} AND timestamp >= NOW() - INTERVAL '60 minutes'
      GROUP BY metric_name, bucket ORDER BY bucket DESC
    `);

    const similarIncidents = await app.db.select().from(incidents)
      .where(eq(incidents.deviceId, incident.deviceId))
      .orderBy(desc(incidents.startedAt)).limit(5);

    try {
      const rca = await engine.generateRCA({
        incident: {
          title: incident.title,
          severity: incident.severity,
          metricName: incident.metricName || undefined,
          metricValue: incident.metricValue ? Number(incident.metricValue) : undefined,
          startedAt: incident.startedAt.toISOString(),
        },
        device: {
          name: (incident as any).device?.name || "Unknown",
          ip: (incident as any).device?.ip || "",
          type: (incident as any).device?.type || "",
          location: (incident as any).device?.location || undefined,
        },
        recentMetrics: (recentMetrics as any[]).map((r: any) => ({
          time: r.bucket, metricName: r.metric_name, value: Number(r.avg_val),
        })),
        similarIncidents: similarIncidents.map((i) => ({
          title: i.title, resolution: i.aiSummary || undefined,
        })),
      });

      // Persist RCA
      await app.db.update(incidents)
        .set({ aiRca: JSON.stringify(rca), aiSummary: rca.summary, updatedAt: new Date() })
        .where(eq(incidents.id, incidentId));

      // Emit via WebSocket
      if ((app as any).io) {
        (app as any).io.emit("incident:updated", { id: incidentId, aiRca: rca });
      }

      return { rca };
    } catch (err: any) {
      app.log.error(err, "RCA generation failed");
      return reply.code(500).send({ error: `RCA generation failed: ${err.message}` });
    }
  });

  // ─── AI Provider Management ────────────────────────

  const providerSchema = z.object({
    name: z.string().min(1),
    type: z.enum(["openai", "gemini", "claude", "custom"]),
    apiKey: z.string().min(1),
    model: z.string().optional(),
    baseUrl: z.string().optional(),
    enabled: z.boolean().default(true),
    isDefault: z.boolean().default(false),
  });

  // List providers
  app.get("/providers", { preHandler: [authenticate] }, async () => {
    const providers = await app.db.select({
      id: aiProviders.id, name: aiProviders.name, type: aiProviders.type,
      model: aiProviders.model, baseUrl: aiProviders.baseUrl,
      enabled: aiProviders.enabled, isDefault: aiProviders.isDefault,
      createdAt: aiProviders.createdAt,
    }).from(aiProviders).orderBy(aiProviders.createdAt);
    return providers; // apiKey excluded for security
  });

  // Add provider
  app.post("/providers", { preHandler: [requireRole("super_admin", "admin")] }, async (request: any, reply: any) => {
    const body = providerSchema.parse(request.body);

    // If setting as default, unset others
    if (body.isDefault) {
      await app.db.update(aiProviders).set({ isDefault: false });
    }

    const [provider] = await app.db.insert(aiProviders).values(body as any).returning();
    return reply.code(201).send(provider);
  });

  // Update provider
  app.put("/providers/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request: any) => {
    const { id } = request.params as { id: string };
    const body = providerSchema.partial().parse(request.body);

    if (body.isDefault) {
      await app.db.update(aiProviders).set({ isDefault: false });
    }

    await app.db.update(aiProviders).set({ ...body, updatedAt: new Date() } as any).where(eq(aiProviders.id, id));
    return { ok: true };
  });

  // Delete provider
  app.delete("/providers/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request: any) => {
    const { id } = request.params as { id: string };
    await app.db.delete(aiProviders).where(eq(aiProviders.id, id));
    return { ok: true };
  });

  // Test provider connection
  app.post("/providers/:id/test", { preHandler: [requireRole("super_admin", "admin")] }, async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const provider = await app.db.query.aiProviders.findFirst({ where: eq(aiProviders.id, id) });
    if (!provider) return reply.code(404).send({ error: "Provider not found" });

    const engine = new AIEngine({
      type: provider.type as any,
      apiKey: provider.apiKey,
      model: provider.model || undefined,
      baseUrl: provider.baseUrl || undefined,
      enabled: true,
    });

    const result = await engine.testConnection();
    return result;
  });
}
