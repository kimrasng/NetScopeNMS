import type { FastifyRequest, FastifyReply } from "fastify";
import { apiKeys } from "@netpulse/shared";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { loadPrincipal, HttpError } from "../services/access.js";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  if (request.userId) return;
  const token = request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply.code(401).send({ error: "Unauthorized", message: "Authentication required" });
  let id: string;
  let authVersion: number | undefined;
  if (token.split(".").length === 3) {
    try {
      const decoded = await request.jwtVerify<{ id: string; authVersion?: number }>();
      id = decoded.id;
      authVersion = decoded.authVersion ?? 0;
    } catch {
      return reply.code(401).send({ error: "Unauthorized", message: "Invalid or expired token" });
    }
  } else {
    const keyHash = createHash("sha256").update(token).digest("hex");
    const key = await request.server.db.query.apiKeys.findFirst({ where: eq(apiKeys.keyHash, keyHash) });
    if (!key || (key.expiresAt && key.expiresAt <= new Date())) {
      return reply.code(401).send({ error: "Unauthorized", message: "Invalid or expired API key" });
    }
    id = key.userId;
    await request.server.db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
  }
  const { user, deviceIds } = await loadPrincipal(request.server.db, id);
  if (authVersion !== undefined && authVersion !== user.authVersion) throw new HttpError(401, "Session revoked");
  request.userId = user.id;
  request.userRole = user.role;
  request.userScope = user.scope;
  request.userAllowedDeviceIds = user.allowedDeviceIds ?? [];
  request.userAllowedGroupIds = user.allowedGroupIds ?? [];
  request.userDeviceIds = deviceIds;
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    if (!request.userRole || !roles.includes(request.userRole)) {
      return reply.code(403).send({ error: "Forbidden", message: "Insufficient permissions" });
    }
  };
}
