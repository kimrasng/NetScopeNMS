import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, sql, and, inArray, or } from "drizzle-orm";
import { devices, interfaces } from "@netpulse/shared";
import { authenticate, requireRole } from "../middleware/auth.js";

const createDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  ip: z.string().min(1).max(45),
  type: z.enum(["router", "switch", "server", "firewall", "access_point", "load_balancer", "storage", "other"]).default("other"),
  snmpVersion: z.enum(["v1", "v2c", "v3"]).optional(),
  snmpCommunity: z.string().optional(),
  snmpPort: z.number().int().default(161),
  snmpV3Config: z.record(z.unknown()).optional(),
  sshHost: z.string().optional(),
  sshPort: z.number().int().default(22),
  sshUsername: z.string().optional(),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  groupId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  pollingInterval: z.number().int().min(30).default(60),
  pollingEnabled: z.boolean().default(true),
});

const updateDeviceSchema = createDeviceSchema.partial();

/**
 * Device CRUD routes
 */
export async function deviceRoutes(app: FastifyInstance) {
  // List devices
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as { search?: string; type?: string; status?: string; groupId?: string; page?: string; limit?: string };
    const page = parseInt(query.page || "1", 10);
    const limit = Math.min(parseInt(query.limit || "50", 10), 200);
    const offset = (page - 1) * limit;

    const conditions = [];
    if (query.search) {
      conditions.push(
        sql`(${devices.name} ILIKE ${"%" + query.search + "%"} OR ${devices.ip} ILIKE ${"%" + query.search + "%"})`
      );
    }
    if (query.type) conditions.push(eq(devices.type, query.type as any));
    if (query.status) conditions.push(eq(devices.status, query.status as any));
    if (query.groupId) conditions.push(eq(devices.groupId, query.groupId));

    // Scope-based access control for restricted users
    if (request.userScope === "restricted") {
      const deviceIdFilter = request.userAllowedDeviceIds || [];
      const groupIdFilter = request.userAllowedGroupIds || [];

      if (deviceIdFilter.length === 0 && groupIdFilter.length === 0) {
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }

      const scopeConditions = [];
      if (deviceIdFilter.length > 0) {
        scopeConditions.push(inArray(devices.id, deviceIdFilter));
      }
      if (groupIdFilter.length > 0) {
        scopeConditions.push(inArray(devices.groupId, groupIdFilter));
      }
      conditions.push(scopeConditions.length > 1 ? or(...scopeConditions)! : scopeConditions[0]);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      app.db.select().from(devices).where(where).limit(limit).offset(offset).orderBy(devices.name),
      app.db.select({ count: sql<number>`count(*)` }).from(devices).where(where),
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

  // Get single device with interfaces
  app.get("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const device = await app.db.query.devices.findFirst({
      where: eq(devices.id, id),
      with: { interfaces: true, group: true },
    });
    if (!device) return reply.code(404).send({ error: "Device not found" });
    return device;
  });

  // Create device
  app.post("/", { preHandler: [requireRole("super_admin", "admin", "operator")] }, async (request, reply) => {
    const body = createDeviceSchema.parse(request.body);
    const [device] = await app.db.insert(devices).values(body).returning();
    return reply.code(201).send(device);
  });

  // Update device
  app.put("/:id", { preHandler: [requireRole("super_admin", "admin", "operator")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateDeviceSchema.parse(request.body);
    const [device] = await app.db.update(devices)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(devices.id, id))
      .returning();
    if (!device) return reply.code(404).send({ error: "Device not found" });
    return device;
  });

  // Delete device
  app.delete("/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [device] = await app.db.delete(devices).where(eq(devices.id, id)).returning();
    if (!device) return reply.code(404).send({ error: "Device not found" });
    return { message: "Device deleted" };
  });

  // Get device interfaces
  app.get("/:id/interfaces", { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    return app.db.select().from(interfaces).where(eq(interfaces.deviceId, id));
  });

  // Get device metrics
  app.get("/:id/metrics", { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { metric?: string; from?: string; to?: string };
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 3600000);
    const to = query.to ? new Date(query.to) : new Date();

    const result = await app.db.execute(sql`
      SELECT metric_name, value, timestamp
      FROM metrics
      WHERE device_id = ${id}
        ${query.metric ? sql`AND metric_name = ${query.metric}` : sql``}
        AND timestamp >= ${from.toISOString()}
        AND timestamp <= ${to.toISOString()}
      ORDER BY timestamp ASC
    `);
    return result;
  });
}
