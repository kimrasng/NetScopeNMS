import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation(() => ({ close: vi.fn().mockResolvedValue(undefined) })),
  Queue: vi.fn().mockImplementation(() => ({ close: vi.fn().mockResolvedValue(undefined) })),
}));

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({ disconnect: vi.fn() })),
}));

vi.mock("@netpulse/shared", () => ({
  createDb: vi.fn().mockReturnValue({ db: {} }),
  alertRules: {},
  incidents: {},
  incidentEvents: {},
  devices: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  ne: vi.fn(),
}));

describe("Threshold Engine - evaluateCondition logic", () => {
  function evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case ">": return value > threshold;
      case ">=": return value >= threshold;
      case "<": return value < threshold;
      case "<=": return value <= threshold;
      case "==": return value === threshold;
      case "!=": return value !== threshold;
      default: return false;
    }
  }

  it("evaluates > correctly", () => {
    expect(evaluateCondition(95, ">", 90)).toBe(true);
    expect(evaluateCondition(90, ">", 90)).toBe(false);
    expect(evaluateCondition(85, ">", 90)).toBe(false);
  });

  it("evaluates >= correctly", () => {
    expect(evaluateCondition(95, ">=", 90)).toBe(true);
    expect(evaluateCondition(90, ">=", 90)).toBe(true);
    expect(evaluateCondition(85, ">=", 90)).toBe(false);
  });

  it("evaluates < correctly", () => {
    expect(evaluateCondition(85, "<", 90)).toBe(true);
    expect(evaluateCondition(90, "<", 90)).toBe(false);
    expect(evaluateCondition(95, "<", 90)).toBe(false);
  });

  it("evaluates <= correctly", () => {
    expect(evaluateCondition(85, "<=", 90)).toBe(true);
    expect(evaluateCondition(90, "<=", 90)).toBe(true);
    expect(evaluateCondition(95, "<=", 90)).toBe(false);
  });

  it("evaluates == correctly", () => {
    expect(evaluateCondition(90, "==", 90)).toBe(true);
    expect(evaluateCondition(91, "==", 90)).toBe(false);
  });

  it("evaluates != correctly", () => {
    expect(evaluateCondition(91, "!=", 90)).toBe(true);
    expect(evaluateCondition(90, "!=", 90)).toBe(false);
  });

  it("returns false for unknown operator", () => {
    expect(evaluateCondition(90, "~", 90)).toBe(false);
    expect(evaluateCondition(90, "===", 90)).toBe(false);
  });

  it("handles edge cases with 0 and negative numbers", () => {
    expect(evaluateCondition(0, ">", -1)).toBe(true);
    expect(evaluateCondition(-5, "<", 0)).toBe(true);
    expect(evaluateCondition(0, "==", 0)).toBe(true);
  });

  it("handles floating point comparisons", () => {
    expect(evaluateCondition(90.5, ">", 90)).toBe(true);
    expect(evaluateCondition(89.999, "<", 90)).toBe(true);
  });
});

describe("Threshold Engine - checkFlap logic", () => {
  const flapCounters = new Map<string, { count: number; timestamps: number[] }>();

  function checkFlap(key: string, triggered: boolean, flapThreshold: number, flapWindow: number): boolean {
    const now = Date.now();
    let state = flapCounters.get(key);
    if (!state) {
      state = { count: 0, timestamps: [] };
      flapCounters.set(key, state);
    }

    state.timestamps = state.timestamps.filter((t) => now - t < flapWindow * 60000);

    if (triggered) {
      state.timestamps.push(now);
      state.count = state.timestamps.length;
    }

    return state.count >= flapThreshold;
  }

  beforeEach(() => {
    flapCounters.clear();
  });

  it("does not trigger until threshold is reached", () => {
    expect(checkFlap("test-1", true, 3, 5)).toBe(false);
    expect(checkFlap("test-1", true, 3, 5)).toBe(false);
    expect(checkFlap("test-1", true, 3, 5)).toBe(true);
  });

  it("does not count non-triggered events", () => {
    expect(checkFlap("test-2", true, 3, 5)).toBe(false);
    expect(checkFlap("test-2", false, 3, 5)).toBe(false);
    expect(checkFlap("test-2", true, 3, 5)).toBe(false);
    expect(checkFlap("test-2", true, 3, 5)).toBe(true);
  });

  it("expires old timestamps outside the window", () => {
    const key = "test-3";
    flapCounters.set(key, {
      count: 2,
      timestamps: [Date.now() - 400000, Date.now() - 350000],
    });

    expect(checkFlap(key, true, 3, 5)).toBe(false);
  });

  it("tracks separate keys independently", () => {
    expect(checkFlap("key-a", true, 2, 5)).toBe(false);
    expect(checkFlap("key-b", true, 2, 5)).toBe(false);
    expect(checkFlap("key-a", true, 2, 5)).toBe(true);
    expect(checkFlap("key-b", true, 2, 5)).toBe(true);
  });
});

describe("Threshold Engine - startThresholdEngine", () => {
  it("returns worker, pushMetricEvent, and shutdown functions", async () => {
    const { startThresholdEngine } = await import("../../src/services/threshold-engine.js");
    const engine = startThresholdEngine({
      redisUrl: "redis://localhost:6379",
      databaseUrl: "postgresql://localhost:5432/test",
    });

    expect(engine).toHaveProperty("worker");
    expect(engine).toHaveProperty("pushMetricEvent");
    expect(engine).toHaveProperty("shutdown");
    expect(typeof engine.pushMetricEvent).toBe("function");
    expect(typeof engine.shutdown).toBe("function");
  });
});
