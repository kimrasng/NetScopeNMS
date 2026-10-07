import { bodySchema } from "../services/contracts.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { maintenanceWindows } from "@netpulse/shared";
import { authenticate, requireRole } from "../middleware/auth.js";
import { isWindowActive, validateWindow } from "../services/maintenance.js";
import { pagination, pageResult } from "../services/validation.js";
import { logAudit } from "./audit-logs.js";

const createWindowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  deviceIds: z.array(z.string().uuid()).default([]),
  groupIds: z.array(z.string().uuid()).default([]),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  recurring: z.boolean().default(false),
  cronExpression: z.string().max(100).optional(),
  timezone: z.string().max(100).default("UTC"),
});

const updateWindowSchema = createWindowSchema.partial();

export async function maintenanceWindowRoutes(app: FastifyInstance) {
  function visible(window: typeof maintenanceWindows.$inferSelect, request: import("fastify").FastifyRequest) {
    return request.userScope !== "restricted" || (!window.deviceIds?.length && !window.groupIds?.length) || window.deviceIds?.some(id => request.userDeviceIds?.includes(id)) || window.groupIds?.some(id => request.userAllowedGroupIds?.includes(id));
  }
  function scoped(window: typeof maintenanceWindows.$inferSelect, request: import("fastify").FastifyRequest) {
    return { ...(request.userScope !== "restricted" ? window : { ...window, deviceIds: window.deviceIds?.filter(id => request.userDeviceIds?.includes(id)), groupIds: window.groupIds?.filter(id => request.userAllowedGroupIds?.includes(id)) }), isActive: isWindowActive(window) };
  }
  app.get("/active", { preHandler: [authenticate] }, async request => {
    const windows = await app.db.select().from(maintenanceWindows);
    return windows.filter(window => visible(window, request) && isWindowActive(window)).map(window => scoped(window, request));
  });
  app.get("/", { preHandler: [authenticate] }, async request => {
    const query = z.object({ status: z.enum(["active", "upcoming", "past"]).optional() }).parse(request.query);
    const { page, limit } = pagination(request.query);
    const now = new Date();
    const windows = (await app.db.select().from(maintenanceWindows).orderBy(desc(maintenanceWindows.startAt))).filter(window => visible(window, request) && (
      !query.status || (query.status === "active" ? isWindowActive(window, now) : query.status === "upcoming" ? window.startAt > now || (window.recurring && !isWindowActive(window, now)) : !window.recurring && window.endAt <= now)
    ));
    return pageResult(windows.slice((page - 1) * limit, page * limit).map(window => scoped(window, request)), page, limit, windows.length);
  });

  app.get("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [window] = await app.db.select().from(maintenanceWindows).where(eq(maintenanceWindows.id, id));
    if (!window || !visible(window, request)) return reply.code(404).send({ error: "Maintenance window not found" });
    return scoped(window, request);
  });

  app.post("/", { schema: bodySchema(createWindowSchema), preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const body = createWindowSchema.parse(request.body);
    validateWindow(body);
    const [window] = await app.db
      .insert(maintenanceWindows)
      .values({
        ...body,
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        createdBy: request.userId,
      })
      .returning();
    await logAudit(app.db, { userId: request.userId, action: "maintenance-window.create", resource: "maintenance-window", resourceId: window.id, details: body, ipAddress: request.ip }, request);
    return reply.code(201).send(window);
  });

  app.put("/:id", { schema: bodySchema(updateWindowSchema), preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateWindowSchema.parse(request.body);
    const existing = await app.db.query.maintenanceWindows.findFirst({ where: eq(maintenanceWindows.id, id) });
    if (!existing) return reply.code(404).send({ error: "Maintenance window not found" });
    validateWindow({ ...existing, ...body });
    const values: Record<string, unknown> = { ...body };
    if (body.startAt) values.startAt = new Date(body.startAt);
    if (body.endAt) values.endAt = new Date(body.endAt);

    const [window] = await app.db
      .update(maintenanceWindows)
      .set(values)
      .where(eq(maintenanceWindows.id, id))
      .returning();
    if (!window) return reply.code(404).send({ error: "Maintenance window not found" });
    await logAudit(app.db, { userId: request.userId, action: "maintenance-window.update", resource: "maintenance-window", resourceId: id, details: body, ipAddress: request.ip }, request);
    return window;
  });

  app.delete("/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [window] = await app.db.delete(maintenanceWindows).where(eq(maintenanceWindows.id, id)).returning();
    if (!window) return reply.code(404).send({ error: "Maintenance window not found" });
    await logAudit(app.db, { userId: request.userId, action: "maintenance-window.delete", resource: "maintenance-window", resourceId: id, ipAddress: request.ip }, request);
    return { message: "Maintenance window deleted" };
  });
}
