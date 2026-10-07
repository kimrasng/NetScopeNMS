import { bodySchema } from "../services/contracts.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, sql, and } from "drizzle-orm";
import { devices, interfaces, snmpV3Schema } from "@netpulse/shared";
import { authenticate, requireRole } from "../middleware/auth.js";
import { deviceScope } from "../services/access.js";
import { encryptSshKey } from "../services/ssh.js";
import { logAudit } from "./audit-logs.js";

const createDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  ip: z.string().ip(),
  type: z.enum(["router", "switch", "server", "firewall", "access_point", "load_balancer", "storage", "other"]).default("other"),
  snmpVersion: z.enum(["v1", "v2c", "v3"]).optional(),
  snmpCommunity: z.string().optional(),
  snmpPort: z.number().int().min(1).max(65535).default(161),
  snmpV3Config: snmpV3Schema.nullable().optional(),
  sshHost: z.string().max(255).nullable().optional(),
  sshPort: z.number().int().min(1).max(65535).default(22),
  sshUsername: z.string().max(255).nullable().optional(),
  sshPrivateKey: z.string().min(32).max(20000).optional(),
  sshHostFingerprint: z.string().regex(/^(?:[a-fA-F0-9]{64}|SHA256:[A-Za-z0-9+/]{43}=?)$/, "Use the server SHA256 fingerprint").nullable().optional(),
  location: z.string().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
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
    if (query.type) conditions.push(eq(devices.type, createDeviceSchema.shape.type.parse(query.type)));
    if (query.status) conditions.push(eq(devices.status, z.enum(["up", "down", "warning", "unknown", "maintenance"]).parse(query.status)));
    if (query.groupId) conditions.push(eq(devices.groupId, query.groupId));

    conditions.push(deviceScope(request, devices.id));

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
  app.post("/", { schema: bodySchema(createDeviceSchema), preHandler: [requireRole("super_admin", "admin", "operator")] }, async (request, reply) => {
    const body = createDeviceSchema.parse(request.body);
    if (body.snmpVersion === "v3" && !body.snmpV3Config) throw new z.ZodError([{ code: "custom", path: ["snmpV3Config"], message: "SNMPv3 credentials are required" }]);
    const { sshPrivateKey, ...values } = body;
    const [device] = await app.db.insert(devices).values({ ...values, ...(sshPrivateKey ? { sshKeyEncrypted: encryptSshKey(sshPrivateKey) } : {}) }).returning();
    await logAudit(app.db, { userId: request.userId, action: "device.create", resource: "device", resourceId: device.id, details: body, ipAddress: request.ip }, request);
    if (app.pollingEngine) await app.pollingEngine.syncDevice(device.id);
    return reply.code(201).send(device);
  });

  // Update device
  app.put("/:id", { schema: bodySchema(updateDeviceSchema), preHandler: [requireRole("super_admin", "admin", "operator")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await app.db.query.devices.findFirst({ where: eq(devices.id, id) });
    if (!existing) return reply.code(404).send({ error: "Device not found" });
    const input = z.record(z.unknown()).parse(request.body);
    if (input.snmpV3Config && typeof input.snmpV3Config === "object") input.snmpV3Config = { ...existing.snmpV3Config, ...z.record(z.unknown()).parse(input.snmpV3Config) };
    const body = updateDeviceSchema.parse(input);
    if ((body.snmpVersion ?? existing.snmpVersion) === "v3" && !(body.snmpV3Config ?? existing.snmpV3Config)) throw new z.ZodError([{ code: "custom", path: ["snmpV3Config"], message: "SNMPv3 credentials are required" }]);
    const { sshPrivateKey, ...values } = body;
    const [device] = await app.db.update(devices)
      .set({ ...values, ...(sshPrivateKey ? { sshKeyEncrypted: encryptSshKey(sshPrivateKey) } : {}), updatedAt: new Date() })
      .where(eq(devices.id, id))
      .returning();
    if (!device) return reply.code(404).send({ error: "Device not found" });
    await logAudit(app.db, { userId: request.userId, action: "device.update", resource: "device", resourceId: id, details: body, ipAddress: request.ip }, request);
    if (app.pollingEngine) await app.pollingEngine.syncDevice(id);
    return device;
  });

  // Delete device
  app.delete("/:id", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [device] = await app.db.delete(devices).where(eq(devices.id, id)).returning();
    if (!device) return reply.code(404).send({ error: "Device not found" });
    await logAudit(app.db, { userId: request.userId, action: "device.delete", resource: "device", resourceId: id, ipAddress: request.ip }, request);
    if (app.pollingEngine) await app.pollingEngine.syncDevice(id);
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
