import { bodySchema } from "../services/contracts.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { incidents, aiProviders } from "@netpulse/shared";
import { AIEngine } from "@netpulse/ai-engine";
import { HttpError } from "../services/access.js";
import { getDefaultEngine, executeReadQuery, generateIncidentRca } from "../services/ai.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const querySchema = z.object({ query: z.string().min(1).max(1000) });
const chatSchema = z.object({ message: z.string().min(1).max(2000), incidentId: z.string().uuid() });

/**
 * AI routes: query, chat, RCA - now using multi-provider ai-engine
 */
export async function aiRoutes(app: FastifyInstance) {
  // Natural language query
  app.post("/query", { schema: bodySchema(querySchema), preHandler: [authenticate] }, async (request, reply) => {
    const { query } = querySchema.parse(request.body);
    const engine = await getDefaultEngine(app);
    if (!engine) return reply.code(503).send({ error: "No AI provider configured. Add one in Settings > AI." });

    try {
      const dbSchema = `Tables: devices(id,name,ip,type,status,location,tags), metrics(device_id,metric_name,value,timestamp), incidents(id,device_id,severity,status,title,started_at,resolved_at), interfaces(id,device_id,name,speed,status,in_bps,out_bps)`;
      const result = await engine.naturalLanguageQuery(query, dbSchema);

      if (result.type === "sql" && result.sql) {
        const data = await executeReadQuery(request, result.sql);
        return { type: "data", data, columns: data.length ? Object.keys(data[0]) : [], explanation: result.explanation, sql: result.sql };
      }
      return result;
    } catch (err) {
      if (err instanceof HttpError) throw err;
      app.log.error(err, "AI query failed");
      return reply.code(500).send({ error: `AI query failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  });

  // Incident AI chat
  app.post("/chat", { schema: bodySchema(chatSchema), preHandler: [authenticate] }, async (request, reply) => {
    const { message, incidentId } = chatSchema.parse(request.body);
    const engine = await getDefaultEngine(app);
    if (!engine) return reply.code(503).send({ error: "No AI provider configured" });

    const incident = await app.db.query.incidents.findFirst({
      where: eq(incidents.id, incidentId),
      with: { device: true, events: { orderBy: (e, { desc }) => [desc(e.createdAt)], limit: 20 } },
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
Device: ${JSON.stringify({ name: incident.device?.name, ip: incident.device?.ip, type: incident.device?.type })}
Recent metrics: ${JSON.stringify(recentMetrics)}
Events: ${JSON.stringify(incident.events?.map((e) => ({ type: e.type, message: e.message, at: e.createdAt })))}
Provide concise, actionable answers.`,
        },
        { role: "user", content: message },
      ]);
      return { response };
    } catch (err) {
      app.log.error(err, "AI chat failed");
      return reply.code(500).send({ error: `AI chat failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  });

  app.post("/rca/:incidentId", { preHandler: [requireRole("super_admin", "admin", "operator")] }, async (request) => {
    const { incidentId } = request.params as { incidentId: string };
    return { rca: (await generateIncidentRca(request, incidentId)).rca };
  });

  // ─── AI Provider Management ────────────────────────

  const providerSchema = z.object({
    name: z.string().min(1),
    type: z.enum(["openai", "gemini", "claude", "custom"]),
    apiKey: z.string().min(1),
    model: z.string().optional(),
    baseUrl: z.string().url().optional(),
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
  app.post("/providers", { schema: bodySchema(providerSchema), preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const body = providerSchema.parse(request.body);

    // If setting as default, unset others
    if (body.isDefault) {
      await app.db.update(aiProviders).set({ isDefault: false });
    }

    const [provider] = await app.db.insert(aiProviders).values(body).returning();
    return reply.code(201).send(provider);
  });

  // Update provider
  app.put("/providers/:id", { schema: bodySchema(providerSchema.partial()), preHandler: [requireRole("super_admin", "admin")] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = providerSchema.partial().parse(request.body);

    if (body.isDefault) {
      await app.db.update(aiProviders).set({ isDefault: false });
    }

    await app.db.update(aiProviders).set({ ...body, updatedAt: new Date() }).where(eq(aiProviders.id, id));
    return { ok: true };
  });

  // Delete provider
  app.delete("/providers/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request) => {
    const { id } = request.params as { id: string };
    await app.db.delete(aiProviders).where(eq(aiProviders.id, id));
    return { ok: true };
  });

  // Test provider connection
  app.post("/providers/:id/test", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const provider = await app.db.query.aiProviders.findFirst({ where: eq(aiProviders.id, id) });
    if (!provider) return reply.code(404).send({ error: "Provider not found" });

    const engine = new AIEngine({
      type: provider.type,
      apiKey: provider.apiKey,
      model: provider.model || undefined,
      baseUrl: provider.baseUrl || undefined,
      enabled: true,
    });

    const result = await engine.testConnection();
    return reply.code(result.ok ? 200 : 502).send(result);
  });
}
