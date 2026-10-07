import { bodySchema } from "../services/contracts.js";
import type { FastifyInstance } from "fastify";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { apiKeys } from "@netpulse/shared";
import { authenticate } from "../middleware/auth.js";

const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  expiresAt: z.string().refine(value => /^\d{4}-\d{2}-\d{2}$/.test(value) || z.string().datetime({ offset: true }).safeParse(value).success, "Use an ISO date or datetime").transform(value => value.length === 10 ? `${value}T23:59:59.999Z` : value).refine(value => Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now(), "Expiry must be a future date").optional(),
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

  app.post("/", { schema: bodySchema(createApiKeySchema), preHandler: [authenticate] }, async (request, reply) => {
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
      id: apiKey.id, name: apiKey.name, prefix: apiKey.prefix, expiresAt: apiKey.expiresAt, createdAt: apiKey.createdAt,
      rawKey, key: rawKey,
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
