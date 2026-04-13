import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, sql, desc, lte, gte, gt } from "drizzle-orm";
import { maintenanceWindows } from "@netpulse/shared";
import { authenticate, requireRole } from "../middleware/auth.js";

const createWindowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  deviceIds: z.array(z.string().uuid()).default([]),
  groupIds: z.array(z.string().uuid()).default([]),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  recurring: z.boolean().default(false),
  cronExpression: z.string().max(100).optional(),
});

const updateWindowSchema = createWindowSchema.partial();

export async function maintenanceWindowRoutes(app: FastifyInstance) {
  app.get("/active", { preHandler: [authenticate] }, async () => {
    const now = new Date();
    return app.db
      .select()
      .from(maintenanceWindows)
      .where(and(lte(maintenanceWindows.startAt, now), gte(maintenanceWindows.endAt, now)));
  });

  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as { status?: string; page?: string; limit?: string };
    const page = parseInt(query.page || "1", 10);
    const limit = Math.min(parseInt(query.limit || "50", 10), 200);
    const offset = (page - 1) * limit;

    const now = new Date();
    let where;
    if (query.status === "active") {
      where = and(lte(maintenanceWindows.startAt, now), gte(maintenanceWindows.endAt, now));
    } else if (query.status === "upcoming") {
      where = gt(maintenanceWindows.startAt, now);
    } else if (query.status === "past") {
      where = sql`${maintenanceWindows.endAt} < ${now}`;
    }

    const [items, countResult] = await Promise.all([
      app.db.select().from(maintenanceWindows).where(where).limit(limit).offset(offset).orderBy(desc(maintenanceWindows.startAt)),
      app.db.select({ count: sql<number>`count(*)` }).from(maintenanceWindows).where(where),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total: Number(countResult[0].count),
        totalPages: Math.ceil(Number(countResult[0].count) / limit),
      },
    };
  });

  app.get("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [window] = await app.db.select().from(maintenanceWindows).where(eq(maintenanceWindows.id, id));
    if (!window) return reply.code(404).send({ error: "Maintenance window not found" });
    return window;
  });

  app.post("/", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const body = createWindowSchema.parse(request.body);
    const [window] = await app.db
      .insert(maintenanceWindows)
      .values({
        ...body,
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        createdBy: request.userId,
      })
      .returning();
    return reply.code(201).send(window);
  });

  app.put("/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateWindowSchema.parse(request.body);
    const values: Record<string, unknown> = { ...body };
    if (body.startAt) values.startAt = new Date(body.startAt);
    if (body.endAt) values.endAt = new Date(body.endAt);

    const [window] = await app.db
      .update(maintenanceWindows)
      .set(values)
      .where(eq(maintenanceWindows.id, id))
      .returning();
    if (!window) return reply.code(404).send({ error: "Maintenance window not found" });
    return window;
  });

  app.delete("/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [window] = await app.db.delete(maintenanceWindows).where(eq(maintenanceWindows.id, id)).returning();
    if (!window) return reply.code(404).send({ error: "Maintenance window not found" });
    return { message: "Maintenance window deleted" };
  });
}
