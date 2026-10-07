import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import { aiProviders, incidents, incidentEvents, devices } from "@netpulse/shared";
import { AIEngine } from "@netpulse/ai-engine";
import { parse, astVisitor, toSql } from "pgsql-ast-parser";
import { deviceScope, HttpError, assertDeviceAccess } from "./access.js";
import { emitDeviceEvent } from "./realtime.js";

export async function getDefaultEngine(app: FastifyInstance) {
  const providers = await app.db.select().from(aiProviders).where(eq(aiProviders.enabled, true));
  const provider = providers.find(p => p.isDefault) ?? providers[0];
  if (!provider) throw new HttpError(503, "No enabled AI provider configured");
  return new AIEngine({ type: provider.type, apiKey: provider.apiKey, model: provider.model ?? undefined, baseUrl: provider.baseUrl ?? undefined, enabled: true });
}

const allowedTables = new Set(["devices", "metrics", "incidents", "interfaces"]);
const allowedFunctions = new Set(["count", "avg", "max", "min", "sum", "round", "coalesce", "nullif", "abs", "lower", "upper", "length", "date_trunc", "time_bucket", "now", "stddev", "stddev_pop", "regr_slope", "regr_intercept", "greatest", "least"]);
export function validateReadQuery(raw: string) {
  const statements = parse(raw);
  if (statements.length !== 1 || statements[0].type !== "select") throw new HttpError(400, "Only one SELECT query is supported");
  const visitor = astVisitor(map => ({
    tableRef: table => {
      if (table.schema || !allowedTables.has(table.name)) throw new HttpError(400, "Query contains an unsupported table");
    },
    call: call => {
      if (call.function.schema || !allowedFunctions.has(call.function.name.toLowerCase())) throw new HttpError(400, "Query contains an unsupported function");
      map.super().call(call);
    },
    selection: select => {
      if ("for" in select && select.for) throw new HttpError(400, "Locking queries are not supported");
      map.super().selection(select);
    },
  }));
  visitor.statement(statements[0]);
  const serialized = toSql.statement(statements[0]);
  if (/::\s*(?:reg\w+|["\w]+\s*\.)/i.test(serialized)) throw new HttpError(400, "Unsupported cast");
  return serialized;
}

export async function executeReadQuery(request: FastifyRequest, raw: string) {
  const validated = validateReadQuery(raw);
  // CTEs expose only public columns and scope every table before joins/aggregates.
  return request.server.db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    await tx.execute(sql`SET LOCAL statement_timeout = '5s'`);
    return tx.execute(sql`
      WITH devices AS (
        SELECT id, name, ip, type, status, location, tags FROM public.devices WHERE ${deviceScope(request, devices.id)}
      ), metrics AS (
        SELECT device_id, metric_name, value, unit, timestamp FROM public.metrics WHERE device_id IN (SELECT id FROM devices)
      ), incidents AS (
        SELECT id, device_id, severity, status, title, started_at, resolved_at FROM public.incidents WHERE device_id IN (SELECT id FROM devices)
      ), interfaces AS (
        SELECT id, device_id, if_index, name, speed, status, in_bps, out_bps FROM public.interfaces WHERE device_id IN (SELECT id FROM devices)
      ) SELECT * FROM (${sql.raw(validated)}) AS query_result LIMIT 1000
    `);
  });
}

export async function generateIncidentRca(request: FastifyRequest, id: string) {
  const app = request.server;
  const incident = await app.db.query.incidents.findFirst({ where: eq(incidents.id, id), with: { device: true } });
  if (!incident) throw new HttpError(404, "Incident not found");
  await assertDeviceAccess(request, incident.deviceId);
  const engine = await getDefaultEngine(app);
  const recent = await app.db.execute(sql`
    SELECT metric_name, AVG(value) AS avg_val, time_bucket('5 minutes', timestamp) AS bucket
    FROM metrics WHERE device_id = ${incident.deviceId} AND timestamp >= NOW() - INTERVAL '60 minutes'
    GROUP BY metric_name, bucket ORDER BY bucket DESC LIMIT 100
  `);
  const similar = await app.db.select().from(incidents).where(eq(incidents.deviceId, incident.deviceId)).orderBy(desc(incidents.startedAt)).limit(5);
  const rca = await engine.generateRCA({
    incident: { title: incident.title, severity: incident.severity, metricName: incident.metricName ?? undefined, metricValue: incident.metricValue ?? undefined, startedAt: incident.startedAt.toISOString() },
    device: { name: incident.device.name, ip: incident.device.ip, type: incident.device.type, location: incident.device.location ?? undefined },
    recentMetrics: recent.map(r => ({ time: String(r.bucket), metricName: String(r.metric_name), value: Number(r.avg_val) })),
    similarIncidents: similar.map(i => ({ title: i.title, resolution: i.aiSummary ?? undefined })),
  });
  const [updated] = await app.db.update(incidents).set({ aiRca: JSON.stringify(rca), aiSummary: rca.summary, updatedAt: new Date() }).where(eq(incidents.id, id)).returning();
  await app.db.insert(incidentEvents).values({ incidentId: id, type: "ai_analysis", message: "AI root cause analysis generated", metadata: { rca }, createdBy: request.userId });
  await emitDeviceEvent(app, "incident:updated", incident.deviceId, updated);
  return { updated, rca };
}
