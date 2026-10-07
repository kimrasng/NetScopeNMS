import { bodySchema } from "../services/contracts.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { deviceGroups, devices } from "@netpulse/shared";
import { authenticate, requireRole } from "../middleware/auth.js";
import { deviceScope } from "../services/access.js";
import { pagination, pageResult } from "../services/validation.js";

const groupSchema = z.object({ name: z.string().min(1).max(255), description: z.string().optional(), parentId: z.string().uuid().nullable().optional() });
export async function deviceGroupRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async request => {
    const { page, limit, offset } = pagination(request.query);
    const scoped = request.userDeviceIds === null ? undefined : or(
      request.userAllowedGroupIds?.length ? inArray(deviceGroups.id, request.userAllowedGroupIds) : sql`false`,
      inArray(deviceGroups.id, app.db.select({ groupId: devices.groupId }).from(devices).where(deviceScope(request, devices.id))),
    );
    const [data, [count]] = await Promise.all([app.db.select().from(deviceGroups).where(scoped).orderBy(deviceGroups.name).limit(limit).offset(offset), app.db.select({ total: sql<number>`count(*)` }).from(deviceGroups).where(scoped)]);
    return pageResult(data, page, limit, Number(count.total));
  });
  app.post("/", { schema: bodySchema(groupSchema), preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    if (request.userScope !== "all") return reply.code(403).send({ error: "Full scope required" });
    const [group] = await app.db.insert(deviceGroups).values(groupSchema.parse(request.body)).returning();
    return reply.code(201).send(group);
  });
  app.put("/:id", { schema: bodySchema(groupSchema.partial()), preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (request.userScope !== "all") return reply.code(403).send({ error: "Full scope required" });
    const body = groupSchema.partial().parse(request.body);
    if (body.parentId === id) return reply.code(400).send({ error: "Group cannot be its own parent" });
    const [group] = await app.db.update(deviceGroups).set(body).where(eq(deviceGroups.id, id)).returning();
    return group ?? reply.code(404).send({ error: "Group not found" });
  });
  app.delete("/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (request.userScope !== "all") return reply.code(403).send({ error: "Full scope required" });
    const [group] = await app.db.delete(deviceGroups).where(and(eq(deviceGroups.id, id))).returning();
    return group ? { ok: true } : reply.code(404).send({ error: "Group not found" });
  });
}
