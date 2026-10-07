import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { incidents, configSnapshots } from "@netpulse/shared";
import { authenticate } from "../middleware/auth.js";
import { assertDeviceAccess, HttpError, publicResource } from "./access.js";
import { pagination, dateRange } from "./validation.js";
import { responseContracts, bodySchema } from "./contracts.js";
import { logAudit } from "../routes/audit-logs.js";

export function registerRequestPolicy(app: FastifyInstance) {
  app.addHook("onRoute", options => {
    const schema = responseContracts.get(`${options.method} ${options.url.replace(/\/$/, "")}`);
    if (schema) {
      const response = options.schema?.response;
      options.schema = { ...options.schema, response: { ...(response && typeof response === "object" ? response : {}), [options.method === "POST" && options.url !== "/api/ai/query" ? 201 : 200]: bodySchema(schema).body } };
    }
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: "Invalid input", message: error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") });
    const metadata = z.object({ code: z.string().optional(), statusCode: z.number().int().min(400).max(599).optional() }).passthrough().safeParse(error);
    const code = metadata.success ? metadata.data.code ?? "" : "";
    if (["22P02", "22007", "22008", "22003"].includes(code)) return reply.code(400).send({ error: "Invalid input" });
    if (["23505", "23503"].includes(code)) return reply.code(409).send({ error: "Resource conflicts with existing data" });
    const status = metadata.success ? metadata.data.statusCode ?? 500 : 500;
    if (status >= 500) request.log.error({ errorType: error instanceof Error ? error.name : "unknown", code, status }, "Request failed");
    return reply.code(status).send({ error: status >= 500 ? "Request failed" : error instanceof Error ? error.message : "Request failed" });
  });
  app.addHook("preHandler", async (request, reply) => {
    const path = request.routeOptions.url ?? "";
    if (!path.startsWith("/api/") || path === "/api/health" ||
      path === "/api/auth/login" || path === "/api/setup/status" ||
      path === "/api/setup/init" || path.startsWith("/api/setup/invite/") ||
      (path === "/api/setup/site" && request.method === "GET")) return;
    await authenticate(request, reply);
    if (reply.sent) return;
    const params = z.record(z.string()).parse(request.params ?? {});
    for (const [key, value] of Object.entries(params)) {
      if (/^(id|id1|id2|incidentId|channelId)$/.test(key)) z.string().uuid().parse(value);
    }
    const query = z.record(z.unknown()).parse(request.query ?? {});
    if (query.page !== undefined || query.limit !== undefined) pagination(query);
    if (query.from !== undefined || query.to !== undefined) dateRange(z.string().optional().parse(query.from), z.string().optional().parse(query.to));
    if (query.deviceId) await assertDeviceAccess(request, z.string().uuid().parse(query.deviceId));
    if (path.startsWith("/api/devices/") && params.id) await assertDeviceAccess(request, params.id);
    if (path.startsWith("/api/incidents/") || path.startsWith("/api/ai/rca/")) {
      const id = params.id ?? params.incidentId;
      if (id) {
        const incident = await app.db.query.incidents.findFirst({ where: eq(incidents.id, id) });
        if (!incident) throw new HttpError(404, "Incident not found");
        await assertDeviceAccess(request, incident.deviceId);
      }
    }
    if (path.startsWith("/api/config-snapshots/")) {
      for (const id of [params.id, params.id1, params.id2].filter((id): id is string => !!id)) {
        const snapshot = await app.db.query.configSnapshots.findFirst({ where: eq(configSnapshots.id, id) });
        if (!snapshot) throw new HttpError(404, "Snapshot not found");
        await assertDeviceAccess(request, snapshot.deviceId);
      }
    }
    if (request.body && typeof request.body === "object" && !Array.isArray(request.body)) {
      const body = request.body as Record<string, unknown>;
      if (body.deviceId) await assertDeviceAccess(request, z.string().uuid().parse(body.deviceId));
      if (body.incidentId) {
        const incident = await app.db.query.incidents.findFirst({ where: eq(incidents.id, z.string().uuid().parse(body.incidentId)) });
        if (!incident) throw new HttpError(404, "Incident not found");
        await assertDeviceAccess(request, incident.deviceId);
      }
      if (body.groupIds && request.userScope === "restricted") for (const id of z.array(z.string().uuid()).parse(body.groupIds)) if (!request.userAllowedGroupIds?.includes(id)) throw new HttpError(403, "Group access denied");
      if (body.deviceIds) for (const id of z.array(z.string().uuid()).parse(body.deviceIds)) await assertDeviceAccess(request, id);
      if (request.userScope === "restricted" && body.groupId && !request.userAllowedGroupIds?.includes(String(body.groupId))) throw new HttpError(403, "Group access denied");
      if (request.userScope === "restricted" && path === "/api/devices/" && request.method === "POST" && !body.groupId) throw new HttpError(403, "Select an authorized group for new devices");
    }
    if (path.startsWith("/api/topology") && Array.isArray(request.body)) {
      for (const item of request.body) await assertDeviceAccess(request, z.object({ deviceId: z.string().uuid() }).parse(item).deviceId);
    }
    if (request.userScope === "restricted" && request.method !== "GET" &&
      /\/api\/(setup|alert-rules|notification|ai\/providers|discovery|maintenance-windows)/.test(path)) throw new HttpError(403, "Global administration requires full scope");
  });
  app.addHook("onSend", async (request, reply, payload) => {
    if (reply.statusCode < 400 && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && !request.auditLogged && request.routeOptions.url?.startsWith("/api/")) {
      await logAudit(app.db, { userId: request.userId, action: `${request.method.toLowerCase()}:${request.routeOptions.url}`, resource: request.routeOptions.url.startsWith("/api/ai/providers") ? "ai-provider" : ({ "api-keys": "api-key", dashboards: "dashboard", topology: "topology", setup: "user" }[request.routeOptions.url.split("/")[2]] ?? request.routeOptions.url.split("/")[2] ?? "api"), resourceId: (request.params as Record<string, string> | undefined)?.id, ipAddress: request.ip }, request);
    }
    if (typeof payload !== "string" || !String(reply.getHeader("content-type")).includes("application/json")) return payload;
    let parsed: unknown;
    try { parsed = JSON.parse(payload); } catch { return payload; }
    return JSON.stringify(publicResource(parsed));
  });
}
