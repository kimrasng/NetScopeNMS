import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSnmpWalk = vi.fn();

vi.mock("net-snmp", () => ({
  default: {
    createSession: vi.fn(() => ({
      subtree: vi.fn(),
      close: vi.fn(),
    })),
    isVarbindError: vi.fn().mockReturnValue(false),
  },
}));

vi.mock("ping", () => ({
  default: { promise: { probe: vi.fn() } },
}));

const mockQueueAdd = vi.fn().mockResolvedValue(undefined);
const mockQueueClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
  })),
  Worker: vi.fn().mockImplementation((_name: string, _processor: any) => ({
    close: mockWorkerClose,
  })),
  Job: vi.fn(),
}));

const mockDisconnect = vi.fn();
vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    disconnect: mockDisconnect,
  })),
}));

const mockSelectLimit = vi.fn();
const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

vi.mock("@netpulse/shared", () => ({
  createDb: vi.fn().mockImplementation(() => ({
    db: {
      select: mockSelect,
      insert: mockInsert,
    },
  })),
  devices: { id: "id", ip: "ip", pollingEnabled: "polling_enabled" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
}));

vi.mock("../index.js", () => ({
  snmpWalk: mockSnmpWalk,
}));

const LLDP_OID = {
  remManAddr: "1.0.8802.1.1.2.1.4.2.1.4",
  remSysName: "1.0.8802.1.1.2.1.4.1.1.9",
  remSysDesc: "1.0.8802.1.1.2.1.4.1.1.10",
  remPortId: "1.0.8802.1.1.2.1.4.1.1.7",
};

const ARP_OID = {
  ipNetToMediaNetAddress: "1.3.6.1.2.1.4.22.1.3",
  ipNetToMediaPhysAddress: "1.3.6.1.2.1.4.22.1.2",
};

describe("DiscoveryEngine", () => {
  let DiscoveryEngine: typeof import("../discovery.js").DiscoveryEngine;

  const defaultConfig = {
    redisUrl: "redis://localhost:6379",
    databaseUrl: "postgres://localhost/test",
    defaultSnmpCommunity: "public",
  };

  const testDevice = {
    id: "dev-1",
    name: "core-switch",
    ip: "10.0.0.1",
    snmpCommunity: "public",
    snmpPort: 161,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSelectLimit.mockResolvedValue([]);
    mockSnmpWalk.mockResolvedValue([]);
    const mod = await import("../discovery.js");
    DiscoveryEngine = mod.DiscoveryEngine;
  });

  function createStartedEngine(config = defaultConfig) {
    const engine = new DiscoveryEngine(config);
    engine.start();
    return engine;
  }

  describe("LLDP neighbor discovery", () => {
    it("discovers neighbors from LLDP remManAddr walk", async () => {
      mockSnmpWalk.mockImplementation((_ip: string, _community: string, oid: string) => {
        if (oid === LLDP_OID.remManAddr) {
          return Promise.resolve([
            { oid: `${LLDP_OID.remManAddr}.0.1.1.1.4.192.168.1.10`, value: 1 },
            { oid: `${LLDP_OID.remManAddr}.0.1.2.1.4.192.168.1.20`, value: 1 },
          ]);
        }
        if (oid === LLDP_OID.remSysName) {
          return Promise.resolve([
            { oid: `${LLDP_OID.remSysName}.0.1.1`, value: "switch-a" },
            { oid: `${LLDP_OID.remSysName}.0.1.2`, value: "switch-b" },
          ]);
        }
        if (oid === LLDP_OID.remSysDesc) {
          return Promise.resolve([
            { oid: `${LLDP_OID.remSysDesc}.0.1.1`, value: "Cisco IOS" },
            { oid: `${LLDP_OID.remSysDesc}.0.1.2`, value: "Juniper JUNOS" },
          ]);
        }
        if (oid === LLDP_OID.remPortId) {
          return Promise.resolve([
            { oid: `${LLDP_OID.remPortId}.0.1.1`, value: "ge-0/0/1" },
            { oid: `${LLDP_OID.remPortId}.0.1.2`, value: "ge-0/0/2" },
          ]);
        }
        return Promise.resolve([]);
      });

      const engine = createStartedEngine();
      const result = await engine.discoverFromDevice(testDevice);

      expect(result.neighborsFound).toHaveLength(2);
      expect(result.neighborsFound[0].ip).toBe("192.168.1.10");
      expect(result.neighborsFound[0].hostname).toBe("switch-a");
      expect(result.neighborsFound[0].description).toBe("Cisco IOS");
      expect(result.neighborsFound[0].sourcePort).toBe("ge-0/0/1");
      expect(result.neighborsFound[0].discoveryMethod).toBe("lldp");
      expect(result.neighborsFound[1].ip).toBe("192.168.1.20");
      expect(result.newDevicesCreated).toBe(2);
    });

    it("skips neighbors with same IP as source device", async () => {
      mockSnmpWalk.mockImplementation((_ip: string, _community: string, oid: string) => {
        if (oid === LLDP_OID.remManAddr) {
          return Promise.resolve([
            { oid: `${LLDP_OID.remManAddr}.0.1.1.1.4.10.0.0.1`, value: 1 },
            { oid: `${LLDP_OID.remManAddr}.0.1.2.1.4.192.168.1.10`, value: 1 },
          ]);
        }
        return Promise.resolve([]);
      });

      const engine = createStartedEngine();
      const result = await engine.discoverFromDevice(testDevice);

      expect(result.neighborsFound).toHaveLength(1);
      expect(result.neighborsFound[0].ip).toBe("192.168.1.10");
    });
  });

  describe("ARP table discovery", () => {
    it("discovers neighbors from ARP ipNetToMedia walk", async () => {
      mockSnmpWalk.mockImplementation((_ip: string, _community: string, oid: string) => {
        if (oid === ARP_OID.ipNetToMediaNetAddress) {
          return Promise.resolve([
            { oid: `${ARP_OID.ipNetToMediaNetAddress}.2.10.0.0.50`, value: "10.0.0.50" },
            { oid: `${ARP_OID.ipNetToMediaNetAddress}.2.10.0.0.51`, value: "10.0.0.51" },
          ]);
        }
        if (oid === ARP_OID.ipNetToMediaPhysAddress) {
          return Promise.resolve([
            { oid: `${ARP_OID.ipNetToMediaPhysAddress}.2.10.0.0.50`, value: "aa:bb:cc:dd:ee:01" },
            { oid: `${ARP_OID.ipNetToMediaPhysAddress}.2.10.0.0.51`, value: "aa:bb:cc:dd:ee:02" },
          ]);
        }
        return Promise.resolve([]);
      });

      const engine = createStartedEngine();
      const result = await engine.discoverFromDevice(testDevice);

      expect(result.neighborsFound).toHaveLength(2);
      expect(result.neighborsFound[0].ip).toBe("10.0.0.50");
      expect(result.neighborsFound[0].macAddress).toBe("aa:bb:cc:dd:ee:01");
      expect(result.neighborsFound[0].discoveryMethod).toBe("arp");
      expect(result.neighborsFound[1].ip).toBe("10.0.0.51");
      expect(result.newDevicesCreated).toBe(2);
    });

    it("skips ARP entries matching source device IP", async () => {
      mockSnmpWalk.mockImplementation((_ip: string, _community: string, oid: string) => {
        if (oid === ARP_OID.ipNetToMediaNetAddress) {
          return Promise.resolve([
            { oid: `${ARP_OID.ipNetToMediaNetAddress}.2.10.0.0.1`, value: "10.0.0.1" },
            { oid: `${ARP_OID.ipNetToMediaNetAddress}.2.10.0.0.50`, value: "10.0.0.50" },
          ]);
        }
        if (oid === ARP_OID.ipNetToMediaPhysAddress) {
          return Promise.resolve([
            { oid: `${ARP_OID.ipNetToMediaPhysAddress}.2.10.0.0.1`, value: "aa:bb:cc:00:00:01" },
            { oid: `${ARP_OID.ipNetToMediaPhysAddress}.2.10.0.0.50`, value: "aa:bb:cc:00:00:02" },
          ]);
        }
        return Promise.resolve([]);
      });

      const engine = createStartedEngine();
      const result = await engine.discoverFromDevice(testDevice);

      expect(result.neighborsFound).toHaveLength(1);
      expect(result.neighborsFound[0].ip).toBe("10.0.0.50");
    });

    it("enriches LLDP neighbor with MAC from ARP when both discover same IP", async () => {
      mockSnmpWalk.mockImplementation((_ip: string, _community: string, oid: string) => {
        if (oid === LLDP_OID.remManAddr) {
          return Promise.resolve([
            { oid: `${LLDP_OID.remManAddr}.0.1.1.1.4.192.168.1.10`, value: 1 },
          ]);
        }
        if (oid === LLDP_OID.remSysName) {
          return Promise.resolve([
            { oid: `${LLDP_OID.remSysName}.0.1.1`, value: "switch-a" },
          ]);
        }
        if (oid === ARP_OID.ipNetToMediaNetAddress) {
          return Promise.resolve([
            { oid: `${ARP_OID.ipNetToMediaNetAddress}.2.192.168.1.10`, value: "192.168.1.10" },
          ]);
        }
        if (oid === ARP_OID.ipNetToMediaPhysAddress) {
          return Promise.resolve([
            { oid: `${ARP_OID.ipNetToMediaPhysAddress}.2.192.168.1.10`, value: "aa:bb:cc:dd:ee:ff" },
          ]);
        }
        return Promise.resolve([]);
      });

      const engine = createStartedEngine();
      const result = await engine.discoverFromDevice(testDevice);

      expect(result.neighborsFound).toHaveLength(1);
      expect(result.neighborsFound[0].discoveryMethod).toBe("lldp");
      expect(result.neighborsFound[0].macAddress).toBe("aa:bb:cc:dd:ee:ff");
      expect(result.neighborsFound[0].hostname).toBe("switch-a");
    });
  });

  describe("deduplication", () => {
    it("marks neighbors as not new when IP exists in DB", async () => {
      mockSnmpWalk.mockImplementation((_ip: string, _community: string, oid: string) => {
        if (oid === ARP_OID.ipNetToMediaNetAddress) {
          return Promise.resolve([
            { oid: `${ARP_OID.ipNetToMediaNetAddress}.2.10.0.0.50`, value: "10.0.0.50" },
          ]);
        }
        if (oid === ARP_OID.ipNetToMediaPhysAddress) {
          return Promise.resolve([
            { oid: `${ARP_OID.ipNetToMediaPhysAddress}.2.10.0.0.50`, value: "aa:bb:cc:00:00:01" },
          ]);
        }
        return Promise.resolve([]);
      });

      mockSelectLimit.mockResolvedValue([{ id: "existing-device-id" }]);

      const engine = createStartedEngine();
      const result = await engine.discoverFromDevice(testDevice);

      expect(result.neighborsFound).toHaveLength(1);
      expect(result.neighborsFound[0].isNew).toBe(false);
      expect(result.alreadyKnown).toBe(1);
      expect(result.newDevicesCreated).toBe(0);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("does not create duplicate entries for same IP from LLDP and ARP", async () => {
      mockSnmpWalk.mockImplementation((_ip: string, _community: string, oid: string) => {
        if (oid === LLDP_OID.remManAddr) {
          return Promise.resolve([
            { oid: `${LLDP_OID.remManAddr}.0.1.1.1.4.192.168.1.10`, value: 1 },
          ]);
        }
        if (oid === ARP_OID.ipNetToMediaNetAddress) {
          return Promise.resolve([
            { oid: `${ARP_OID.ipNetToMediaNetAddress}.2.192.168.1.10`, value: "192.168.1.10" },
          ]);
        }
        if (oid === ARP_OID.ipNetToMediaPhysAddress) {
          return Promise.resolve([
            { oid: `${ARP_OID.ipNetToMediaPhysAddress}.2.192.168.1.10`, value: "aa:bb:cc:dd:ee:ff" },
          ]);
        }
        return Promise.resolve([]);
      });

      const engine = createStartedEngine();
      const result = await engine.discoverFromDevice(testDevice);

      expect(result.neighborsFound).toHaveLength(1);
      expect(result.newDevicesCreated).toBe(1);
    });
  });

  describe("new device creation", () => {
    it("inserts new device with hostname from LLDP when available", async () => {
      mockSnmpWalk.mockImplementation((_ip: string, _community: string, oid: string) => {
        if (oid === LLDP_OID.remManAddr) {
          return Promise.resolve([
            { oid: `${LLDP_OID.remManAddr}.0.1.1.1.4.192.168.1.10`, value: 1 },
          ]);
        }
        if (oid === LLDP_OID.remSysName) {
          return Promise.resolve([
            { oid: `${LLDP_OID.remSysName}.0.1.1`, value: "switch-a" },
          ]);
        }
        return Promise.resolve([]);
      });

      const engine = createStartedEngine();
      await engine.discoverFromDevice(testDevice);

      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "switch-a",
          ip: "192.168.1.10",
          type: "other",
          status: "unknown",
          pollingEnabled: true,
        }),
      );
    });

    it("uses fallback name when hostname is not available", async () => {
      mockSnmpWalk.mockImplementation((_ip: string, _community: string, oid: string) => {
        if (oid === ARP_OID.ipNetToMediaNetAddress) {
          return Promise.resolve([
            { oid: `${ARP_OID.ipNetToMediaNetAddress}.2.10.0.0.99`, value: "10.0.0.99" },
          ]);
        }
        if (oid === ARP_OID.ipNetToMediaPhysAddress) {
          return Promise.resolve([
            { oid: `${ARP_OID.ipNetToMediaPhysAddress}.2.10.0.0.99`, value: "ff:ff:ff:00:00:01" },
          ]);
        }
        return Promise.resolve([]);
      });

      const engine = createStartedEngine();
      await engine.discoverFromDevice(testDevice);

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ name: "discovered-10.0.0.99" }),
      );
    });
  });

  describe("error handling", () => {
    it("records LLDP walk errors and continues with ARP", async () => {
      let callCount = 0;
      mockSnmpWalk.mockImplementation((_ip: string, _community: string, oid: string) => {
        if (oid.startsWith("1.0.8802")) {
          callCount++;
          if (callCount <= 4) return Promise.reject(new Error("LLDP timeout"));
        }
        if (oid === ARP_OID.ipNetToMediaNetAddress) {
          return Promise.resolve([
            { oid: `${ARP_OID.ipNetToMediaNetAddress}.2.10.0.0.50`, value: "10.0.0.50" },
          ]);
        }
        if (oid === ARP_OID.ipNetToMediaPhysAddress) {
          return Promise.resolve([
            { oid: `${ARP_OID.ipNetToMediaPhysAddress}.2.10.0.0.50`, value: "aa:bb:cc:00:00:01" },
          ]);
        }
        return Promise.resolve([]);
      });

      const engine = createStartedEngine();
      const result = await engine.discoverFromDevice(testDevice);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("LLDP walk failed");
      expect(result.neighborsFound).toHaveLength(1);
      expect(result.neighborsFound[0].ip).toBe("10.0.0.50");
    });

    it("records ARP walk errors and keeps LLDP results", async () => {
      mockSnmpWalk.mockImplementation((_ip: string, _community: string, oid: string) => {
        if (oid === LLDP_OID.remManAddr) {
          return Promise.resolve([
            { oid: `${LLDP_OID.remManAddr}.0.1.1.1.4.192.168.1.10`, value: 1 },
          ]);
        }
        if (oid.startsWith("1.3.6.1.2.1.4.22")) {
          return Promise.reject(new Error("ARP timeout"));
        }
        return Promise.resolve([]);
      });

      const engine = createStartedEngine();
      const result = await engine.discoverFromDevice(testDevice);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("ARP walk failed");
      expect(result.neighborsFound).toHaveLength(1);
    });

    it("returns error when no SNMP community is configured", async () => {
      const engine = createStartedEngine({
        redisUrl: "redis://localhost:6379",
        databaseUrl: "postgres://localhost/test",
      });

      const result = await engine.discoverFromDevice({
        id: "dev-no-snmp",
        name: "no-snmp-device",
        ip: "10.0.0.99",
      });

      expect(result.errors).toContain("No SNMP community configured");
      expect(result.neighborsFound).toHaveLength(0);
    });

    it("records DB errors during deduplication without crashing", async () => {
      mockSnmpWalk.mockImplementation((_ip: string, _community: string, oid: string) => {
        if (oid === ARP_OID.ipNetToMediaNetAddress) {
          return Promise.resolve([
            { oid: `${ARP_OID.ipNetToMediaNetAddress}.2.10.0.0.50`, value: "10.0.0.50" },
          ]);
        }
        return Promise.resolve([]);
      });

      mockSelectLimit.mockRejectedValue(new Error("DB connection lost"));

      const engine = createStartedEngine();
      const result = await engine.discoverFromDevice(testDevice);

      expect(result.errors.some((e) => e.includes("DB error"))).toBe(true);
    });
  });

  describe("empty results", () => {
    it("returns empty neighbors when LLDP and ARP return no entries", async () => {
      mockSnmpWalk.mockResolvedValue([]);

      const engine = createStartedEngine();
      const result = await engine.discoverFromDevice(testDevice);

      expect(result.neighborsFound).toHaveLength(0);
      expect(result.newDevicesCreated).toBe(0);
      expect(result.alreadyKnown).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("runFullDiscovery", () => {
    it("iterates all polling-enabled devices", async () => {
      const deviceList = [
        { id: "d1", name: "sw1", ip: "10.0.0.1", snmpCommunity: "public", snmpPort: 161, pollingEnabled: true },
        { id: "d2", name: "sw2", ip: "10.0.0.2", snmpCommunity: "public", snmpPort: 161, pollingEnabled: true },
      ];

      mockSelectFrom.mockReturnValueOnce({
        where: vi.fn().mockReturnValue(deviceList),
      });

      mockSnmpWalk.mockResolvedValue([]);

      const engine = createStartedEngine();
      const results = await engine.runFullDiscovery();

      expect(results).toHaveLength(2);
      expect(results[0].sourceDeviceId).toBe("d1");
      expect(results[1].sourceDeviceId).toBe("d2");
    });

    it("catches per-device errors without stopping full discovery", async () => {
      const deviceList = [
        { id: "d1", name: "sw1", ip: "10.0.0.1", snmpCommunity: "public", snmpPort: 161, pollingEnabled: true },
        { id: "d2", name: "sw2", ip: "10.0.0.2", snmpCommunity: "public", snmpPort: 161, pollingEnabled: true },
      ];

      mockSelectFrom.mockReturnValueOnce({
        where: vi.fn().mockReturnValue(deviceList),
      });

      let deviceCallCount = 0;
      mockSnmpWalk.mockImplementation(() => {
        deviceCallCount++;
        if (deviceCallCount <= 6) return Promise.reject(new Error("SNMP fail"));
        return Promise.resolve([]);
      });

      const engine = createStartedEngine();
      const results = await engine.runFullDiscovery();

      expect(results).toHaveLength(2);
    });
  });

  describe("BullMQ scheduling", () => {
    it("creates queue and schedules repeating discovery on start", () => {
      const engine = new DiscoveryEngine(defaultConfig);
      const { queue, worker } = engine.start();

      expect(queue).toBeDefined();
      expect(worker).toBeDefined();
      expect(mockQueueAdd).toHaveBeenCalledWith(
        "full-discovery",
        {},
        expect.objectContaining({
          repeat: { every: 3600000 },
          jobId: "scheduled-full-discovery",
        }),
      );
    });

    it("uses custom discovery interval", () => {
      const engine = new DiscoveryEngine({ ...defaultConfig, discoveryInterval: 600 });
      engine.start();

      expect(mockQueueAdd).toHaveBeenCalledWith(
        "full-discovery",
        {},
        expect.objectContaining({
          repeat: { every: 600000 },
        }),
      );
    });

    it("cleans up on shutdown", async () => {
      const engine = createStartedEngine();
      await engine.shutdown();

      expect(mockWorkerClose).toHaveBeenCalled();
      expect(mockQueueClose).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
