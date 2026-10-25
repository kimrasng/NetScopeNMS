export interface SnmpMetricReader {
  get: (oids: string[]) => Promise<Record<string, string | number>>;
  walk: (oid: string) => Promise<{ oid: string; value: string | number }[]>;
}

type Metric = { name: string; value: number; unit?: string };
const HOST_CPU = "1.3.6.1.2.1.25.3.3.1.2";
const STORAGE = "1.3.6.1.2.1.25.2.3.1";
const RAM_TYPE = "1.3.6.1.2.1.25.2.1.2";
const TOTAL = "1.3.6.1.4.1.2021.4.5.0";
const FREE = "1.3.6.1.4.1.2021.4.6.0";
const LOAD = "1.3.6.1.4.1.2021.10.1.3.1";
const OBJECT_ID = "1.3.6.1.2.1.1.2.0";

function numeric(value: string | number | undefined): number {
  const parsed = value === undefined || (typeof value === "string" && !value.trim()) ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** Optional MIBs must not prevent collection of other supported resources. */
export async function collectSystemMetrics(reader: SnmpMetricReader): Promise<Metric[]> {
  const safeGet = async (oids: string[]): Promise<Record<string, string | number>> => { try { return await reader.get(oids); } catch { return {}; } };
  const safeWalk = async (oid: string) => { try { return await reader.walk(oid); } catch { return []; } };
  const column = async (oid: string) => new Map((await safeWalk(oid)).map(row => [row.oid.slice(oid.length + 1), row.value]));
  const averagePercent = async (oid: string) => {
    const values = (await safeWalk(oid)).map(row => numeric(row.value)).filter(value => Number.isFinite(value) && value >= 0 && value <= 100);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
  };
  const result: Metric[] = [];
  const [ucd, hostCpu] = await Promise.all([safeGet([LOAD, TOTAL, FREE]), averagePercent(HOST_CPU)]);
  const load = numeric(ucd[LOAD]);
  if (Number.isFinite(load) && load >= 0) result.push({ name: "load_1m", value: load });
  let cpu = hostCpu;
  let memory: number | undefined;
  const total = numeric(ucd[TOTAL]), free = numeric(ucd[FREE]);
  if (total > 0 && free >= 0 && free <= total) memory = (total - free) / total * 100;

  if (memory === undefined) {
    const [types, units, sizes, used] = await Promise.all([column(`${STORAGE}.2`), column(`${STORAGE}.4`), column(`${STORAGE}.5`), column(`${STORAGE}.6`)]);
    let totalBytes = 0, usedBytes = 0;
    for (const [index, type] of types) {
      if (String(type) !== RAM_TYPE) continue;
      const unit = numeric(units.get(index)), size = numeric(sizes.get(index)), usage = numeric(used.get(index));
      if (unit > 0 && size > 0 && usage >= 0 && usage <= size) { totalBytes += unit * size; usedBytes += unit * usage; }
    }
    if (totalBytes > 0) memory = usedBytes / totalBytes * 100;
  }

  if (cpu === undefined || memory === undefined) {
    const identity = String((await safeGet([OBJECT_ID]))[OBJECT_ID] ?? "");
    if (identity.startsWith("1.3.6.1.4.1.9.")) {
      if (cpu === undefined) cpu = await averagePercent("1.3.6.1.4.1.9.9.109.1.1.1.1.6");
      if (memory === undefined) {
        const [used, free] = await Promise.all([column("1.3.6.1.4.1.9.9.48.1.1.1.5"), column("1.3.6.1.4.1.9.9.48.1.1.1.6")]);
        let capacity = 0, usage = 0;
        for (const [index, value] of used) {
          const usedBytes = numeric(value), freeBytes = numeric(free.get(index));
          if (usedBytes >= 0 && freeBytes >= 0 && usedBytes + freeBytes > 0) { capacity += usedBytes + freeBytes; usage += usedBytes; }
        }
        if (capacity > 0) memory = usage / capacity * 100;
      }
    } else if (identity.startsWith("1.3.6.1.4.1.2636.")) {
      if (cpu === undefined) cpu = await averagePercent("1.3.6.1.4.1.2636.3.1.13.1.8");
      if (memory === undefined) memory = await averagePercent("1.3.6.1.4.1.2636.3.1.13.1.11");
    } else if (identity.startsWith("1.3.6.1.4.1.2011.")) {
      if (cpu === undefined) cpu = await averagePercent("1.3.6.1.4.1.2011.5.25.31.1.1.1.1.5");
      if (memory === undefined) memory = await averagePercent("1.3.6.1.4.1.2011.5.25.31.1.1.1.1.7");
    }
  }
  if (cpu !== undefined) result.push({ name: "cpu", value: cpu, unit: "%" });
  if (memory !== undefined) result.push({ name: "memory", value: Math.round(memory), unit: "%" });
  return result;
}
