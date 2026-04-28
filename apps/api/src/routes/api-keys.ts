import type { FastifyInstance } from "fastify";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { apiKeys } from "@netpulse/shared";
import { authenticate } from "../middleware/auth.js";

const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  expiresAt: z.string().datetime().optional(),
});

export async function apiKeyRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const items = await app.db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, request.userId!));

    return { data: items };
  });

  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const body = createApiKeySchema.parse(request.body);
    const rawKey = `${randomUUID()}${randomBytes(16).toString("hex")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 8);

    const [apiKey] = await app.db
      .insert(apiKeys)
      .values({
        userId: request.userId!,
        name: body.name,
        keyHash,
        prefix,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      })
      .returning();

    return reply.code(201).send({
      ...apiKey,
      key: rawKey,
    });
  });

  app.delete("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [apiKey] = await app.db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, request.userId!)))
      .returning();
    if (!apiKey) return reply.code(404).send({ error: "API key not found" });
    return { message: "API key deleted" };
  });
}
