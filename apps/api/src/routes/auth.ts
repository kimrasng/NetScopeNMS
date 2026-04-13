import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { users } from "@netpulse/shared";
import bcrypt from "bcryptjs";
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
  app.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await app.db.query.users.findFirst({
      where: eq(users.email, body.email),
    });
    if (!user || !user.passwordHash) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }
    await app.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    const token = app.jwt.sign({ id: user.id, role: user.role });
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    };
  });

  // Get current user
  app.get("/me", { preHandler: [async (req: any, rep: any) => {
    try {
      const decoded = await req.jwtVerify();
      req.userId = decoded.id;
    } catch {
      rep.code(401).send({ error: "Unauthorized" });
    }
  }] }, async (request: any) => {
    const user = await app.db.query.users.findFirst({
      where: eq(users.id, request.userId!),
      columns: { passwordHash: false },
    });
    return user;
  });

  // Update profile
  app.put("/profile", { preHandler: [authenticate] }, async (request, reply) => {
    const body = z.object({ name: z.string().min(1).max(255) }).parse(request.body);
    const [updated] = await app.db.update(users)
      .set({ name: body.name, updatedAt: new Date() })
      .where(eq(users.id, request.userId!))
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role });
    if (!updated) return reply.code(404).send({ error: "User not found" });
    return updated;
  });

  // Change password
  app.put("/password", { preHandler: [authenticate] }, async (request, reply) => {
    const body = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }).parse(request.body);

    const user = await app.db.query.users.findFirst({ where: eq(users.id, request.userId!) });
    if (!user || !user.passwordHash) return reply.code(404).send({ error: "User not found" });

    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) return reply.code(400).send({ error: "Current password is incorrect" });

    const newHash = await bcrypt.hash(body.newPassword, 12);
    await app.db.update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, request.userId!));

    return { ok: true, message: "Password updated" };
  });
}
