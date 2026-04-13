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

function mockSession() {
  const closeFn = vi.fn();
  const getFn = vi.fn((_oids: string[], cb: Function) => {
    cb(null, [
      { oid: "1.3.6.1.4.1.2021.10.1.3.1", value: "55.0" },
      { oid: "1.3.6.1.4.1.2021.4.5.0", value: 8000000 },
      { oid: "1.3.6.1.4.1.2021.4.6.0", value: 2000000 },
    ]);
  });
  const subtreeFn = vi.fn((_oid: string, _max: number, _feedCb: Function, doneCb: Function) => {
    doneCb(new Error("Walk not supported"));
  });
  return { get: getFn, subtree: subtreeFn, close: closeFn };
}

describe("SNMPv3 Support", () => {
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

  describe("createSnmpV3Session", () => {
    it("creates noAuthNoPriv session with username only", () => {
      const session = mockSession();
      (snmp.default.createV3Session as ReturnType<typeof vi.fn>).mockReturnValueOnce(session);

      mod.createSnmpV3Session("10.0.0.1", {
        securityLevel: "noAuthNoPriv",
        username: "noauthuser",
      });

      expect(snmp.default.createV3Session).toHaveBeenCalledWith(
        "10.0.0.1",
        { name: "noauthuser", level: 1 },
        { port: 161, timeout: 5000, retries: 1 },
      );
    });

    it("creates authNoPriv session with auth protocol and key", () => {
      const session = mockSession();
      (snmp.default.createV3Session as ReturnType<typeof vi.fn>).mockReturnValueOnce(session);

      mod.createSnmpV3Session("10.0.0.2", {
        securityLevel: "authNoPriv",
        username: "authuser",
        authProtocol: "SHA256",
        authKey: "authpass123",
      });

      expect(snmp.default.createV3Session).toHaveBeenCalledWith(
        "10.0.0.2",
        { name: "authuser", level: 2, authProtocol: 5, authKey: "authpass123" },
        { port: 161, timeout: 5000, retries: 1 },
      );
    });

    it("creates authPriv session with all protocols", () => {
      const session = mockSession();
      (snmp.default.createV3Session as ReturnType<typeof vi.fn>).mockReturnValueOnce(session);

      mod.createSnmpV3Session("10.0.0.3", {
        securityLevel: "authPriv",
        username: "privuser",
        authProtocol: "SHA512",
        authKey: "authpass",
        privProtocol: "AES256",
        privKey: "privpass",
      }, 1161);

      expect(snmp.default.createV3Session).toHaveBeenCalledWith(
        "10.0.0.3",
        {
          name: "privuser",
          level: 3,
          authProtocol: 7,
          authKey: "authpass",
          privProtocol: 6,
          privKey: "privpass",
        },
        { port: 1161, timeout: 5000, retries: 1 },
      );
    });

    it("maps all auth protocols correctly", () => {
      const protocols = [
        { proto: "MD5" as const, expected: 2 },
        { proto: "SHA" as const, expected: 3 },
        { proto: "SHA224" as const, expected: 4 },
        { proto: "SHA256" as const, expected: 5 },
        { proto: "SHA384" as const, expected: 6 },
        { proto: "SHA512" as const, expected: 7 },
      ];

      for (const { proto, expected } of protocols) {
        (snmp.default.createV3Session as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockSession());

        mod.createSnmpV3Session("10.0.0.1", {
          securityLevel: "authNoPriv",
          username: "user",
          authProtocol: proto,
          authKey: "key",
        });

        const call = (snmp.default.createV3Session as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
        expect(call[1].authProtocol).toBe(expected);
      }
    });

    it("maps all priv protocols correctly", () => {
      const protocols = [
        { proto: "DES" as const, expected: 2 },
        { proto: "AES" as const, expected: 4 },
        { proto: "AES256" as const, expected: 6 },
      ];

      for (const { proto, expected } of protocols) {
        (snmp.default.createV3Session as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockSession());

        mod.createSnmpV3Session("10.0.0.1", {
          securityLevel: "authPriv",
          username: "user",
          authProtocol: "SHA",
          authKey: "authkey",
          privProtocol: proto,
          privKey: "privkey",
        });

        const call = (snmp.default.createV3Session as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
        expect(call[1].privProtocol).toBe(expected);
      }
    });
  });

  describe("pollDevice with SNMPv3", () => {
    it("polls SNMP metrics when v3 config is provided", async () => {
      (ping.default.promise.probe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        alive: true,
        time: 2.5,
      });

      (snmp.default.createV3Session as ReturnType<typeof vi.fn>).mockReturnValue(mockSession());

      const result = await mod.pollDevice({
        id: "v3-dev-1",
        ip: "10.0.0.50",
        snmpVersion: "v3",
        snmpV3Config: {
          securityLevel: "authPriv",
          username: "admin",
          authProtocol: "SHA256",
          authKey: "authpass",
          privProtocol: "AES",
          privKey: "privpass",
        },
      });

      expect(result.reachable).toBe(true);
      expect(snmp.default.createV3Session).toHaveBeenCalled();
      expect(snmp.default.createSession).not.toHaveBeenCalled();

      const cpuMetric = result.metrics.find(m => m.name === "cpu");
      expect(cpuMetric).toBeDefined();
      expect(cpuMetric!.value).toBe(55.0);

      const memMetric = result.metrics.find(m => m.name === "memory");
      expect(memMetric).toBeDefined();
      expect(memMetric!.value).toBe(75);
    });

    it("returns ICMP-only when v3 but no snmpV3Config", async () => {
      (ping.default.promise.probe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        alive: true,
        time: 1.0,
      });

      const result = await mod.pollDevice({
        id: "v3-dev-2",
        ip: "10.0.0.51",
        snmpVersion: "v3",
        snmpV3Config: null,
      });

      expect(result.metrics).toHaveLength(2);
      expect(result.metrics[0].name).toBe("ping");
      expect(result.metrics[1].name).toBe("latency");
      expect(snmp.default.createV3Session).not.toHaveBeenCalled();
    });

    it("returns ICMP-only when v3 but snmpV3Config is undefined", async () => {
      (ping.default.promise.probe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        alive: false,
        time: "unknown",
      });

      const result = await mod.pollDevice({
        id: "v3-dev-3",
        ip: "10.0.0.52",
        snmpVersion: "v3",
      });

      expect(result.reachable).toBe(false);
      expect(result.metrics).toHaveLength(2);
      expect(snmp.default.createV3Session).not.toHaveBeenCalled();
    });

    it("still uses v2c session when snmpVersion is v2c", async () => {
      (ping.default.promise.probe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        alive: true,
        time: 3.0,
      });

      const session = mockSession();
      (snmp.default.createSession as ReturnType<typeof vi.fn>).mockReturnValue(session);

      const result = await mod.pollDevice({
        id: "v2c-dev",
        ip: "10.0.0.60",
        snmpVersion: "v2c",
        snmpCommunity: "public",
      });

      expect(snmp.default.createSession).toHaveBeenCalled();
      expect(snmp.default.createV3Session).not.toHaveBeenCalled();

      const cpuMetric = result.metrics.find(m => m.name === "cpu");
      expect(cpuMetric).toBeDefined();
    });

    it("uses custom port for v3 session", async () => {
      (ping.default.promise.probe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        alive: true,
        time: 1.0,
      });

      (snmp.default.createV3Session as ReturnType<typeof vi.fn>).mockReturnValue(mockSession());

      await mod.pollDevice({
        id: "v3-port-dev",
        ip: "10.0.0.70",
        snmpVersion: "v3",
        snmpPort: 1161,
        snmpV3Config: {
          securityLevel: "noAuthNoPriv",
          username: "user",
        },
      });

      const call = (snmp.default.createV3Session as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[2].port).toBe(1161);
    });

    it("handles v3 SNMP failure gracefully", async () => {
      (ping.default.promise.probe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        alive: true,
        time: 2.0,
      });

      const closeFn = vi.fn();
      const getFn = vi.fn((_oids: string[], cb: Function) => {
        cb(new Error("SNMPv3 auth failure"));
      });
      (snmp.default.createV3Session as ReturnType<typeof vi.fn>).mockReturnValue({
        get: getFn,
        close: closeFn,
      });

      const result = await mod.pollDevice({
        id: "v3-fail-dev",
        ip: "10.0.0.80",
        snmpVersion: "v3",
        snmpV3Config: {
          securityLevel: "authPriv",
          username: "baduser",
          authProtocol: "SHA",
          authKey: "wrongkey",
          privProtocol: "AES",
          privKey: "wrongpriv",
        },
      });

      expect(result.reachable).toBe(true);
      expect(result.metrics).toHaveLength(2);
      expect(result.metrics[0].name).toBe("ping");
    });
  });

  describe("snmpGetWithSession", () => {
    it("resolves with OID-value map using provided session", async () => {
      const closeFn = vi.fn();
      const getFn = vi.fn((_oids: string[], cb: Function) => {
        cb(null, [
          { oid: "1.3.6.1.2.1.1.1.0", value: "Linux v3" },
        ]);
      });

      const result = await mod.snmpGetWithSession({ get: getFn, close: closeFn }, [
        "1.3.6.1.2.1.1.1.0",
      ]);

      expect(result["1.3.6.1.2.1.1.1.0"]).toBe("Linux v3");
      expect(closeFn).toHaveBeenCalled();
    });
  });

  describe("snmpWalkWithSession", () => {
    it("resolves with array of oid-value pairs using provided session", async () => {
      const closeFn = vi.fn();
      const subtreeFn = vi.fn((_oid: string, _max: number, feedCb: Function, doneCb: Function) => {
        feedCb([
          { oid: "1.3.6.1.2.1.2.2.1.2.1", value: "ge-0/0/0" },
        ]);
        doneCb(null);
      });

      const result = await mod.snmpWalkWithSession({ subtree: subtreeFn, close: closeFn }, "1.3.6.1.2.1.2.2.1.2");

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe("ge-0/0/0");
      expect(closeFn).toHaveBeenCalled();
    });
  });
});
