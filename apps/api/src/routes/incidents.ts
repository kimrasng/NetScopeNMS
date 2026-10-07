import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, sql, desc, ne, inArray } from "drizzle-orm";
import { incidents, incidentEvents, devices, alertRules, users } from "@netpulse/shared";
import { authenticate, requireRole } from "../middleware/auth.js";
import { deviceScope } from "../services/access.js";
import { emitDeviceEvent } from "../services/realtime.js";
import { generateIncidentRca } from "../services/ai.js";
import { HttpError } from "../services/access.js";
import { enqueueDeliveries } from "../services/delivery.js";
import { refreshDeviceStatus } from "../services/device-status.js";
import { logAudit } from "./audit-logs.js";

const acknowledgeSchema = z.object({
  comment: z.string().optional(),
});

/**
 * Incident management routes
 */
export async function incidentRoutes(app: FastifyInstance) {
  // List incidents
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as {
      status?: string; severity?: string; deviceId?: string;
      page?: string; limit?: string;
    };
    const page = parseInt(query.page || "1", 10);
    const limit = Math.min(parseInt(query.limit || "50", 10), 200);
    const offset = (page - 1) * limit;

    const conditions = [];
    if (query.status === "active") conditions.push(ne(incidents.status, "resolved"));
    else if (query.status) conditions.push(eq(incidents.status, z.enum(["problem", "acknowledged", "resolved"]).parse(query.status)));
    if (query.severity) conditions.push(eq(incidents.severity, z.enum(["critical", "high", "medium", "low"]).parse(query.severity)));
    if (query.deviceId) conditions.push(eq(incidents.deviceId, query.deviceId));

    conditions.push(deviceScope(request, incidents.deviceId));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      app.db.select({
        incident: incidents,
        deviceName: devices.name,
        deviceIp: devices.ip,
      })
        .from(incidents)
        .leftJoin(devices, eq(incidents.deviceId, devices.id))
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(incidents.startedAt)),
      app.db.select({ count: sql<number>`count(*)` }).from(incidents).where(where),
    ]);

    return {
      data: items.map((i) => ({ ...i.incident, deviceName: i.deviceName, deviceIp: i.deviceIp })),
      pagination: {
        page, limit,
        total: Number(countResult[0].count),
        totalPages: Math.ceil(Number(countResult[0].count) / limit),
      },
    };
  });

  // Get single incident with events
  app.get("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const incident = await app.db.query.incidents.findFirst({
      where: eq(incidents.id, id),
      with: {
        device: true,
        rule: true,
        events: { orderBy: (e, { desc }) => [desc(e.createdAt)] },
        notifications: true,
      },
    });
    if (!incident) return reply.code(404).send({ error: "Incident not found" });
    const actorIds = [...new Set([incident.acknowledgedBy, ...incident.events.map(event => event.createdBy)].filter((actor): actor is string => !!actor))];
    const actors = actorIds.length ? await app.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, actorIds)) : [];
    const names = new Map(actors.map(actor => [actor.id, actor.name]));
    return { ...incident, acknowledgedByName: incident.acknowledgedBy ? names.get(incident.acknowledgedBy) ?? null : null, events: incident.events.map(event => ({ ...event, createdByName: event.createdBy ? names.get(event.createdBy) ?? null : null })) };
  });

  // Acknowledge incident
  app.post("/:id/acknowledge", { preHandler: [requireRole("super_admin", "admin", "operator")] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = acknowledgeSchema.parse(request.body ?? {});

    const [updated] = await app.db.update(incidents)
      .set({
        status: "acknowledged",
        acknowledgedBy: request.userId!,
        acknowledgedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(incidents.id, id), eq(incidents.status, "problem")))
      .returning();

    if (!updated) throw new HttpError(409, "Only active problems can be acknowledged");

    await app.db.insert(incidentEvents).values({
      incidentId: id,
      type: "acknowledged",
      message: body.comment || "Incident acknowledged",
      createdBy: request.userId!,
    });

    await logAudit(app.db, { userId: request.userId!, action: "incident.acknowledge", resource: "incident", resourceId: id, ipAddress: request.ip }, request);
    await emitDeviceEvent(app, "incident:updated", updated.deviceId, updated);
    return updated;
  });

  app.post("/:id/resolve", { preHandler: [requireRole("super_admin", "admin", "operator")] }, async request => {
    const { id } = request.params as { id: string };
    const updated = await app.db.transaction(async tx => {
      const [incident] = await tx.update(incidents).set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() }).where(and(eq(incidents.id, id), ne(incidents.status, "resolved"))).returning();
      if (!incident) throw new HttpError(409, "Incident is already resolved");
      await tx.insert(incidentEvents).values({ incidentId: id, type: "resolved", message: "Incident resolved manually", createdBy: request.userId });
      const device = await tx.query.devices.findFirst({ where: eq(devices.id, incident.deviceId) });
      const rule = incident.ruleId ? await tx.query.alertRules.findFirst({ where: eq(alertRules.id, incident.ruleId) }) : undefined;
      if (device && rule) await enqueueDeliveries(tx, rule.channels ?? [], { deviceName: device.name, deviceIp: device.ip, alertType: incident.title, severity: incident.severity, timestamp: new Date().toISOString(), metricValue: String(incident.metricValue ?? ""), incidentUrl: `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/incidents/${id}`, incidentId: id, event: "resolved" }, "resolved");
      return incident;
    });
    await refreshDeviceStatus(app, updated.deviceId);
    await logAudit(app.db, { userId: request.userId, action: "incident.resolve", resource: "incident", resourceId: id, ipAddress: request.ip }, request);
    await emitDeviceEvent(app, "incident:updated", updated.deviceId, updated);
    return updated;
  });

  app.post("/:id/ai-analysis", { preHandler: [requireRole("super_admin", "admin", "operator")] }, async (request) => {
    const { id } = request.params as { id: string };
    return (await generateIncidentRca(request, id)).updated;
  });

  // Add comment to incident
  app.post("/:id/comments", { preHandler: [requireRole("super_admin", "admin", "operator")] }, async (request, _reply) => {
    const { id } = request.params as { id: string };
    const { message } = z.object({ message: z.string().min(1) }).parse(request.body);

    const [event] = await app.db.insert(incidentEvents).values({
      incidentId: id,
      type: "comment",
      message,
      createdBy: request.userId!,
    }).returning();

    const incident = await app.db.query.incidents.findFirst({ where: eq(incidents.id, id) });
    if (incident) await emitDeviceEvent(app, "incident:comment", incident.deviceId, { incidentId: id, event });
    return event;
  });
}
