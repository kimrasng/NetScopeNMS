import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";
import { eq, sql, desc } from "drizzle-orm";
import { configSnapshots } from "@netpulse/shared";
import { authenticate, requireRole } from "../middleware/auth.js";
import { logAudit } from "./audit-logs.js";

const createSnapshotSchema = z.object({
  deviceId: z.string().uuid(),
  configText: z.string().min(1),
});

export async function configSnapshotRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as { deviceId?: string; page?: string; limit?: string };
    const page = parseInt(query.page || "1", 10);
    const limit = Math.min(parseInt(query.limit || "50", 10), 200);
    const offset = (page - 1) * limit;

    const where = query.deviceId ? eq(configSnapshots.deviceId, query.deviceId) : undefined;

    const [items, countResult] = await Promise.all([
      app.db.select().from(configSnapshots).where(where).limit(limit).offset(offset).orderBy(desc(configSnapshots.capturedAt)),
      app.db.select({ count: sql<number>`count(*)` }).from(configSnapshots).where(where),
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
    const [snapshot] = await app.db.select().from(configSnapshots).where(eq(configSnapshots.id, id));
    if (!snapshot) return reply.code(404).send({ error: "Config snapshot not found" });
    return snapshot;
  });

  app.post("/", { preHandler: [requireRole("super_admin", "admin", "operator")] }, async (request, reply) => {
    const body = createSnapshotSchema.parse(request.body);
    const hash = createHash("sha256").update(body.configText).digest("hex");

    const [previous] = await app.db
      .select()
      .from(configSnapshots)
      .where(eq(configSnapshots.deviceId, body.deviceId))
      .orderBy(desc(configSnapshots.capturedAt))
      .limit(1);

    const diff = previous ? computeDiff(previous.configText, body.configText) : "Initial snapshot";

    const [snapshot] = await app.db
      .insert(configSnapshots)
      .values({ deviceId: body.deviceId, configText: body.configText, hash, diff })
      .returning();

    await logAudit(app.db, { userId: request.userId, action: "config-snapshot.create", resource: "config-snapshot", resourceId: snapshot.id, details: { deviceId: body.deviceId }, ipAddress: request.ip });
    return reply.code(201).send(snapshot);
  });

  app.get("/:id1/diff/:id2", { preHandler: [authenticate] }, async (request, reply) => {
    const { id1, id2 } = request.params as { id1: string; id2: string };
    const [snap1, snap2] = await Promise.all([
      app.db.select().from(configSnapshots).where(eq(configSnapshots.id, id1)).then(r => r[0]),
      app.db.select().from(configSnapshots).where(eq(configSnapshots.id, id2)).then(r => r[0]),
    ]);
    if (!snap1) return reply.code(404).send({ error: "Snapshot id1 not found" });
    if (!snap2) return reply.code(404).send({ error: "Snapshot id2 not found" });

    const oldLines = snap1.configText.split("\n");
    const newLines = snap2.configText.split("\n");
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    const added = newLines.filter(l => !oldSet.has(l));
    const removed = oldLines.filter(l => !newSet.has(l));
    const unchanged = oldLines.filter(l => newSet.has(l)).length;

    return { added, removed, unchanged };
  });

  app.delete("/:id", { preHandler: [requireRole("super_admin", "admin", "operator")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [snapshot] = await app.db.delete(configSnapshots).where(eq(configSnapshots.id, id)).returning();
    if (!snapshot) return reply.code(404).send({ error: "Config snapshot not found" });
    await logAudit(app.db, { userId: request.userId, action: "config-snapshot.delete", resource: "config-snapshot", resourceId: id, ipAddress: request.ip });
    return { message: "Config snapshot deleted" };
  });
}

function computeDiff(oldText: string, newText: string): string {
  if (oldText === newText) return "No changes";
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const lines: string[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= oldLines.length) {
      lines.push(`+ ${newLines[i]}`);
    } else if (i >= newLines.length) {
      lines.push(`- ${oldLines[i]}`);
    } else if (oldLines[i] !== newLines[i]) {
      lines.push(`- ${oldLines[i]}`);
      lines.push(`+ ${newLines[i]}`);
    }
  }
  return lines.join("\n");
}
