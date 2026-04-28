import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { users, userInvitations, systemSettings } from "@netpulse/shared";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { requireRole } from "../middleware/auth.js";
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
  allowedDeviceIds: z.array(z.string()).default([]),
  allowedGroupIds: z.array(z.string()).default([]),
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

async function upsertSetting(db: any, key: string, value: string) {
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
  app.put("/site", {
    preHandler: [requireRole("super_admin", "admin")],
  }, async (request: any) => {
    const body = siteSettingsSchema.parse(request.body);
    if (body.siteName !== undefined) await upsertSetting(app.db, "site_name", body.siteName);
    if (body.logoUrl !== undefined) await upsertSetting(app.db, "logo_url", body.logoUrl);
    await logAudit(app.db, { userId: request.userId, action: "setup.site-update", resource: "site-settings", details: body, ipAddress: request.ip });
    return { ok: true };
  });

  // Initial admin setup
  app.post("/init", async (request, reply) => {
    const allUsers = await app.db.select({ id: users.id }).from(users).limit(1);
    if (allUsers.length > 0) return reply.code(403).send({ error: "Setup already completed" });

    const body = setupSchema.parse(request.body);
    const passwordHash = await bcrypt.hash(body.password, 12);
    const [user] = await app.db.insert(users).values({
      email: body.email, passwordHash, name: body.name, role: "super_admin", scope: "all",
    }).returning({ id: users.id, email: users.email, name: users.name, role: users.role });

    if (body.siteName) await upsertSetting(app.db, "site_name", body.siteName);
    if (body.logoUrl) await upsertSetting(app.db, "logo_url", body.logoUrl);

    const token = app.jwt.sign({ id: user.id, role: user.role });
    return reply.code(201).send({ user, token });
  });

  // Create invitation link (admin only)
  app.post("/invite", {
    preHandler: [requireRole("super_admin", "admin")],
  }, async (request: any, reply: any) => {
    const body = inviteSchema.parse(request.body);
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [invitation] = await app.db.insert(userInvitations).values({
      email: body.email, token: inviteToken, role: body.role as any, scope: body.scope,
      allowedDeviceIds: body.allowedDeviceIds, allowedGroupIds: body.allowedGroupIds,
      invitedBy: request.userId!, expiresAt,
    }).returning();

    await logAudit(app.db, { userId: request.userId!, action: "setup.invite-create", resource: "invitation", resourceId: invitation.id, details: { email: body.email, role: body.role }, ipAddress: request.ip });
    return reply.code(201).send({ invitation, inviteUrl: `/auth/invite?token=${inviteToken}` });
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
  app.post("/invite/accept", async (request, reply) => {
    const body = acceptInviteSchema.parse(request.body);
    const invitation = await app.db.query.userInvitations.findFirst({ where: eq(userInvitations.token, body.token) });
    if (!invitation) return reply.code(404).send({ error: "Invitation not found" });
    if (invitation.usedAt) return reply.code(410).send({ error: "Invitation already used" });
    if (new Date() > invitation.expiresAt) return reply.code(410).send({ error: "Invitation expired" });

    const existing = await app.db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (existing) return reply.code(409).send({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(body.password, 12);
    const [user] = await app.db.insert(users).values({
      email: body.email, passwordHash, name: body.name, role: invitation.role,
      scope: invitation.scope, allowedDeviceIds: invitation.allowedDeviceIds, allowedGroupIds: invitation.allowedGroupIds,
    }).returning({ id: users.id, email: users.email, name: users.name, role: users.role });

    await app.db.update(userInvitations).set({ usedAt: new Date() }).where(eq(userInvitations.id, invitation.id));
    const token = app.jwt.sign({ id: user.id, role: user.role });
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

  // Delete user (super_admin only)
  app.delete("/users/:id", {
    preHandler: [requireRole("super_admin")],
  }, async (request: any) => {
    const { id } = request.params as { id: string };
    await app.db.delete(users).where(eq(users.id, id));
    await logAudit(app.db, { userId: request.userId!, action: "setup.user-delete", resource: "user", resourceId: id, ipAddress: request.ip });
    return { ok: true };
  });
}
