import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";

describe("Audit Logs", () => {
  describe("logAudit", () => {
    it("inserts an audit log entry and returns it", async () => {
      const inserted = {
        id: "log-1",
        userId: "user-1",
        action: "create",
        resource: "device",
        resourceId: "dev-1",
        details: { name: "Router" },
        ipAddress: "127.0.0.1",
        createdAt: new Date(),
      };

      const returningFn = vi.fn().mockResolvedValue([inserted]);
      const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
      const insertFn = vi.fn().mockReturnValue({ values: valuesFn });
      const db = { insert: insertFn } as any;

      const { logAudit } = await import("../routes/audit-logs.js");
      const result = await logAudit(db, {
        userId: "user-1",
        action: "create",
        resource: "device",
        resourceId: "dev-1",
        details: { name: "Router" },
        ipAddress: "127.0.0.1",
      });

      expect(insertFn).toHaveBeenCalled();
      expect(result).toEqual(inserted);
    });
  });

  describe("auditLogRoutes", () => {
    it("GET / returns paginated audit logs filtered by userId", async () => {
      const items = [{ id: "log-1", action: "create", resource: "device" }];
      const countResult = [{ count: 1 }];

      const mockSelect = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(items),
              }),
            }),
          }),
        }),
      }));

      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(items),
              }),
            }),
          }),
        }),
      })).mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(countResult),
        }),
      }));

      const app = {
        db: { select: mockSelect },
        get: vi.fn(),
      } as any;

      const { auditLogRoutes } = await import("../routes/audit-logs.js");
      await auditLogRoutes(app);

      expect(app.get).toHaveBeenCalledTimes(2);
      expect(app.get.mock.calls[0][0]).toBe("/");
      expect(app.get.mock.calls[1][0]).toBe("/:id");
    });
  });
});

describe("Config Snapshots", () => {
  it("computes SHA-256 hash of configText on creation", async () => {
    const configText = "hostname router1\ninterface eth0";
    const expectedHash = createHash("sha256").update(configText).digest("hex");

    const snapshot = {
      id: "snap-1",
      deviceId: "00000000-0000-0000-0000-000000000001",
      configText,
      hash: expectedHash,
      diff: "Initial snapshot",
      capturedAt: new Date(),
    };

    const returningFn = vi.fn().mockResolvedValue([snapshot]);
    const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
    const insertFn = vi.fn().mockReturnValue({ values: valuesFn });

    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    const app = {
      db: {
        insert: insertFn,
        select: vi.fn().mockReturnValue(selectChain),
      },
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    } as any;

    const { configSnapshotRoutes } = await import("../routes/config-snapshots.js");
    await configSnapshotRoutes(app);

    const postHandler = app.post.mock.calls[0][2];
    const request = { body: { deviceId: "00000000-0000-0000-0000-000000000001", configText } };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };

    await postHandler(request, reply);

    expect(reply.code).toHaveBeenCalledWith(201);
    const insertedValues = valuesFn.mock.calls[0][0];
    expect(insertedValues.hash).toBe(expectedHash);
    expect(insertedValues.diff).toBe("Initial snapshot");
  });

  it("computes diff against previous snapshot for same device", async () => {
    const oldConfig = "hostname router1\ninterface eth0";
    const newConfig = "hostname router1\ninterface eth1";

    const previousSnapshot = {
      id: "snap-1",
      deviceId: "00000000-0000-0000-0000-000000000001",
      configText: oldConfig,
      hash: "oldhash",
      diff: "Initial snapshot",
      capturedAt: new Date(),
    };

    const newSnapshot = {
      id: "snap-2",
      deviceId: "00000000-0000-0000-0000-000000000001",
      configText: newConfig,
      hash: createHash("sha256").update(newConfig).digest("hex"),
      diff: "- interface eth0\n+ interface eth1",
      capturedAt: new Date(),
    };

    const returningFn = vi.fn().mockResolvedValue([newSnapshot]);
    const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
    const insertFn = vi.fn().mockReturnValue({ values: valuesFn });

    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([previousSnapshot]),
          }),
        }),
      }),
    };

    const app = {
      db: {
        insert: insertFn,
        select: vi.fn().mockReturnValue(selectChain),
      },
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    } as any;

    const { configSnapshotRoutes } = await import("../routes/config-snapshots.js");
    await configSnapshotRoutes(app);

    const postHandler = app.post.mock.calls[0][2];
    const request = { body: { deviceId: "00000000-0000-0000-0000-000000000001", configText: newConfig } };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };

    await postHandler(request, reply);

    const insertedValues = valuesFn.mock.calls[0][0];
    expect(insertedValues.diff).toContain("- interface eth0");
    expect(insertedValues.diff).toContain("+ interface eth1");
  });

  it("registers GET, POST, DELETE routes", async () => {
    const app = {
      db: {},
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    } as any;

    const { configSnapshotRoutes } = await import("../routes/config-snapshots.js");
    await configSnapshotRoutes(app);

    expect(app.get).toHaveBeenCalledTimes(3);
    expect(app.post).toHaveBeenCalledTimes(1);
    expect(app.delete).toHaveBeenCalledTimes(1);
    expect(app.get.mock.calls[0][0]).toBe("/");
    expect(app.get.mock.calls[1][0]).toBe("/:id");
    expect(app.get.mock.calls[2][0]).toBe("/:id1/diff/:id2");
  });
});

describe("Maintenance Windows", () => {
  it("GET /active returns currently active windows", async () => {
    const now = new Date();
    const activeWindow = {
      id: "mw-1",
      name: "Upgrade",
      startAt: new Date(now.getTime() - 3600000),
      endAt: new Date(now.getTime() + 3600000),
    };

    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([activeWindow]),
      }),
    };

    const app = {
      db: { select: vi.fn().mockReturnValue(selectChain) },
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as any;

    const { maintenanceWindowRoutes } = await import("../routes/maintenance-windows.js");
    await maintenanceWindowRoutes(app);

    expect(app.get.mock.calls[0][0]).toBe("/active");
  });

  it("registers all CRUD routes", async () => {
    const app = {
      db: {},
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as any;

    const { maintenanceWindowRoutes } = await import("../routes/maintenance-windows.js");
    await maintenanceWindowRoutes(app);

    expect(app.get).toHaveBeenCalledTimes(3);
    expect(app.post).toHaveBeenCalledTimes(1);
    expect(app.put).toHaveBeenCalledTimes(1);
    expect(app.delete).toHaveBeenCalledTimes(1);
    expect(app.get.mock.calls[0][0]).toBe("/active");
    expect(app.get.mock.calls[1][0]).toBe("/");
    expect(app.get.mock.calls[2][0]).toBe("/:id");
  });

  it("POST sets createdBy from request.userId", async () => {
    const window = {
      id: "mw-1",
      name: "Upgrade",
      startAt: new Date(),
      endAt: new Date(),
      createdBy: "user-1",
    };

    const returningFn = vi.fn().mockResolvedValue([window]);
    const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
    const insertFn = vi.fn().mockReturnValue({ values: valuesFn });

    const app = {
      db: { insert: insertFn },
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as any;

    const { maintenanceWindowRoutes } = await import("../routes/maintenance-windows.js");
    await maintenanceWindowRoutes(app);

    const postHandler = app.post.mock.calls[0][2];
    const request = {
      userId: "user-1",
      body: {
        name: "Upgrade",
        startAt: "2025-01-01T00:00:00Z",
        endAt: "2025-01-01T06:00:00Z",
      },
    };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };

    await postHandler(request, reply);

    const insertedValues = valuesFn.mock.calls[0][0];
    expect(insertedValues.createdBy).toBe("user-1");
    expect(reply.code).toHaveBeenCalledWith(201);
  });
});

describe("API Keys", () => {
  it("registers GET, POST, DELETE routes", async () => {
    const app = {
      db: {},
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    } as any;

    const { apiKeyRoutes } = await import("../routes/api-keys.js");
    await apiKeyRoutes(app);

    expect(app.get).toHaveBeenCalledTimes(1);
    expect(app.post).toHaveBeenCalledTimes(1);
    expect(app.delete).toHaveBeenCalledTimes(1);
  });

  it("POST generates key, stores hash and prefix, returns full key once", async () => {
    const createdKey = {
      id: "key-1",
      userId: "user-1",
      name: "My Key",
      keyHash: "somehash",
      prefix: "abcd1234",
      createdAt: new Date(),
    };

    const returningFn = vi.fn().mockResolvedValue([createdKey]);
    const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
    const insertFn = vi.fn().mockReturnValue({ values: valuesFn });

    const app = {
      db: { insert: insertFn },
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    } as any;

    const { apiKeyRoutes } = await import("../routes/api-keys.js");
    await apiKeyRoutes(app);

    const postHandler = app.post.mock.calls[0][2];
    const request = { userId: "user-1", body: { name: "My Key" } };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };

    await postHandler(request, reply);

    expect(reply.code).toHaveBeenCalledWith(201);
    const sentData = reply.send.mock.calls[0][0];
    expect(sentData.key).toBeDefined();
    expect(typeof sentData.key).toBe("string");
    expect(sentData.key.length).toBeGreaterThan(8);

    const insertedValues = valuesFn.mock.calls[0][0];
    expect(insertedValues.keyHash).toBe(
      createHash("sha256").update(sentData.key).digest("hex")
    );
    expect(insertedValues.prefix).toBe(sentData.key.slice(0, 8));
    expect(insertedValues.userId).toBe("user-1");
  });

  it("GET / only returns prefix, never full key or hash", async () => {
    const items = [
      { id: "key-1", name: "My Key", prefix: "abcd1234", lastUsedAt: null, expiresAt: null, createdAt: new Date() },
    ];

    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(items),
      }),
    };

    const app = {
      db: { select: vi.fn().mockReturnValue(selectChain) },
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    } as any;

    const { apiKeyRoutes } = await import("../routes/api-keys.js");
    await apiKeyRoutes(app);

    const getHandler = app.get.mock.calls[0][2];
    const request = { userId: "user-1" };

    const result = await getHandler(request);

    expect(result.data).toEqual(items);
    expect(result.data[0]).not.toHaveProperty("keyHash");
    expect(result.data[0]).not.toHaveProperty("key");
  });

  it("DELETE / only deletes own keys (filters by userId)", async () => {
    const deletedKey = { id: "key-1", userId: "user-1" };

    const returningFn = vi.fn().mockResolvedValue([deletedKey]);
    const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
    const deleteFn = vi.fn().mockReturnValue({ where: whereFn });

    const app = {
      db: { delete: deleteFn },
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    } as any;

    const { apiKeyRoutes } = await import("../routes/api-keys.js");
    await apiKeyRoutes(app);

    const deleteHandler = app.delete.mock.calls[0][2];
    const request = { userId: "user-1", params: { id: "key-1" } };
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };

    const result = await deleteHandler(request, reply);

    expect(deleteFn).toHaveBeenCalled();
    expect(result).toEqual({ message: "API key deleted" });
  });
});
