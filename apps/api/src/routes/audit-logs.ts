import type { FastifyInstance } from "fastify";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { auditLogs } from "@netpulse/shared";
import { requireRole } from "../middleware/auth.js";
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
) {
  const [row] = await db.insert(auditLogs).values(entry).returning();
  return row;
}

export async function auditLogRoutes(app: FastifyInstance) {
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
      app.db.select().from(auditLogs).where(where).limit(limit).offset(offset).orderBy(desc(auditLogs.createdAt)),
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
