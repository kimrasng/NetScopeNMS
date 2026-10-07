import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { topologyPositions, topologyEdges, devices } from "@netpulse/shared";
import { authenticate, requireRole } from "../middleware/auth.js";
import { deviceScope, assertDeviceAccess, HttpError } from "../services/access.js";
import { emitDeviceEvent } from "../services/realtime.js";
const positionItemSchema = z.object({ deviceId: z.string().uuid(), x: z.number().finite(), y: z.number().finite() });
const edgeSchema = z.object({ sourceDeviceId: z.string().uuid(), targetDeviceId: z.string().uuid(), sourcePort: z.string().max(255).default("") }).refine(edge => edge.sourceDeviceId !== edge.targetDeviceId, "Select two different devices");
export async function topologyRoutes(app: FastifyInstance) {
  app.get("/graph", { preHandler: [authenticate] }, async request => {
    const [nodes, edges, positions] = await Promise.all([
      app.db.select({ id: devices.id, name: devices.name, ip: devices.ip, status: devices.status, type: devices.type, groupId: devices.groupId, latitude: devices.latitude, longitude: devices.longitude, location: devices.location }).from(devices).where(deviceScope(request, devices.id)).orderBy(devices.name),
      app.db.select().from(topologyEdges).where(and(deviceScope(request, topologyEdges.sourceDeviceId), deviceScope(request, topologyEdges.targetDeviceId))),
      app.db.select().from(topologyPositions).where(and(eq(topologyPositions.userId, request.userId!), deviceScope(request, topologyPositions.deviceId))),
    ]);
    return { nodes, edges, positions };
  });
  app.get("/positions", { preHandler: [authenticate] }, async request => ({ data: await app.db.select().from(topologyPositions).where(and(eq(topologyPositions.userId, request.userId!), deviceScope(request, topologyPositions.deviceId))) }));
  app.put("/positions", { preHandler: [authenticate] }, async request => {
    const positions = z.array(positionItemSchema).min(1).max(5000).parse(request.body);
    const data = await app.db.transaction(async tx => {
      const saved = [];
      for (const position of positions) {
        const [row] = await tx.insert(topologyPositions).values({ userId: request.userId!, ...position }).onConflictDoUpdate({ target: [topologyPositions.userId, topologyPositions.deviceId], set: { x: position.x, y: position.y, updatedAt: new Date() } }).returning();
        saved.push(row);
      }
      return saved;
    });
    return { data };
  });
  app.post("/edges", { preHandler: [requireRole("super_admin", "admin", "operator")] }, async (request, reply) => {
    const body = edgeSchema.parse(request.body);
    await assertDeviceAccess(request, body.sourceDeviceId); await assertDeviceAccess(request, body.targetDeviceId);
    const [edge] = await app.db.insert(topologyEdges).values({ ...body, discoveryMethod: "manual" }).onConflictDoUpdate({ target: [topologyEdges.sourceDeviceId, topologyEdges.targetDeviceId, topologyEdges.sourcePort], set: { lastSeenAt: new Date() } }).returning();
    await emitDeviceEvent(app, "topology:updated", body.sourceDeviceId, { changed: true });
    return reply.code(201).send(edge);
  });
  app.delete("/edges/:id", { preHandler: [requireRole("super_admin", "admin", "operator")] }, async request => {
    const { id } = request.params as { id: string };
    const [edge] = await app.db.select().from(topologyEdges).where(and(eq(topologyEdges.id, id), deviceScope(request, topologyEdges.sourceDeviceId), deviceScope(request, topologyEdges.targetDeviceId)));
    if (!edge) throw new HttpError(404, "Connection not found");
    await app.db.delete(topologyEdges).where(eq(topologyEdges.id, id));
    await emitDeviceEvent(app, "topology:updated", edge.sourceDeviceId, { changed: true });
    return { ok: true };
  });
}
