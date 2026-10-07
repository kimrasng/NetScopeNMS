import { bodySchema } from "../services/contracts.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { notificationChannels, notifications, incidents } from "@netpulse/shared";
import { authenticate, requireRole } from "../middleware/auth.js";
import { pagination, pageResult } from "../services/validation.js";
import { deviceScope } from "../services/access.js";
import { deliverRecord } from "../services/delivery.js";
import { notificationTransportSchema } from "@netpulse/notification";

const channelSchema = z.object({ name: z.string().min(1), type: z.enum(["email", "telegram", "discord", "slack", "sms", "pagerduty", "webhook", "in_app"]), config: z.record(z.unknown()), enabled: z.boolean().default(true) });
function mergeConfiguration(existing: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === "[REDACTED]") continue;
    merged[key] = value && typeof value === "object" && !Array.isArray(value) ? mergeConfiguration(z.record(z.unknown()).parse(existing[key] ?? {}), z.record(z.unknown()).parse(value)) : value;
  }
  return merged;
}
export async function notificationRoutes(app: FastifyInstance) {
  app.get("/channels", { preHandler: [authenticate] }, async () => app.db.select().from(notificationChannels).orderBy(notificationChannels.name));
  app.post("/channels", { schema: bodySchema(channelSchema), preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const body = channelSchema.parse(request.body);
    notificationTransportSchema.parse(body);
    const [channel] = await app.db.insert(notificationChannels).values(body).returning();
    return reply.code(201).send(channel);
  });
  app.put("/channels/:id", { schema: bodySchema(channelSchema.partial()), preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await app.db.query.notificationChannels.findFirst({ where: eq(notificationChannels.id, id) });
    if (!existing) return reply.code(404).send({ error: "Channel not found" });
    const body = channelSchema.partial().parse(request.body);
    const config = body.config ? mergeConfiguration(z.record(z.unknown()).parse(existing.config), body.config) : existing.config;
    notificationTransportSchema.parse({ type: body.type ?? existing.type, config });
    const [channel] = await app.db.update(notificationChannels).set({ ...body, config, updatedAt: new Date() }).where(eq(notificationChannels.id, id)).returning();
    return channel;
  });
  app.delete("/channels/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    // Preserve delivery history while removing its live channel reference.
    const deleted = await app.db.transaction(async tx => {
      await tx.update(notifications).set({ channelId: null }).where(eq(notifications.channelId, id));
      return tx.delete(notificationChannels).where(eq(notificationChannels.id, id)).returning();
    });
    return deleted.length ? { ok: true } : reply.code(404).send({ error: "Channel not found" });
  });
  app.post("/test/:channelId", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const channel = await app.db.query.notificationChannels.findFirst({ where: eq(notificationChannels.id, channelId) });
    if (!channel) return reply.code(404).send({ error: "Channel not found" });
    const payload = { deviceName: "Test Device", deviceIp: "192.0.2.1", alertType: "Test Alert", severity: "low", timestamp: new Date().toISOString(), metricValue: "0", incidentUrl: `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/notifications`, incidentId: randomUUID(), event: "test" };
    const [record] = await app.db.insert(notifications).values({ channelId, channelType: channel.type, payload }).returning();
    await deliverRecord(app, record.id);
    const result = await app.db.query.notifications.findFirst({ where: eq(notifications.id, record.id) });
    if (result?.status !== "sent") return reply.code(502).send({ error: result?.error ?? "Delivery failed", notificationId: record.id });
    return { ok: true, notificationId: record.id };
  });
  app.get("/history", { preHandler: [authenticate] }, async request => {
    const { page, limit, offset } = pagination(request.query);
    const where = request.userDeviceIds === null ? undefined : inArray(notifications.incidentId, app.db.select({ id: incidents.id }).from(incidents).where(deviceScope(request, incidents.deviceId)));
    const [data, [count]] = await Promise.all([app.db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(limit).offset(offset), app.db.select({ total: sql<number>`count(*)` }).from(notifications).where(where)]);
    return pageResult(data, page, limit, Number(count.total));
  });
}
