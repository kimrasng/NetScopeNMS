import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import { createDb, users } from "@netpulse/shared";
import { authenticate, requireRole } from "../middleware/auth.js";
import { registerRequestPolicy } from "../services/request-policy.js";

const fixture: typeof users.$inferSelect = {
  id: "d39818bf-5095-4441-a5d2-1618b4f2a3f3", email: "fixture@example.test", name: "Fixture", passwordHash: null,
  authVersion: 0, role: "operator", phone: null, telegramChatId: null, avatarUrl: null, onCall: false,
  provider: "local", providerId: null, enabled: true, scope: "all", allowedDeviceIds: [], allowedGroupIds: [],
  lastLoginAt: null, createdAt: new Date(), updatedAt: new Date(),
};
let app: FastifyInstance;
let connection: ReturnType<typeof createDb>;
beforeEach(async () => {
  connection = createDb("postgresql://unused:unused@127.0.0.1:1/unused");
  vi.spyOn(connection.db.query.users, "findFirst").mockResolvedValue(fixture);
  app = Fastify();
  app.decorate("db", connection.db);
  await app.register(jwt, { secret: "unit-test-only-secret" });
  registerRequestPolicy(app);
  app.get("/secured", { preHandler: authenticate }, async request => ({ id: request.userId, role: request.userRole, scope: request.userScope }));
  app.get("/operator", { preHandler: requireRole("operator", "admin") }, async () => ({ ok: true }));
});
afterEach(async () => { await app.close(); await connection.client.end(); vi.restoreAllMocks(); });
const headers = (role = "operator", authVersion = 0) => ({ authorization: `Bearer ${app.jwt.sign({ id: fixture.id, role, authVersion })}` });
describe("Authentication lifecycle", () => {
  it("authenticates an enabled account using its current database role", async () => {
    const response = await app.inject({ url: "/secured", headers: headers("admin") });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: fixture.id, role: "operator", scope: "all" });
  });
  it("denies a deleted account despite a valid JWT", async () => {
    vi.mocked(connection.db.query.users.findFirst).mockResolvedValue(undefined);
    expect((await app.inject({ url: "/secured", headers: headers() })).statusCode).toBe(401);
  });
  it("denies a disabled account despite a valid JWT", async () => {
    vi.mocked(connection.db.query.users.findFirst).mockResolvedValue({ ...fixture, enabled: false });
    expect((await app.inject({ url: "/secured", headers: headers() })).statusCode).toBe(401);
  });
  it("applies a downgrade without waiting for JWT expiry", async () => {
    vi.mocked(connection.db.query.users.findFirst).mockResolvedValue({ ...fixture, role: "viewer" });
    expect((await app.inject({ url: "/operator", headers: headers() })).statusCode).toBe(403);
  });
  it("revokes an old session after credential version changes", async () => {
    vi.mocked(connection.db.query.users.findFirst).mockResolvedValue({ ...fixture, authVersion: 1 });
    expect((await app.inject({ url: "/secured", headers: headers() })).statusCode).toBe(401);
  });
  it("rejects missing and invalid credentials", async () => {
    expect((await app.inject({ url: "/operator" })).statusCode).toBe(401);
    expect((await app.inject({ url: "/secured", headers: { authorization: "Bearer invalid.jwt.signature" } })).statusCode).toBe(401);
  });
});
