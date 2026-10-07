import { bodySchema } from "../services/contracts.js";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { eq, or, and, sql } from "drizzle-orm";
import { dashboards, dashboardWidgets } from "@netpulse/shared";
import { authenticate } from "../middleware/auth.js";
import { assertDeviceAccess, HttpError } from "../services/access.js";
const widgetSchema = z.object({
  id: z.string().uuid().optional(), widgetType: z.enum(["summary", "metric", "incidents", "throughput", "top_devices", "text"]),
  config: z.object({ title: z.string().max(255).optional(), deviceId: z.string().uuid().optional(), metric: z.string().min(1).max(100).optional(), text: z.string().max(10000).optional() }).default({}),
  gridPosition: z.object({ colSpan: z.number().int().min(1).max(12).optional(), order: z.number().int().min(0).optional(), boardColumnSpan: z.number().int().min(1).max(4).optional(), rowSpan: z.number().int().min(2).max(20).optional(), columnOffset: z.record(z.number().int().min(0).max(3)).optional() }).default({}),
}).superRefine((widget, ctx) => { if (widget.widgetType === "metric" && (!widget.config?.deviceId || !widget.config.metric)) ctx.addIssue({ code: "custom", path: ["config"], message: "Metric widgets require a device and metric" }); });
const createSchema = z.object({ name: z.string().min(1).max(255), description: z.string().max(2000).optional(), isDefault: z.boolean().default(false), isShared: z.boolean().default(false), templateId: z.string().optional(), layoutConfig: z.record(z.unknown()).default({}), widgets: z.array(widgetSchema).max(50).optional() });
const updateSchema = createSchema.partial();
export async function dashboardCrudRoutes(app: FastifyInstance) {
  const readable = (request: FastifyRequest, id?: string) => and(id ? eq(dashboards.id, id) : undefined, or(eq(dashboards.userId, request.userId!), eq(dashboards.isShared, true)));
  const visibleWidgets = (request: FastifyRequest, widgets: typeof dashboardWidgets.$inferSelect[]) => widgets.filter(widget => !widget.config?.deviceId || request.userDeviceIds === null || request.userDeviceIds?.includes(String(widget.config?.deviceId))).sort((a, b) => Number(a.gridPosition?.order ?? 0) - Number(b.gridPosition?.order ?? 0));
  async function validateWidgets(request: FastifyRequest, widgets?: z.infer<typeof widgetSchema>[]) { for (const widget of widgets ?? []) if (widget.config.deviceId) await assertDeviceAccess(request, widget.config.deviceId); }
  app.get("/", { preHandler: [authenticate] }, async request => ({ data: await app.db.select().from(dashboards).where(readable(request)).orderBy(dashboards.createdAt) }));
  app.get("/default", { preHandler: [authenticate] }, async request => {
    const dashboard = await app.db.query.dashboards.findFirst({ where: and(eq(dashboards.userId, request.userId!), eq(dashboards.isDefault, true)), with: { widgets: true } });
    return { dashboard: dashboard ? { ...dashboard, widgets: visibleWidgets(request, dashboard.widgets) } : null };
  });
  app.post("/", { schema: bodySchema(createSchema), preHandler: [authenticate] }, async (request, reply) => {
    const { widgets, ...body } = createSchema.parse(request.body); await validateWidgets(request, widgets);
    const dashboard = await app.db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${request.userId!}))`);
      if (body.isDefault) await tx.update(dashboards).set({ isDefault: false }).where(eq(dashboards.userId, request.userId!));
      const [created] = await tx.insert(dashboards).values({ ...body, userId: request.userId! }).returning();
      if (widgets?.length) await tx.insert(dashboardWidgets).values(widgets.map(({ id: _id, ...widget }) => ({ ...widget, dashboardId: created.id })));
      return created;
    });
    return reply.code(201).send(dashboard);
  });
  app.get("/:id", { preHandler: [authenticate] }, async request => {
    const { id } = request.params as { id: string };
    const dashboard = await app.db.query.dashboards.findFirst({ where: readable(request, id), with: { widgets: true } });
    if (!dashboard) throw new HttpError(404, "Dashboard not found");
    return { ...dashboard, widgets: visibleWidgets(request, dashboard.widgets) };
  });
  app.put("/:id", { schema: bodySchema(updateSchema), preHandler: [authenticate] }, async request => {
    const { id } = request.params as { id: string }; const { widgets, ...body } = updateSchema.parse(request.body); await validateWidgets(request, widgets);
    return app.db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${request.userId!}))`);
      const existing = await tx.query.dashboards.findFirst({ where: and(eq(dashboards.id, id), eq(dashboards.userId, request.userId!)) });
      if (!existing) throw new HttpError(404, "Dashboard not found");
      if (body.isDefault) await tx.update(dashboards).set({ isDefault: false }).where(eq(dashboards.userId, request.userId!));
      const [updated] = await tx.update(dashboards).set({ ...body, updatedAt: new Date() }).where(eq(dashboards.id, id)).returning();
      if (widgets !== undefined) { await tx.delete(dashboardWidgets).where(eq(dashboardWidgets.dashboardId, id)); if (widgets.length) await tx.insert(dashboardWidgets).values(widgets.map(({ id: _id, ...widget }) => ({ ...widget, dashboardId: id }))); }
      return updated;
    });
  });
  app.delete("/:id", { preHandler: [authenticate] }, async request => {
    const { id } = request.params as { id: string };
    const [deleted] = await app.db.delete(dashboards).where(and(eq(dashboards.id, id), eq(dashboards.userId, request.userId!))).returning();
    if (!deleted) throw new HttpError(404, "Dashboard not found"); return { message: "Dashboard deleted" };
  });
  app.post("/:id/duplicate", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const source = await app.db.query.dashboards.findFirst({ where: readable(request, id), with: { widgets: true } });
    if (!source) throw new HttpError(404, "Dashboard not found");
    const created = await app.db.transaction(async tx => {
      const [dashboard] = await tx.insert(dashboards).values({ userId: request.userId!, name: `${source.name} (Copy)`, description: source.description, templateId: source.templateId, layoutConfig: source.layoutConfig }).returning();
      const widgets = visibleWidgets(request, source.widgets);
      if (widgets.length) await tx.insert(dashboardWidgets).values(widgets.map(widget => ({ dashboardId: dashboard.id, widgetType: widget.widgetType, config: widget.config, gridPosition: widget.gridPosition })));
      return dashboard;
    });
    return reply.code(201).send(created);
  });
}
