import { bodySchema } from "../services/contracts.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, isNull, gt, sql } from "drizzle-orm";
import { users, userInvitations, systemSettings, type Database } from "@netpulse/shared";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../services/access.js";
import { logAudit } from "./audit-logs.js";

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  siteName: z.string().min(1).optional(),
  logoUrl: z.string().optional(),
});

const inviteSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(["admin", "operator", "viewer"]),
  scope: z.enum(["all", "restricted"]).default("all"),
  allowedDeviceIds: z.array(z.string().uuid()).default([]),
  allowedGroupIds: z.array(z.string().uuid()).default([]),
});

const acceptInviteSchema = z.object({
  token: z.string(),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const siteSettingsSchema = z.object({
  siteName: z.string().min(1).optional(),
  logoUrl: z.string().optional(),
});

async function upsertSetting(db: Pick<Database, "select" | "insert" | "update">, key: string, value: string) {
  const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  if (existing.length > 0) {
    await db.update(systemSettings).set({ value, updatedAt: new Date() }).where(eq(systemSettings.key, key));
  } else {
    await db.insert(systemSettings).values({ key, value });
  }
}

export async function setupRoutes(app: FastifyInstance) {
  // Check if initial setup is needed
  app.get("/status", async () => {
    const allUsers = await app.db.select({ id: users.id }).from(users).limit(1);
    return { needsSetup: allUsers.length === 0 };
  });

  // Get site settings (public)
  app.get("/site", async () => {
    const rows = await app.db.select().from(systemSettings);
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    return {
      siteName: settings["site_name"] || "NetPulse",
      logoUrl: settings["logo_url"] || "",
    };
  });

  // Update site settings (admin only)
  app.put("/site", { schema: bodySchema(siteSettingsSchema),
    preHandler: [requireRole("super_admin", "admin")],
  }, async (request) => {
    const body = siteSettingsSchema.parse(request.body);
    if (body.siteName !== undefined) await upsertSetting(app.db, "site_name", body.siteName);
    if (body.logoUrl !== undefined) await upsertSetting(app.db, "logo_url", body.logoUrl);
    await logAudit(app.db, { userId: request.userId, action: "setup.site-update", resource: "site-settings", details: body, ipAddress: request.ip }, request);
    return { ok: true };
  });

  // Initial admin setup
  app.post("/init", { schema: bodySchema(setupSchema) }, async (request, reply) => {
    const body = setupSchema.parse(request.body);
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await app.db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(70512001)`);
      if ((await tx.select({ id: users.id }).from(users).limit(1)).length) throw new HttpError(403, "Setup already completed");
      const [created] = await tx.insert(users).values({ email: body.email.toLowerCase(), passwordHash, name: body.name, role: "super_admin", scope: "all" }).returning({ id: users.id, email: users.email, name: users.name, role: users.role });
      if (body.siteName) await upsertSetting(tx, "site_name", body.siteName);
      if (body.logoUrl) await upsertSetting(tx, "logo_url", body.logoUrl);
      return created;
    });

    const token = app.jwt.sign({ id: user.id, role: user.role, authVersion: 0 });
    return reply.code(201).send({ user, token });
  });

  // Create invitation link (admin only)
  app.post("/invite", { schema: bodySchema(inviteSchema),
    preHandler: [requireRole("super_admin", "admin")],
  }, async (request, reply) => {
    const body = inviteSchema.parse(request.body);
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [invitation] = await app.db.insert(userInvitations).values({
      email: body.email, token: inviteToken, role: body.role, scope: body.scope,
      allowedDeviceIds: body.allowedDeviceIds, allowedGroupIds: body.allowedGroupIds,
      invitedBy: request.userId!, expiresAt,
    }).returning();

    await logAudit(app.db, { userId: request.userId!, action: "setup.invite-create", resource: "invitation", resourceId: invitation.id, details: { email: body.email, role: body.role }, ipAddress: request.ip }, request);
    return reply.code(201).send({ invitation, inviteUrl: new URL(`/invite?token=${inviteToken}`, process.env.WEB_ORIGIN ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000").toString() });
  });

  // Get invitation details by token (public)
  app.get("/invite/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const invitation = await app.db.query.userInvitations.findFirst({ where: eq(userInvitations.token, token) });
    if (!invitation) return reply.code(404).send({ error: "Invitation not found" });
    if (invitation.usedAt) return reply.code(410).send({ error: "Invitation already used" });
    if (new Date() > invitation.expiresAt) return reply.code(410).send({ error: "Invitation expired" });
    return { email: invitation.email, role: invitation.role, scope: invitation.scope, expiresAt: invitation.expiresAt };
  });

  // Accept invitation (public)
  app.post("/invite/accept", { schema: bodySchema(acceptInviteSchema) }, async (request, reply) => {
    const body = acceptInviteSchema.parse(request.body);
    const invitation = await app.db.query.userInvitations.findFirst({ where: eq(userInvitations.token, body.token) });
    if (!invitation) return reply.code(404).send({ error: "Invitation not found" });
    if (invitation.usedAt) return reply.code(410).send({ error: "Invitation already used" });
    if (new Date() > invitation.expiresAt) return reply.code(410).send({ error: "Invitation expired" });

    if (invitation.email && invitation.email.toLowerCase() !== body.email.toLowerCase()) return reply.code(400).send({ error: "Email must match the invitation" });
    const existing = await app.db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (existing) return reply.code(409).send({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await app.db.transaction(async (tx) => {
      const [claimed] = await tx.update(userInvitations).set({ usedAt: new Date() })
        .where(and(eq(userInvitations.id, invitation.id), isNull(userInvitations.usedAt), gt(userInvitations.expiresAt, new Date()))).returning();
      if (!claimed) throw Object.assign(new Error("Invitation expired or already used"), { statusCode: 410 });
      const [created] = await tx.insert(users).values({
        email: body.email.toLowerCase(), passwordHash, name: body.name, role: invitation.role,
        scope: invitation.scope, allowedDeviceIds: invitation.allowedDeviceIds, allowedGroupIds: invitation.allowedGroupIds,
      }).returning({ id: users.id, email: users.email, name: users.name, role: users.role });
      return created;
    });
    await logAudit(app.db, { userId: user.id, action: "invitation.accept", resource: "invitation", resourceId: invitation.id, ipAddress: request.ip }, request);
    const token = app.jwt.sign({ id: user.id, role: user.role, authVersion: 0 });
    return reply.code(201).send({ user, token });
  });

  // List invitations (admin only)
  app.get("/invitations", {
    preHandler: [requireRole("super_admin", "admin")],
  }, async () => app.db.select().from(userInvitations).orderBy(userInvitations.createdAt));

  // List users (admin only)
  app.get("/users", {
    preHandler: [requireRole("super_admin", "admin")],
  }, async () => app.db.select({
    id: users.id, email: users.email, name: users.name, role: users.role,
    scope: users.scope, allowedDeviceIds: users.allowedDeviceIds, allowedGroupIds: users.allowedGroupIds,
    enabled: users.enabled, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
  }).from(users).orderBy(users.createdAt));

  app.put("/users/:id", { preHandler: [requireRole("super_admin")] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = z.object({ role: z.enum(["super_admin", "admin", "operator", "viewer"]).optional(), enabled: z.boolean().optional(), scope: z.enum(["all", "restricted"]).optional(), allowedDeviceIds: z.array(z.string().uuid()).optional(), allowedGroupIds: z.array(z.string().uuid()).optional() }).parse(request.body);
    if (id === request.userId && (body.enabled === false || (body.role && body.role !== "super_admin") || body.scope === "restricted")) throw new HttpError(400, "Keep your administrator access; use another administrator to change this account");
    const [updated] = await app.db.update(users).set({ ...body, authVersion: sql`${users.authVersion} + 1`, updatedAt: new Date() }).where(eq(users.id, id)).returning({ id: users.id });
    if (!updated) throw new HttpError(404, "User not found");
    return updated;
  });

  // Delete user (super_admin only)
  app.delete("/users/:id", {
    preHandler: [requireRole("super_admin")],
  }, async (request) => {
    const { id } = request.params as { id: string };
    if (id === request.userId) throw new HttpError(400, "You cannot delete your own account");
    const [deleted] = await app.db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    if (!deleted) throw new HttpError(404, "User not found");
    await logAudit(app.db, { userId: request.userId!, action: "setup.user-delete", resource: "user", resourceId: id, ipAddress: request.ip }, request);
    return { ok: true };
  });
}
