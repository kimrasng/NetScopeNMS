import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Auth Middleware", () => {
  describe("authenticate", () => {
    it("sets userId and userRole from JWT payload", async () => {
      const request = {
        jwtVerify: vi.fn().mockResolvedValue({ id: "user-1", role: "admin" }),
        server: {
          db: {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{
                    scope: "all",
                    allowedDeviceIds: ["dev-1"],
                    allowedGroupIds: ["grp-1"],
                  }]),
                }),
              }),
            }),
          },
        },
      } as any;

      const reply = { code: vi.fn().mockReturnThis(), send: vi.fn(), sent: false } as any;

      const { authenticate } = await import("../middleware/auth.js");
      await authenticate(request, reply);

      expect(request.userId).toBe("user-1");
      expect(request.userRole).toBe("admin");
      expect(request.userScope).toBe("all");
      expect(request.userAllowedDeviceIds).toEqual(["dev-1"]);
      expect(request.userAllowedGroupIds).toEqual(["grp-1"]);
    });

    it("defaults allowedDeviceIds and allowedGroupIds to empty arrays", async () => {
      const request = {
        jwtVerify: vi.fn().mockResolvedValue({ id: "user-2", role: "viewer" }),
        server: {
          db: {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{
                    scope: "limited",
                    allowedDeviceIds: null,
                    allowedGroupIds: null,
                  }]),
                }),
              }),
            }),
          },
        },
      } as any;

      const reply = { code: vi.fn().mockReturnThis(), send: vi.fn(), sent: false } as any;

      const { authenticate } = await import("../middleware/auth.js");
      await authenticate(request, reply);

      expect(request.userAllowedDeviceIds).toEqual([]);
      expect(request.userAllowedGroupIds).toEqual([]);
    });

    it("returns 401 when JWT verification fails", async () => {
      const request = {
        jwtVerify: vi.fn().mockRejectedValue(new Error("Invalid token")),
      } as any;

      const reply = { code: vi.fn().mockReturnThis(), send: vi.fn(), sent: false } as any;

      const { authenticate } = await import("../middleware/auth.js");
      await authenticate(request, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Invalid or expired token",
      });
    });

    it("does not set user properties when no DB result found", async () => {
      const request = {
        jwtVerify: vi.fn().mockResolvedValue({ id: "user-3", role: "viewer" }),
        server: {
          db: {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          },
        },
      } as any;

      const reply = { code: vi.fn().mockReturnThis(), send: vi.fn(), sent: false } as any;

      const { authenticate } = await import("../middleware/auth.js");
      await authenticate(request, reply);

      expect(request.userId).toBe("user-3");
      expect(request.userRole).toBe("viewer");
      expect(request.userScope).toBeUndefined();
    });
  });

  describe("requireRole", () => {
    it("allows request when user has required role", async () => {
      const request = {
        jwtVerify: vi.fn().mockResolvedValue({ id: "user-1", role: "admin" }),
        server: {
          db: {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ scope: "all", allowedDeviceIds: [], allowedGroupIds: [] }]),
                }),
              }),
            }),
          },
        },
      } as any;

      const reply = { code: vi.fn().mockReturnThis(), send: vi.fn(), sent: false } as any;

      const { requireRole } = await import("../middleware/auth.js");
      const middleware = requireRole("admin", "operator");
      await middleware(request, reply);

      expect(reply.code).not.toHaveBeenCalledWith(403);
    });

    it("returns 403 when user lacks required role", async () => {
      const request = {
        jwtVerify: vi.fn().mockResolvedValue({ id: "user-1", role: "viewer" }),
        server: {
          db: {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ scope: "all", allowedDeviceIds: [], allowedGroupIds: [] }]),
                }),
              }),
            }),
          },
        },
      } as any;

      const reply = { code: vi.fn().mockReturnThis(), send: vi.fn(), sent: false } as any;

      const { requireRole } = await import("../middleware/auth.js");
      const middleware = requireRole("admin");
      await middleware(request, reply);

      expect(reply.code).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        error: "Forbidden",
        message: "Insufficient permissions",
      });
    });

    it("short-circuits when authenticate already sent 401", async () => {
      const request = {
        jwtVerify: vi.fn().mockRejectedValue(new Error("bad token")),
      } as any;

      const codeFn = vi.fn().mockReturnThis();
      const sendFn = vi.fn().mockImplementation(function (this: any) {
        reply.sent = true;
      });
      const reply = { code: codeFn, send: sendFn, sent: false } as any;

      const { requireRole } = await import("../middleware/auth.js");
      const middleware = requireRole("admin");
      await middleware(request, reply);

      expect(codeFn).toHaveBeenCalledWith(401);
      expect(codeFn).not.toHaveBeenCalledWith(403);
    });
  });
});
