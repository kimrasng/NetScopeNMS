import { bodySchema } from "../services/contracts.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { users } from "@netpulse/shared";
import bcrypt from "bcryptjs";
import { logAudit } from "./audit-logs.js";
import { authenticate } from "../middleware/auth.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/**
 * Auth routes: login, me (register removed - use invitations only)
 */
export async function authRoutes(app: FastifyInstance) {
  // Login
  app.post("/login", { schema: bodySchema(loginSchema) }, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await app.db.query.users.findFirst({
      where: eq(users.email, body.email),
    });
    if (!user?.enabled || !user.passwordHash) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }
    await app.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    const token = app.jwt.sign({ id: user.id, role: user.role, authVersion: user.authVersion });
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    };
  });

  // Get current user
  app.get("/me", { preHandler: [authenticate] }, async (request) => {
    return app.db.query.users.findFirst({ where: eq(users.id, request.userId!), columns: { passwordHash: false, authVersion: false } });
  });

  // Update profile
  app.put("/profile", { preHandler: [authenticate] }, async (request, reply) => {
    const body = z.object({ name: z.string().min(1).max(255), phone: z.string().max(50).nullable().optional() }).parse(request.body);
    const [updated] = await app.db.update(users)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(users.id, request.userId!))
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role, phone: users.phone });
    if (!updated) return reply.code(404).send({ error: "User not found" });
    await logAudit(app.db, { userId: request.userId, action: "profile.update", resource: "user", resourceId: request.userId, details: body, ipAddress: request.ip }, request);
    return updated;
  });

  // Change password
  app.put("/password", { preHandler: [authenticate] }, async (request, reply) => {
    const body = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }).parse(request.body);

    const user = await app.db.query.users.findFirst({ where: eq(users.id, request.userId!) });
    if (!user?.enabled || !user.passwordHash) return reply.code(404).send({ error: "User not found" });

    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) return reply.code(400).send({ error: "Current password is incorrect" });

    const newHash = await bcrypt.hash(body.newPassword, 12);
    await app.db.update(users)
      .set({ passwordHash: newHash, authVersion: sql`${users.authVersion} + 1`, updatedAt: new Date() })
      .where(eq(users.id, request.userId!));

    await logAudit(app.db, { userId: request.userId, action: "password.update", resource: "user", resourceId: request.userId, ipAddress: request.ip }, request);
    return { ok: true, message: "Password updated; sign in again" };
  });
}
