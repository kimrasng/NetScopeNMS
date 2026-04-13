import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("ping", () => ({
  default: {
    promise: {
      probe: vi.fn(),
    },
  },
}));

vi.mock("net-snmp", () => ({
  default: {
    createSession: vi.fn(),
    createV3Session: vi.fn(),
    isVarbindError: vi.fn().mockReturnValue(false),
  },
}));

vi.mock("bullmq", () => ({
  Worker: vi.fn(),
  Queue: vi.fn(),
}));

vi.mock("ioredis", () => ({
  default: vi.fn(),
}));

vi.mock("@netpulse/shared", () => ({
  createDb: vi.fn().mockReturnValue({ db: {} }),
  devices: {},
  metrics: {},
  interfaces: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

describe("Polling Engine", () => {
  let ping: typeof import("ping");
  let snmp: typeof import("net-snmp");
  let mod: typeof import("../index.js");

  beforeEach(async () => {
    vi.resetModules();
    ping = await import("ping");
    snmp = await import("net-snmp");
    mod = await import("../index.js");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("icmpPing", () => {
    it("returns alive:true with latency for reachable host", async () => {
      (ping.default.promise.probe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        alive: true,
        time: 12.5,
      });

      const result = await mod.icmpPing("10.0.0.1");
      expect(result.alive).toBe(true);
      expect(result.time).toBe(12.5);
    });

    it("returns alive:false with time 0 for unreachable host", async () => {
      (ping.default.promise.probe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        alive: false,
        time: "unknown",
      });

      const result = await mod.icmpPing("10.0.0.99");
      expect(result.alive).toBe(false);
      expect(result.time).toBe(0);
    });
  });

  describe("snmpGet", () => {
    it("resolves with OID-value map on success", async () => {
      const closeFn = vi.fn();
      const getFn = vi.fn((_oids: string[], cb: Function) => {
        cb(null, [
          { oid: "1.3.6.1.2.1.1.1.0", value: "Linux router" },
          { oid: "1.3.6.1.2.1.1.5.0", value: "router-1" },
        ]);
      });

      (snmp.default.createSession as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        get: getFn,
        close: closeFn,
      });

      const result = await mod.snmpGet("10.0.0.1", "public", [
        "1.3.6.1.2.1.1.1.0",
        "1.3.6.1.2.1.1.5.0",
      ]);

      expect(result["1.3.6.1.2.1.1.1.0"]).toBe("Linux router");
      expect(result["1.3.6.1.2.1.1.5.0"]).toBe("router-1");
      expect(closeFn).toHaveBeenCalled();
    });

    it("rejects on SNMP error", async () => {
      const closeFn = vi.fn();
      const getFn = vi.fn((_oids: string[], cb: Function) => {
        cb(new Error("SNMP timeout"));
      });

      (snmp.default.createSession as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        get: getFn,
        close: closeFn,
      });

      await expect(mod.snmpGet("10.0.0.1", "public", ["1.3.6.1.2.1.1.1.0"])).rejects.toThrow("SNMP timeout");
    });

    it("skips varbind errors", async () => {
      const closeFn = vi.fn();
      const getFn = vi.fn((_oids: string[], cb: Function) => {
        cb(null, [
          { oid: "1.3.6.1.2.1.1.1.0", value: "ok" },
          { oid: "1.3.6.1.2.1.1.5.0", value: "error-vb" },
        ]);
      });

      (snmp.default.createSession as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        get: getFn,
        close: closeFn,
      });

      (snmp.default.isVarbindError as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const result = await mod.snmpGet("10.0.0.1", "public", [
        "1.3.6.1.2.1.1.1.0",
        "1.3.6.1.2.1.1.5.0",
      ]);

      expect(result["1.3.6.1.2.1.1.1.0"]).toBe("ok");
      expect(result["1.3.6.1.2.1.1.5.0"]).toBeUndefined();
    });
  });

  describe("snmpWalk", () => {
    it("resolves with array of oid-value pairs", async () => {
      const closeFn = vi.fn();
      const subtreeFn = vi.fn((_oid: string, _maxRepetitions: number, feedCb: Function, doneCb: Function) => {
        feedCb([
          { oid: "1.3.6.1.2.1.2.2.1.2.1", value: "eth0" },
          { oid: "1.3.6.1.2.1.2.2.1.2.2", value: "eth1" },
        ]);
        doneCb(null);
      });

      (snmp.default.createSession as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        subtree: subtreeFn,
        close: closeFn,
      });

      const result = await mod.snmpWalk("10.0.0.1", "public", "1.3.6.1.2.1.2.2.1.2");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ oid: "1.3.6.1.2.1.2.2.1.2.1", value: "eth0" });
      expect(result[1]).toEqual({ oid: "1.3.6.1.2.1.2.2.1.2.2", value: "eth1" });
    });

    it("rejects on walk error", async () => {
      const closeFn = vi.fn();
      const subtreeFn = vi.fn((_oid: string, _maxRepetitions: number, _feedCb: Function, doneCb: Function) => {
        doneCb(new Error("Walk failed"));
      });

      (snmp.default.createSession as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        subtree: subtreeFn,
        close: closeFn,
      });

      await expect(mod.snmpWalk("10.0.0.1", "public", "1.3.6.1.2.1.2.2.1.2")).rejects.toThrow("Walk failed");
    });
  });

  describe("pollDevice", () => {
    it("returns ICMP-only result when no SNMP community", async () => {
      (ping.default.promise.probe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        alive: true,
        time: 5.2,
      });

      const result = await mod.pollDevice({
        id: "dev-1",
        ip: "10.0.0.1",
        snmpCommunity: null,
      });

      expect(result.reachable).toBe(true);
      expect(result.latency).toBe(5.2);
      expect(result.metrics).toEqual([
        { name: "ping", value: 1 },
        { name: "latency", value: 5.2, unit: "ms" },
      ]);
      expect(result.interfaces).toBeUndefined();
    });

    it("returns ICMP-only result when SNMP version is unsupported", async () => {
      (ping.default.promise.probe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        alive: false,
        time: "unknown",
      });

      const result = await mod.pollDevice({
        id: "dev-2",
        ip: "10.0.0.2",
        snmpCommunity: "public",
        snmpVersion: "v3",
      });

      expect(result.reachable).toBe(false);
      expect(result.metrics).toHaveLength(2);
      expect(result.metrics[0]).toEqual({ name: "ping", value: 0 });
    });

    it("includes SNMP metrics when community and v2c version provided", async () => {
      (ping.default.promise.probe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        alive: true,
        time: 3.0,
      });

      const closeFn = vi.fn();
      const getFn = vi.fn((_oids: string[], cb: Function) => {
        cb(null, [
          { oid: "1.3.6.1.4.1.2021.10.1.3.1", value: "45.2" },
          { oid: "1.3.6.1.4.1.2021.4.5.0", value: 8000000 },
          { oid: "1.3.6.1.4.1.2021.4.6.0", value: 4000000 },
        ]);
      });

      const subtreeFn = vi.fn((_oid: string, _max: number, _feedCb: Function, doneCb: Function) => {
        doneCb(new Error("Walk not supported"));
      });

      (snmp.default.createSession as ReturnType<typeof vi.fn>).mockReturnValue({
        get: getFn,
        subtree: subtreeFn,
        close: closeFn,
      });

      const result = await mod.pollDevice({
        id: "dev-3",
        ip: "10.0.0.3",
        snmpCommunity: "public",
        snmpVersion: "v2c",
      });

      expect(result.reachable).toBe(true);
      const cpuMetric = result.metrics.find(m => m.name === "cpu");
      expect(cpuMetric).toBeDefined();
      expect(cpuMetric!.value).toBe(45.2);

      const memMetric = result.metrics.find(m => m.name === "memory");
      expect(memMetric).toBeDefined();
      expect(memMetric!.value).toBe(50);
    });

    it("handles counter wrap for bandwidth calculation", async () => {
      vi.useFakeTimers();

      (ping.default.promise.probe as ReturnType<typeof vi.fn>).mockResolvedValue({
        alive: true,
        time: 1.0,
      });

      const closeFn = vi.fn();
      const getFn = vi.fn((_oids: string[], cb: Function) => {
        cb(null, []);
      });

      const ifNames = [{ oid: "1.3.6.1.2.1.2.2.1.2.1", value: "eth0" }];
      const ifStatuses = [{ oid: "1.3.6.1.2.1.2.2.1.8.1", value: 1 }];
      const ifIn1 = [{ oid: "1.3.6.1.2.1.2.2.1.10.1", value: 4294967000 }];
      const ifOut1 = [{ oid: "1.3.6.1.2.1.2.2.1.16.1", value: 1000 }];

      let subtreeCallCount = 0;
      const subtreeFn1 = vi.fn((_oid: string, _max: number, feedCb: Function, doneCb: Function) => {
        const datasets = [ifNames, ifStatuses, ifIn1, ifOut1];
        feedCb(datasets[subtreeCallCount].map(v => ({ oid: v.oid, value: v.value })));
        subtreeCallCount++;
        doneCb(null);
      });

      (snmp.default.createSession as ReturnType<typeof vi.fn>).mockReturnValue({
        get: getFn,
        subtree: subtreeFn1,
        close: closeFn,
      });

      await mod.pollDevice({
        id: "wrap-dev",
        ip: "10.0.0.10",
        snmpCommunity: "public",
        snmpVersion: "v2c",
      });

      vi.advanceTimersByTime(60000);

      const ifIn2 = [{ oid: "1.3.6.1.2.1.2.2.1.10.1", value: 500 }];
      const ifOut2 = [{ oid: "1.3.6.1.2.1.2.2.1.16.1", value: 2000 }];

      subtreeCallCount = 0;
      const subtreeFn2 = vi.fn((_oid: string, _max: number, feedCb: Function, doneCb: Function) => {
        const datasets = [ifNames, ifStatuses, ifIn2, ifOut2];
        feedCb(datasets[subtreeCallCount].map(v => ({ oid: v.oid, value: v.value })));
        subtreeCallCount++;
        doneCb(null);
      });

      (snmp.default.createSession as ReturnType<typeof vi.fn>).mockReturnValue({
        get: getFn,
        subtree: subtreeFn2,
        close: closeFn,
      });

      const result = await mod.pollDevice({
        id: "wrap-dev",
        ip: "10.0.0.10",
        snmpCommunity: "public",
        snmpVersion: "v2c",
      });

      vi.useRealTimers();

      expect(result.interfaces).toBeDefined();
      expect(result.interfaces![0].inBps).toBeGreaterThan(0);

      const bwIn = result.metrics.find(m => m.name === "bandwidth_in");
      expect(bwIn).toBeDefined();
      expect(bwIn!.value).toBeGreaterThan(0);
    });
  });
});
