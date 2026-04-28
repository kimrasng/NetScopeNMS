import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { incidents, incidentEvents, devices } from "@netpulse/shared";
import { authenticate } from "../middleware/auth.js";
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
    if (query.status) conditions.push(eq(incidents.status, query.status as any));
    if (query.severity) conditions.push(eq(incidents.severity, query.severity as any));
    if (query.deviceId) conditions.push(eq(incidents.deviceId, query.deviceId));

    // Scope-based access control for restricted users
    if (request.userScope === "restricted") {
      const deviceIdFilter = request.userAllowedDeviceIds || [];
      if (deviceIdFilter.length === 0) {
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }
      conditions.push(inArray(incidents.deviceId, deviceIdFilter));
    }

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
    return incident;
  });

  // Acknowledge incident
  app.post("/:id/acknowledge", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = acknowledgeSchema.parse(request.body);

    const [updated] = await app.db.update(incidents)
      .set({
        status: "acknowledged",
        acknowledgedBy: request.userId!,
        acknowledgedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, id))
      .returning();

    if (!updated) return reply.code(404).send({ error: "Incident not found" });

    await app.db.insert(incidentEvents).values({
      incidentId: id,
      type: "acknowledged",
      message: body.comment || "Incident acknowledged",
      createdBy: request.userId!,
    });

    await logAudit(app.db, { userId: request.userId!, action: "incident.acknowledge", resource: "incident", resourceId: id, ipAddress: request.ip });
    app.io.emit("incident:updated", updated);
    return updated;
  });

  // Resolve incident
  app.post("/:id/resolve", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [updated] = await app.db.update(incidents)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, id))
      .returning();

    if (!updated) return reply.code(404).send({ error: "Incident not found" });

    await app.db.insert(incidentEvents).values({
      incidentId: id,
      type: "resolved",
      message: "Incident resolved",
      createdBy: request.userId!,
    });

    await logAudit(app.db, { userId: request.userId!, action: "incident.resolve", resource: "incident", resourceId: id, ipAddress: request.ip });
    app.io.emit("incident:updated", updated);
    return updated;
  });

  // Trigger AI analysis for incident
  app.post("/:id/ai-analysis", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const incident = await app.db.query.incidents.findFirst({
      where: eq(incidents.id, id),
      with: { device: true },
    });
    if (!incident) return reply.code(404).send({ error: "Incident not found" });

    // Fetch recent metrics for context
    const recentMetrics = await app.db.execute(sql`
      SELECT metric_name, value, timestamp
      FROM metrics
      WHERE device_id = ${incident.deviceId}
        AND timestamp >= NOW() - INTERVAL '60 minutes'
      ORDER BY timestamp DESC
      LIMIT 100
    `);

    // TODO: Call AI engine for RCA
    // For now return placeholder
    const aiRca = `AI Analysis pending - Device: ${incident.device?.name}, Metric: ${incident.metricName}, Value: ${incident.metricValue}`;

    const [updated] = await app.db.update(incidents)
      .set({ aiRca, updatedAt: new Date() })
      .where(eq(incidents.id, id))
      .returning();

    await app.db.insert(incidentEvents).values({
      incidentId: id,
      type: "ai_analysis",
      message: "AI root cause analysis generated",
      metadata: { rca: aiRca },
    });

    return { ...updated, recentMetrics };
  });

  // Add comment to incident
  app.post("/:id/comments", { preHandler: [authenticate] }, async (request, _reply) => {
    const { id } = request.params as { id: string };
    const { message } = z.object({ message: z.string().min(1) }).parse(request.body);

    const [event] = await app.db.insert(incidentEvents).values({
      incidentId: id,
      type: "comment",
      message,
      createdBy: request.userId!,
    }).returning();

    app.io.emit("incident:comment", { incidentId: id, event });
    return event;
  });
}
