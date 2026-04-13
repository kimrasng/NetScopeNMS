import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { alertRules } from "@netpulse/shared";
import { authenticate, requireRole } from "../middleware/auth.js";

const alertRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  deviceId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  metricName: z.string().min(1),
  operator: z.enum([">", ">=", "<", "<=", "==", "!="]),
  threshold: z.number(),
  severity: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  channels: z.array(z.string()).default([]),
  flapThreshold: z.number().int().default(3),
  flapWindow: z.number().int().default(5),
  escalationMinutes: z.number().int().optional(),
  escalationChannels: z.array(z.string()).optional(),
  runbookUrl: z.string().url().optional(),
  enabled: z.boolean().default(true),
});

/**
 * Alert rule CRUD routes
 */
export async function alertRuleRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async () => {
    return app.db.select().from(alertRules).orderBy(desc(alertRules.createdAt));
  });

  app.get("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const rule = await app.db.query.alertRules.findFirst({ where: eq(alertRules.id, id) });
    if (!rule) return reply.code(404).send({ error: "Alert rule not found" });
    return rule;
  });

  app.post("/", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const body = alertRuleSchema.parse(request.body);
    const [rule] = await app.db.insert(alertRules).values(body).returning();
    return reply.code(201).send(rule);
  });

  app.put("/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = alertRuleSchema.partial().parse(request.body);
    const [rule] = await app.db.update(alertRules)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(alertRules.id, id))
      .returning();
    if (!rule) return reply.code(404).send({ error: "Alert rule not found" });
    return rule;
  });

  app.delete("/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [rule] = await app.db.delete(alertRules).where(eq(alertRules.id, id)).returning();
    if (!rule) return reply.code(404).send({ error: "Alert rule not found" });
    return { message: "Alert rule deleted" };
  });
}
