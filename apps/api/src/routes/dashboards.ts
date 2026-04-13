import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, or, and } from "drizzle-orm";
import { dashboards, dashboardWidgets } from "@netpulse/shared";
import { authenticate } from "../middleware/auth.js";

const createDashboardSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  isShared: z.boolean().default(false),
  templateId: z.string().optional(),
  layoutConfig: z.record(z.unknown()).default({}),
  widgets: z.array(z.object({
    widgetType: z.string().min(1),
    config: z.record(z.unknown()).default({}),
    gridPosition: z.record(z.unknown()).default({}),
  })).optional(),
});

const updateDashboardSchema = createDashboardSchema.omit({ widgets: true }).partial().extend({
  widgets: z.array(z.object({
    id: z.string().uuid().optional(),
    widgetType: z.string().min(1),
    config: z.record(z.unknown()).default({}),
    gridPosition: z.record(z.unknown()).default({}),
  })).optional(),
});

export async function dashboardCrudRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const userId = request.userId!;
    const result = await app.db
      .select()
      .from(dashboards)
      .where(or(eq(dashboards.userId, userId), eq(dashboards.isShared, true)))
      .orderBy(dashboards.createdAt);
    return { data: result };
  });

  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.userId!;
    const body = createDashboardSchema.parse(request.body);
    const { widgets, ...dashboardData } = body;

    const [dashboard] = await app.db
      .insert(dashboards)
      .values({ ...dashboardData, userId })
      .returning();

    if (widgets && widgets.length > 0) {
      await app.db.insert(dashboardWidgets).values(
        widgets.map((w) => ({ ...w, dashboardId: dashboard.id }))
      );
    }

    return reply.code(201).send(dashboard);
  });

  app.get("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.userId!;

    const dashboard = await app.db.query.dashboards.findFirst({
      where: and(
        eq(dashboards.id, id),
        or(eq(dashboards.userId, userId), eq(dashboards.isShared, true))
      ),
      with: { widgets: true },
    });

    if (!dashboard) return reply.code(404).send({ error: "Dashboard not found" });
    return dashboard;
  });

  app.put("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.userId!;
    const body = updateDashboardSchema.parse(request.body);
    const { widgets, ...dashboardData } = body;

    const existing = await app.db.query.dashboards.findFirst({
      where: and(eq(dashboards.id, id), eq(dashboards.userId, userId)),
    });
    if (!existing) return reply.code(404).send({ error: "Dashboard not found" });

    const [updated] = await app.db
      .update(dashboards)
      .set({ ...dashboardData, updatedAt: new Date() })
      .where(eq(dashboards.id, id))
      .returning();

    if (widgets !== undefined) {
      await app.db.delete(dashboardWidgets).where(eq(dashboardWidgets.dashboardId, id));
      if (widgets.length > 0) {
        await app.db.insert(dashboardWidgets).values(
          widgets.map(({ id: _id, ...w }) => ({ ...w, dashboardId: id }))
        );
      }
    }

    return updated;
  });

  app.delete("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.userId!;

    const [deleted] = await app.db
      .delete(dashboards)
      .where(and(eq(dashboards.id, id), eq(dashboards.userId, userId)))
      .returning();

    if (!deleted) return reply.code(404).send({ error: "Dashboard not found" });
    return { message: "Dashboard deleted" };
  });

  app.post("/:id/duplicate", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.userId!;

    const source = await app.db.query.dashboards.findFirst({
      where: and(
        eq(dashboards.id, id),
        or(eq(dashboards.userId, userId), eq(dashboards.isShared, true))
      ),
      with: { widgets: true },
    });

    if (!source) return reply.code(404).send({ error: "Dashboard not found" });

    const [newDashboard] = await app.db
      .insert(dashboards)
      .values({
        userId,
        name: `${source.name} (Copy)`,
        description: source.description,
        isDefault: false,
        isShared: false,
        templateId: source.templateId,
        layoutConfig: source.layoutConfig,
      })
      .returning();

    if (source.widgets.length > 0) {
      await app.db.insert(dashboardWidgets).values(
        source.widgets.map((w) => ({
          dashboardId: newDashboard.id,
          widgetType: w.widgetType,
          config: w.config,
          gridPosition: w.gridPosition,
        }))
      );
    }

    return reply.code(201).send(newDashboard);
  });
}
