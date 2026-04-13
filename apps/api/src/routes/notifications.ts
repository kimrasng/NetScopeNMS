import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { notificationChannels, notifications } from "@netpulse/shared";
import { dispatchNotification, type NotificationPayload } from "@netpulse/notification";
import { authenticate, requireRole } from "../middleware/auth.js";

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

const channelSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["email", "telegram", "discord", "slack", "sms", "pagerduty", "webhook", "in_app"]),
  config: z.record(z.unknown()),
  enabled: z.boolean().default(true),
});

/**
 * Send notification to all enabled channels and log results
 */
export async function sendNotificationToAll(app: FastifyInstance, payload: NotificationPayload) {
  const channels = await app.db.select().from(notificationChannels);
  const enabledChannels = channels.filter((c) => c.enabled);

  for (const channel of enabledChannels) {
    try {
      await withRetry(() => dispatchNotification(channel as any, payload));
      // Log success
      await app.db.insert(notifications).values({
        incidentId: payload.incidentId || null,
        channelId: channel.id,
        channelType: channel.type,
        status: "sent",
        payload: payload as any,
        sentAt: new Date(),
      });
    } catch (err: any) {
      // Log failure
      await app.db.insert(notifications).values({
        incidentId: payload.incidentId || null,
        channelId: channel.id,
        channelType: channel.type,
        status: "failed",
        payload: payload as any,
        error: err.message,
      });
      app.log.error({ err, channel: channel.name }, "Notification send failed after retries");
    }
  }

  // WebSocket in-app notification
  if ((app as any).io) {
    (app as any).io.emit("notification", payload);
  }
}

/**
 * Notification channel management routes
 */
export async function notificationRoutes(app: FastifyInstance) {
  // List channels
  app.get("/channels", { preHandler: [authenticate] }, async () => {
    return app.db.select().from(notificationChannels).orderBy(notificationChannels.name);
  });

  // Create channel
  app.post("/channels", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const body = channelSchema.parse(request.body);
    const [channel] = await app.db.insert(notificationChannels).values(body).returning();
    return reply.code(201).send(channel);
  });

  // Update channel
  app.put("/channels/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = channelSchema.partial().parse(request.body);
    const [channel] = await app.db.update(notificationChannels)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(notificationChannels.id, id))
      .returning();
    if (!channel) return reply.code(404).send({ error: "Channel not found" });
    return channel;
  });

  // Delete channel
  app.delete("/channels/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [channel] = await app.db.delete(notificationChannels)
      .where(eq(notificationChannels.id, id))
      .returning();
    if (!channel) return reply.code(404).send({ error: "Channel not found" });
    return { message: "Channel deleted" };
  });

  // Test channel - actually sends a test notification now
  app.post("/test/:channelId", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const channel = await app.db.query.notificationChannels.findFirst({
      where: eq(notificationChannels.id, channelId),
    });
    if (!channel) return reply.code(404).send({ error: "Channel not found" });

    const testPayload: NotificationPayload = {
      deviceName: "Test Device",
      deviceIp: "192.168.1.1",
      alertType: "Test Alert",
      severity: "low",
      timestamp: new Date().toISOString(),
      metricValue: "0",
      incidentUrl: "#",
      incidentId: "test",
    };

    try {
      await dispatchNotification(channel as any, testPayload);
      return { ok: true, message: `Test sent to ${channel.type} channel "${channel.name}"` };
    } catch (err: any) {
      return reply.code(500).send({ error: `Test failed: ${err.message}` });
    }
  });

  // Notification history
  app.get("/history", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as { page?: string; limit?: string };
    const page = parseInt(query.page || "1", 10);
    const limit = Math.min(parseInt(query.limit || "50", 10), 200);
    const offset = (page - 1) * limit;

    return app.db.select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  });
}
