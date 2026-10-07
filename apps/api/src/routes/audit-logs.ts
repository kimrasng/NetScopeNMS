import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, and, sql, desc, gte, lte, getTableColumns } from "drizzle-orm";
import { auditLogs, users } from "@netpulse/shared";
import { requireRole } from "../middleware/auth.js";
import { redactSecrets } from "../services/access.js";
import type { Database } from "@netpulse/shared";

export async function logAudit(
  db: Database,
  entry: {
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: unknown;
    ipAddress?: string;
  },
  request?: FastifyRequest,
) {
  const [row] = await db.insert(auditLogs).values({ ...entry, details: redactSecrets(entry.details) }).returning();
  if (request) request.auditLogged = true;
  return row;
}

export async function auditLogRoutes(app: FastifyInstance) {
  app.get("/options", { preHandler: [requireRole("super_admin", "admin")] }, async () => {
    const [actions, resources, actors] = await Promise.all([
      app.db.selectDistinct({ value: auditLogs.action }).from(auditLogs).orderBy(auditLogs.action),
      app.db.selectDistinct({ value: auditLogs.resource }).from(auditLogs).orderBy(auditLogs.resource),
      app.db.select({ id: users.id, name: users.name, email: users.email }).from(users).orderBy(users.name),
    ]);
    return { actions: actions.map(item => item.value), resources: resources.map(item => item.value), users: actors };
  });

  app.get("/", { preHandler: [requireRole("super_admin", "admin")] }, async (request) => {
    const query = request.query as {
      userId?: string;
      action?: string;
      resource?: string;
      from?: string;
      to?: string;
      page?: string;
      limit?: string;
    };
    const page = parseInt(query.page || "1", 10);
    const limit = Math.min(parseInt(query.limit || "50", 10), 200);
    const offset = (page - 1) * limit;

    const conditions = [];
    if (query.userId) conditions.push(eq(auditLogs.userId, query.userId));
    if (query.action) conditions.push(eq(auditLogs.action, query.action));
    if (query.resource) conditions.push(eq(auditLogs.resource, query.resource));
    if (query.from) conditions.push(gte(auditLogs.createdAt, new Date(query.from)));
    if (query.to) conditions.push(lte(auditLogs.createdAt, new Date(query.to)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      app.db.select({ ...getTableColumns(auditLogs), userName: users.name }).from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).where(where).limit(limit).offset(offset).orderBy(desc(auditLogs.createdAt)),
      app.db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(where),
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

  app.get("/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [entry] = await app.db.select().from(auditLogs).where(eq(auditLogs.id, id));
    if (!entry) return reply.code(404).send({ error: "Audit log entry not found" });
    return entry;
  });
}
