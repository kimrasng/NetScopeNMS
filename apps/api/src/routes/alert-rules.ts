import { bodySchema } from "../services/contracts.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc, and, or, isNull, inArray, sql } from "drizzle-orm";
import { alertRules } from "@netpulse/shared";
import { authenticate, requireRole } from "../middleware/auth.js";
import { logAudit } from "./audit-logs.js";

const alertRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  deviceId: z.string().uuid().nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
  metricName: z.string().min(1),
  operator: z.enum([">", ">=", "<", "<=", "==", "!="]),
  threshold: z.number(),
  severity: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  channels: z.array(z.string().uuid()).default([]),
  flapThreshold: z.number().int().min(1).max(100).default(3),
  flapWindow: z.number().int().min(1).max(1440).default(5),
  escalationMinutes: z.number().int().min(1).max(10080).nullable().optional(),
  escalationChannels: z.array(z.string().uuid()).optional(),
  runbookUrl: z.string().url().nullable().optional(),
  enabled: z.boolean().default(true),
});

/**
 * Alert rule CRUD routes
 */
export async function alertRuleRoutes(app: FastifyInstance) {
  const ruleScope = (request: import("fastify").FastifyRequest) => request.userScope !== "restricted" ? sql`true` : and(or(isNull(alertRules.deviceId), request.userDeviceIds?.length ? inArray(alertRules.deviceId, request.userDeviceIds) : sql`false`), or(isNull(alertRules.groupId), request.userAllowedGroupIds?.length ? inArray(alertRules.groupId, request.userAllowedGroupIds) : sql`false`));
  app.get("/", { preHandler: [authenticate] }, async request => {
    return app.db.select().from(alertRules).where(ruleScope(request)).orderBy(desc(alertRules.createdAt));
  });

  app.get("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const rule = await app.db.query.alertRules.findFirst({ where: and(eq(alertRules.id, id), ruleScope(request)) });
    if (!rule) return reply.code(404).send({ error: "Alert rule not found" });
    return rule;
  });

  app.post("/", { schema: bodySchema(alertRuleSchema), preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const body = alertRuleSchema.parse(request.body);
    const [rule] = await app.db.insert(alertRules).values(body).returning();
    await logAudit(app.db, { userId: request.userId, action: "alert-rule.create", resource: "alert-rule", resourceId: rule.id, details: body, ipAddress: request.ip }, request);
    return reply.code(201).send(rule);
  });

  app.put("/:id", { schema: bodySchema(alertRuleSchema.partial()), preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = alertRuleSchema.partial().parse(request.body);
    const [rule] = await app.db.update(alertRules)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(alertRules.id, id))
      .returning();
    if (!rule) return reply.code(404).send({ error: "Alert rule not found" });
    await logAudit(app.db, { userId: request.userId, action: "alert-rule.update", resource: "alert-rule", resourceId: id, details: body, ipAddress: request.ip }, request);
    return rule;
  });

  app.delete("/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [rule] = await app.db.delete(alertRules).where(eq(alertRules.id, id)).returning();
    if (!rule) return reply.code(404).send({ error: "Alert rule not found" });
    await logAudit(app.db, { userId: request.userId, action: "alert-rule.delete", resource: "alert-rule", resourceId: id, ipAddress: request.ip }, request);
    return { message: "Alert rule deleted" };
  });
}
