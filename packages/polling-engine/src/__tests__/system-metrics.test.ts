import { describe, it, expect } from "vitest";
import { collectSystemMetrics, type SnmpMetricReader } from "../system-metrics.js";

function fixture(enterprise: number, columns: Record<string, [string, string | number][]>, scalars: Record<string, string | number> = {}): SnmpMetricReader {
  return {
    get: async oids => Object.fromEntries(oids.filter(oid => oid in scalars || oid === "1.3.6.1.2.1.1.2.0").map(oid => [oid, scalars[oid] ?? `1.3.6.1.4.1.${enterprise}.0`])),
    walk: async oid => (columns[oid] ?? []).map(([index, value]) => ({ oid: `${oid}.${index}`, value })),
  };
}
describe("Resource collection across supported MIBs", () => {
  it("joins Cisco memory pools by sparse index and weights by capacity", async () => {
    const result = await collectSystemMetrics(fixture(9, {
      "1.3.6.1.4.1.9.9.109.1.1.1.1.6": [["7", 40]],
      "1.3.6.1.4.1.9.9.48.1.1.1.5": [["5", 20], ["9", 180], ["99", 800]],
      "1.3.6.1.4.1.9.9.48.1.1.1.6": [["9", 20], ["5", 80]],
    }));
    expect(result).toContainEqual({ name: "cpu", value: 40, unit: "%" });
    expect(result).toContainEqual({ name: "memory", value: 67, unit: "%" });
  });
  it("uses compound Juniper indices and excludes unsupported percentages", async () => {
    const result = await collectSystemMetrics(fixture(2636, {
      "1.3.6.1.4.1.2636.3.1.13.1.8": [["9.1.0.0", 60], ["9.2.0.0", 40], ["8.1.0.0", -1]],
      "1.3.6.1.4.1.2636.3.1.13.1.11": [["9.1.0.0", 75]],
    }));
    expect(result).toEqual([{ name: "cpu", value: 50, unit: "%" }, { name: "memory", value: 75, unit: "%" }]);
  });
  it("reads Huawei entity CPU and memory without UCD or host resources", async () => {
    expect(await collectSystemMetrics(fixture(2011, {
      "1.3.6.1.4.1.2011.5.25.31.1.1.1.1.5": [["9", 95]],
      "1.3.6.1.4.1.2011.5.25.31.1.1.1.1.7": [["9", 0]],
    }))).toEqual([{ name: "cpu", value: 95, unit: "%" }, { name: "memory", value: 0, unit: "%" }]);
  });
  it("joins RAM rows with allocation units and excludes disk and swap", async () => {
    const result = await collectSystemMetrics(fixture(47196, {
      "1.3.6.1.2.1.25.3.3.1.2": [["5", 20], ["9", 40]],
      "1.3.6.1.2.1.25.2.3.1.2": [["5", "1.3.6.1.2.1.25.2.1.2"], ["9", "1.3.6.1.2.1.25.2.1.3"], ["11", "1.3.6.1.2.1.25.2.1.4"], ["13", "1.3.6.1.2.1.25.2.1.2"]],
      "1.3.6.1.2.1.25.2.3.1.4": [["13", 2048], ["5", 1024], ["9", 4096], ["11", 4096]],
      "1.3.6.1.2.1.25.2.3.1.5": [["5", 100], ["9", 1000], ["11", 1000], ["13", 100]],
      "1.3.6.1.2.1.25.2.3.1.6": [["11", 999], ["9", 999], ["13", 50], ["5", 20]],
    }));
    expect(result).toContainEqual({ name: "memory", value: 40, unit: "%" });
    expect(result).toContainEqual({ name: "cpu", value: 30, unit: "%" });
  });
  it("keeps CPU when an optional UCD request is rejected", async () => {
    const reader = fixture(8072, { "1.3.6.1.2.1.25.3.3.1.2": [["1", 0]] });
    reader.get = async () => { throw new Error("SNMPv1 noSuchName"); };
    expect(await collectSystemMetrics(reader)).toEqual([{ name: "cpu", value: 0, unit: "%" }]);
  });
  it("does not emit invalid numeric values or query another vendor's MIB", async () => {
    expect(await collectSystemMetrics(fixture(99999, { "1.3.6.1.4.1.9.9.109.1.1.1.1.6": [["1", 42]], "1.3.6.1.2.1.25.3.3.1.2": [["1", ""], ["2", 101]] }, { "1.3.6.1.4.1.2021.4.5.0": 100, "1.3.6.1.4.1.2021.4.6.0": 120, "1.3.6.1.4.1.2021.10.1.3.1": "NaN" }))).toEqual([]);
    expect(await collectSystemMetrics(fixture(99999, {}, { "1.3.6.1.4.1.2021.4.5.0": "Infinity", "1.3.6.1.4.1.2021.4.6.0": 0 }))).toEqual([]);
  });
});
