import type { FastifyRequest, FastifyReply } from "fastify";
import { users } from "@netpulse/shared";
import { eq } from "drizzle-orm";

/**
 * JWT authentication middleware. Verifies the token and attaches user info to request.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = await request.jwtVerify<{ id: string; role: string }>();
    request.userId = decoded.id;
    request.userRole = decoded.role;

    // Fetch scope info for access control
    const result = await request.server.db.select({
      scope: users.scope,
      allowedDeviceIds: users.allowedDeviceIds,
      allowedGroupIds: users.allowedGroupIds,
    }).from(users).where(eq(users.id, decoded.id)).limit(1);

    if (result.length > 0) {
      request.userScope = result[0].scope;
      request.userAllowedDeviceIds = result[0].allowedDeviceIds || [];
      request.userAllowedGroupIds = result[0].allowedGroupIds || [];
    }
  } catch {
    reply.code(401).send({ error: "Unauthorized", message: "Invalid or expired token" });
  }
}

/**
 * Role-based access control middleware factory.
 */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    if (!request.userRole || !roles.includes(request.userRole)) {
      reply.code(403).send({ error: "Forbidden", message: "Insufficient permissions" });
    }
  };
}
