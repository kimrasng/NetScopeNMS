import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let createReceiverCallback: (error: Error | null, notification: any) => void;
const mockReceiverClose = vi.fn();

vi.mock("net-snmp", () => ({
  default: {
    createReceiver: vi.fn((opts: any, cb: any) => {
      createReceiverCallback = cb;
      return { close: mockReceiverClose };
    }),
    PduType: { Trap: 164, TrapV2: 167, InformRequest: 168 },
  },
}));

const mockQueueAdd = vi.fn().mockResolvedValue(undefined);
const mockQueueClose = vi.fn().mockResolvedValue(undefined);

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
  })),
}));

const mockDisconnect = vi.fn();
vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    disconnect: mockDisconnect,
  })),
}));

const mockLimit = vi.fn();

vi.mock("@netpulse/shared", () => ({
  createDb: vi.fn().mockImplementation(() => ({
    db: {
      select: () => ({
        from: () => ({
          where: () => ({ limit: mockLimit }),
        }),
      }),
    },
  })),
  devices: { id: "id", ip: "ip" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
}));

describe("TrapReceiver", () => {
  let TrapReceiver: typeof import("../trap-receiver.js").TrapReceiver;

  beforeEach(async () => {
    vi.resetModules();
    mockReceiverClose.mockClear();
    mockQueueAdd.mockClear();
    mockQueueClose.mockClear();
    mockDisconnect.mockClear();
    mockLimit.mockReset();
    mockLimit.mockResolvedValue([]);
    const mod = await import("../trap-receiver.js");
    TrapReceiver = mod.TrapReceiver;
  });

  describe("start/stop lifecycle", () => {
    it("creates a receiver on start and emits listening event", async () => {
      const trap = new TrapReceiver({ port: 1162 });
      const listenSpy = vi.fn();
      trap.on("listening", listenSpy);

      trap.start();

      const snmp = vi.mocked(await import("net-snmp")).default;
      expect(snmp.createReceiver).toHaveBeenCalledWith(
        expect.objectContaining({ port: 1162 }),
        expect.any(Function),
      );
      expect(listenSpy).toHaveBeenCalledWith({ port: 1162 });
    });

    it("does not create a second receiver if already started", async () => {
      const trap = new TrapReceiver();
      const snmp = vi.mocked(await import("net-snmp")).default;
      const callsBefore = (snmp.createReceiver as any).mock.calls.length;

      trap.start();
      trap.start();

      expect((snmp.createReceiver as any).mock.calls.length - callsBefore).toBe(1);
    });

    it("closes receiver and cleans up on stop", async () => {
      const trap = new TrapReceiver({ redisUrl: "redis://localhost:6379" });
      trap.start();
      await trap.stop();

      expect(mockReceiverClose).toHaveBeenCalled();
      expect(mockQueueClose).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("stop is safe to call when not started", async () => {
      const trap = new TrapReceiver();
      await expect(trap.stop()).resolves.toBeUndefined();
    });
  });

  describe("v1 trap parsing", () => {
    it("parses v1 trap with enterprise OID and specific trap", async () => {
      const trap = new TrapReceiver();
      const events: any[] = [];
      trap.onTrap((e) => events.push(e));
      trap.start();

      createReceiverCallback(null, {
        pdu: {
          type: 164,
          enterprise: "1.3.6.1.4.1.9",
          specificTrap: 3,
          varbinds: [{ oid: "1.3.6.1.2.1.1.3.0", type: 67, value: 12345 }],
        },
        rinfo: { address: "10.0.0.1", port: 162 },
      });
      await vi.waitFor(() => expect(events).toHaveLength(1));

      expect(events[0].version).toBe("v1");
      expect(events[0].sourceIp).toBe("10.0.0.1");
      expect(events[0].oid).toBe("1.3.6.1.4.1.9.0.3");
      expect(events[0].varbinds).toHaveLength(1);
      expect(events[0].varbinds[0].oid).toBe("1.3.6.1.2.1.1.3.0");
    });
  });

  describe("v2c trap parsing", () => {
    it("parses v2c trap extracting snmpTrapOID from varbinds", async () => {
      const trap = new TrapReceiver();
      const events: any[] = [];
      trap.onTrap((e) => events.push(e));
      trap.start();

      createReceiverCallback(null, {
        pdu: {
          type: 167,
          varbinds: [
            { oid: "1.3.6.1.2.1.1.3.0", type: 67, value: 99999 },
            { oid: "1.3.6.1.6.3.1.1.4.1.0", type: 6, value: "1.3.6.1.4.1.9.9.43.2.0.1" },
            { oid: "1.3.6.1.4.1.9.9.43.1.1.1", type: 4, value: "config changed" },
          ],
        },
        rinfo: { address: "10.0.0.2", port: 45000 },
      });
      await vi.waitFor(() => expect(events).toHaveLength(1));

      expect(events[0].version).toBe("v2c");
      expect(events[0].oid).toBe("1.3.6.1.4.1.9.9.43.2.0.1");
      expect(events[0].varbinds).toHaveLength(3);
    });

    it("returns 'unknown' OID when snmpTrapOID varbind is missing", async () => {
      const trap = new TrapReceiver();
      const events: any[] = [];
      trap.onTrap((e) => events.push(e));
      trap.start();

      createReceiverCallback(null, {
        pdu: { type: 167, varbinds: [{ oid: "1.3.6.1.2.1.1.3.0", type: 67, value: 100 }] },
        rinfo: { address: "10.0.0.3", port: 162 },
      });
      await vi.waitFor(() => expect(events).toHaveLength(1));

      expect(events[0].oid).toBe("unknown");
    });
  });

  describe("v3 inform parsing", () => {
    it("detects InformRequest as v3", async () => {
      const trap = new TrapReceiver();
      const events: any[] = [];
      trap.onTrap((e) => events.push(e));
      trap.start();

      createReceiverCallback(null, {
        pdu: {
          type: 168,
          varbinds: [{ oid: "1.3.6.1.6.3.1.1.4.1.0", type: 6, value: "1.3.6.1.4.1.2636.4.1.1" }],
        },
        rinfo: { address: "10.0.0.5", port: 162 },
      });
      await vi.waitFor(() => expect(events).toHaveLength(1));

      expect(events[0].version).toBe("v3");
      expect(events[0].oid).toBe("1.3.6.1.4.1.2636.4.1.1");
    });
  });

  describe("device IP resolution", () => {
    it("attaches deviceId when source IP matches a known device", async () => {
      mockLimit.mockResolvedValue([{ id: "device-abc-123" }]);

      const trap = new TrapReceiver({ databaseUrl: "postgres://localhost/test" });
      const events: any[] = [];
      trap.onTrap((e) => events.push(e));
      trap.start();

      createReceiverCallback(null, {
        pdu: { type: 167, varbinds: [{ oid: "1.3.6.1.6.3.1.1.4.1.0", type: 6, value: "1.3.6.1.4.1.9.0.1" }] },
        rinfo: { address: "10.0.0.50", port: 162 },
      });
      await vi.waitFor(() => expect(events).toHaveLength(1));

      expect(events[0].deviceId).toBe("device-abc-123");
    });

    it("leaves deviceId undefined when no device matches", async () => {
      mockLimit.mockResolvedValue([]);

      const trap = new TrapReceiver({ databaseUrl: "postgres://localhost/test" });
      const events: any[] = [];
      trap.onTrap((e) => events.push(e));
      trap.start();

      createReceiverCallback(null, {
        pdu: { type: 167, varbinds: [{ oid: "1.3.6.1.6.3.1.1.4.1.0", type: 6, value: "1.3.6.1.4.1.9.0.1" }] },
        rinfo: { address: "10.0.0.99", port: 162 },
      });
      await vi.waitFor(() => expect(events).toHaveLength(1));

      expect(events[0].deviceId).toBeUndefined();
    });

    it("continues without deviceId when database lookup throws", async () => {
      mockLimit.mockRejectedValue(new Error("DB connection failed"));

      const trap = new TrapReceiver({ databaseUrl: "postgres://localhost/test" });
      const events: any[] = [];
      trap.onTrap((e) => events.push(e));
      trap.start();

      createReceiverCallback(null, {
        pdu: { type: 167, varbinds: [{ oid: "1.3.6.1.6.3.1.1.4.1.0", type: 6, value: "1.3.6.1.4.1.9.0.1" }] },
        rinfo: { address: "10.0.0.50", port: 162 },
      });
      await vi.waitFor(() => expect(events).toHaveLength(1));

      expect(events[0].deviceId).toBeUndefined();
    });
  });

  describe("BullMQ queue integration", () => {
    it("pushes trap events to the trap-events queue", async () => {
      const trap = new TrapReceiver({ redisUrl: "redis://localhost:6379" });
      const events: any[] = [];
      trap.onTrap((e) => events.push(e));
      trap.start();

      createReceiverCallback(null, {
        pdu: { type: 167, varbinds: [{ oid: "1.3.6.1.6.3.1.1.4.1.0", type: 6, value: "1.3.6.1.4.1.9.0.1" }] },
        rinfo: { address: "10.0.0.1", port: 162 },
      });
      await vi.waitFor(() => expect(events).toHaveLength(1));

      expect(mockQueueAdd).toHaveBeenCalledWith(
        "trap",
        expect.objectContaining({ sourceIp: "10.0.0.1", version: "v2c" }),
        expect.objectContaining({ removeOnComplete: 100, removeOnFail: 50 }),
      );
    });

    it("skips queue when redisUrl is not configured", async () => {
      const trap = new TrapReceiver();
      const events: any[] = [];
      trap.onTrap((e) => events.push(e));
      trap.start();

      createReceiverCallback(null, {
        pdu: { type: 167, varbinds: [] },
        rinfo: { address: "10.0.0.1", port: 162 },
      });
      await vi.waitFor(() => expect(events).toHaveLength(1));

      expect(mockQueueAdd).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("emits error when receiver callback receives an error", () => {
      const trap = new TrapReceiver();
      const errors: Error[] = [];
      trap.on("error", (e) => errors.push(e));
      trap.start();

      createReceiverCallback(new Error("UDP bind failed"), null as any);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("UDP bind failed");
    });

    it("emits error when notification processing fails", async () => {
      mockQueueAdd.mockRejectedValueOnce(new Error("queue write failed"));

      const trap = new TrapReceiver({ redisUrl: "redis://localhost:6379" });
      const errors: Error[] = [];
      trap.on("error", (e) => errors.push(e));
      trap.start();

      createReceiverCallback(null, {
        pdu: { type: 167, varbinds: [{ oid: "1.3.6.1.6.3.1.1.4.1.0", type: 6, value: "1.3.6.1.4.1.9.0.1" }] },
        rinfo: { address: "10.0.0.1", port: 162 },
      });

      await vi.waitFor(() => expect(errors).toHaveLength(1));
      expect(errors[0].message).toBe("queue write failed");
    });
  });

  describe("default config", () => {
    it("uses port 162 and community 'public' by default", async () => {
      const trap = new TrapReceiver();
      trap.start();

      const snmp = vi.mocked(await import("net-snmp")).default;
      expect(snmp.createReceiver).toHaveBeenCalledWith(
        expect.objectContaining({ port: 162, community: "public", disableAuthorization: false }),
        expect.any(Function),
      );
    });
  });
});
