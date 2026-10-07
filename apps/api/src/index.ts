import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import { createVerifier } from "fast-jwt";
import { Server } from "socket.io";
import { createDb, devices, incidents, metrics } from "@netpulse/shared";
import { startPollingEngine, TrapReceiver, DiscoveryEngine } from "@netpulse/polling-engine";
import { loadPrincipal } from "./services/access.js";
import { z } from "zod";
import { registerRequestPolicy } from "./services/request-policy.js";
import { eq, and, ne, desc } from "drizzle-orm";
import { emitDeviceEvent } from "./services/realtime.js";
import { startThresholdEngine } from "./services/threshold-engine.js";
import { startDeliveryEngine } from "./services/delivery.js";
import { startTrapEngine } from "./services/traps.js";
import { isDeviceInMaintenance } from "./services/maintenance.js";
import { deviceGroupRoutes } from "./routes/device-groups.js";
import { discoveryRoutes } from "./routes/discovery.js";
import { config } from "./config.js";
import { deviceRoutes } from "./routes/devices.js";
import { authRoutes } from "./routes/auth.js";
import { incidentRoutes } from "./routes/incidents.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { aiRoutes } from "./routes/ai.js";
import { notificationRoutes } from "./routes/notifications.js";
import { metricsRoutes } from "./routes/metrics.js";
import { alertRuleRoutes } from "./routes/alert-rules.js";
import { reportRoutes } from "./routes/reports.js";
import { setupRoutes } from "./routes/setup.js";
import { auditLogRoutes } from "./routes/audit-logs.js";
import { configSnapshotRoutes } from "./routes/config-snapshots.js";
import { maintenanceWindowRoutes } from "./routes/maintenance-windows.js";
import { apiKeyRoutes } from "./routes/api-keys.js";
import { dashboardCrudRoutes } from "./routes/dashboards.js";
import { topologyRoutes } from "./routes/topology.js";

/**
 * Bootstrap the Fastify server with all plugins and routes.
 */
async function main() {
  const app = Fastify({
    ajv: { customOptions: { useDefaults: false, coerceTypes: false, removeAdditional: false } },
    logger: {
      level: config.logLevel,
      transport: config.nodeEnv === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
    },
  });

  // ─── Database ────────────────────────────────────
  const { db, client } = createDb(config.databaseUrl);
  app.decorate("db", db);
  app.decorate("dbClient", client);

  // ─── Plugins ─────────────────────────────────────
  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
  });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute",
  });

  await app.register(fastifyCookie);

  await app.register(fastifyJwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: "token", signed: false },
    sign: { expiresIn: "7d" },
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "NetPulse API",
        description: "AI-Powered Network Management System API",
        version: "1.0.0",
      },
      servers: [{ url: `http://localhost:${config.apiPort}` }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
  });

  registerRequestPolicy(app);

  // ─── Routes ──────────────────────────────────────
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(deviceRoutes, { prefix: "/api/devices" });
  await app.register(incidentRoutes, { prefix: "/api/incidents" });
  await app.register(dashboardRoutes, { prefix: "/api/dashboard" });
  await app.register(aiRoutes, { prefix: "/api/ai" });
  await app.register(notificationRoutes, { prefix: "/api/notifications" });
  await app.register(metricsRoutes, { prefix: "/api/metrics" });
  await app.register(alertRuleRoutes, { prefix: "/api/alert-rules" });
  await app.register(reportRoutes, { prefix: "/api/reports" });
  await app.register(setupRoutes, { prefix: "/api/setup" });
  await app.register(auditLogRoutes, { prefix: "/api/audit-logs" });
  await app.register(configSnapshotRoutes, { prefix: "/api/config-snapshots" });
  await app.register(maintenanceWindowRoutes, { prefix: "/api/maintenance-windows" });
  await app.register(apiKeyRoutes, { prefix: "/api/api-keys" });
  await app.register(dashboardCrudRoutes, { prefix: "/api/dashboards" });
  await app.register(topologyRoutes, { prefix: "/api/topology" });
  await app.register(deviceGroupRoutes, { prefix: "/api/device-groups" });
  await app.register(discoveryRoutes, { prefix: "/api/discovery" });

  // ─── Health Check ────────────────────────────────
  const health = { polling: false, thresholds: false, delivery: false, traps: !config.trapEnabled, discovery: !config.discoveryEnabled };
  app.get("/api/health", async (_request, reply) => {
    const healthy = Object.values(health).every(Boolean);
    return reply.code(healthy ? 200 : 503).send({ status: healthy ? "ok" : "degraded", services: health, timestamp: new Date().toISOString() });
  });

  // ─── Socket.IO ───────────────────────────────────
  const io = new Server(app.server, {
    cors: { origin: config.corsOrigin, credentials: true },
    path: "/ws",
  });
  app.decorate("io", io);

  const verifyJwt = createVerifier({ key: config.jwtSecret, algorithms: ["HS256"] });

  io.use(async (socket, next) => {
    try {
      const token = z.string().parse(socket.handshake.auth?.token);
      const decoded = z.object({ id: z.string().uuid(), authVersion: z.number().default(0) }).parse(verifyJwt(token));
      const { user } = await loadPrincipal(db, decoded.id);
      if (decoded.authVersion !== user.authVersion) throw new Error("Session revoked");
      socket.data.userId = user.id;
      socket.data.authVersion = user.authVersion;
      next();
    } catch { next(new Error("Invalid or unavailable account")); }
  });

  io.on("connection", (socket) => {
    app.log.info(`Socket connected: ${socket.id}`);
    socket.on("disconnect", () => {
      app.log.info(`Socket disconnected: ${socket.id}`);
    });
  });

  const polling = startPollingEngine({
    redisUrl: config.redisUrl, databaseUrl: config.databaseUrl, concurrency: 10,
    isInMaintenance: device => isDeviceInMaintenance(db, device),
    onResult: async result => {
      const device = await db.query.devices.findFirst({ where: eq(devices.id, result.deviceId) });
      if (device) await emitDeviceEvent(app, "device:updated", device.id, { id: device.id, status: device.status, lastPolledAt: device.lastPolledAt });
      await emitDeviceEvent(app, "metric:updated", result.deviceId, { deviceId: result.deviceId });
    },
  });
  app.decorate("pollingEngine", polling);
  const thresholds = startThresholdEngine({ redisUrl: config.redisUrl, databaseUrl: config.databaseUrl,
    onIncident: async (deviceId, incidentId) => {
      const incident = await db.query.incidents.findFirst({ where: eq(incidents.id, incidentId) });
      if (incident) await emitDeviceEvent(app, "incident:updated", deviceId, incident);
      const device = await db.query.devices.findFirst({ where: eq(devices.id, deviceId) });
      if (device) {
        const active = await db.query.incidents.findFirst({ where: and(eq(incidents.deviceId, deviceId), ne(incidents.status, "resolved")) });
        const ping = await db.query.metrics.findFirst({ where: and(eq(metrics.deviceId, deviceId), eq(metrics.metricName, "ping")), orderBy: desc(metrics.timestamp) });
        const status = await isDeviceInMaintenance(db, device) ? "maintenance" : ping ? ping.value === 1 ? active ? "warning" : "up" : "down" : "unknown";
        await db.update(devices).set({ status, updatedAt: new Date() }).where(eq(devices.id, deviceId));
        await emitDeviceEvent(app, "device:updated", deviceId, { id: deviceId, status });
      }
    },
  });
  const delivery = startDeliveryEngine(app, config.redisUrl);
  const traps = startTrapEngine(app, config.redisUrl);
  const trapReceiver = new TrapReceiver({ port: config.trapPort, community: config.trapCommunity, users: config.trapUsers, databaseUrl: config.databaseUrl, redisUrl: config.redisUrl });
  trapReceiver.on("error", error => { health.traps = false; app.log.error({ err: error }, "Trap receiver failed"); });
  if (config.trapEnabled) { trapReceiver.start(); health.traps = true; }
  let discovery: DiscoveryEngine | undefined;
  if (config.discoveryEnabled) {
    discovery = new DiscoveryEngine({ redisUrl: config.redisUrl, databaseUrl: config.databaseUrl, discoveryInterval: config.discoveryInterval,
      onDiscovered: async ids => {
        for (const id of ids) {
          await polling.syncDevice(id);
          await emitDeviceEvent(app, "topology:updated", id, { deviceId: id });
        }
      },
    });
    const started = discovery.start();
    app.decorate("discoveryEngine", started);
    await started.worker.waitUntilReady();
    started.worker.on("error", error => { health.discovery = false; app.log.error({ err: error }, "Discovery worker failed"); });
    health.discovery = true;
  }
  for (const [name, worker] of [["polling", polling.worker], ["thresholds", thresholds.worker], ["delivery", delivery.worker]] as const) {
    await worker.waitUntilReady();
    health[name] = true;
    worker.on("error", error => { health[name] = false; app.log.error({ err: error, service: name }, "Worker failed"); });
  }
  traps.worker.on("error", error => { health.traps = false; app.log.error({ err: error }, "Trap worker failed"); });
  await traps.worker.waitUntilReady();
  await polling.schedulePolling();

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await trapReceiver.stop();
    await new Promise<void>(resolve => io.close(() => resolve()));
    await app.close();
    await thresholds.shutdown();
    await polling.shutdown();
    await traps.shutdown();
    if (discovery) await discovery.shutdown();
    await delivery.shutdown();
    await client.end();
    process.exit(0);
  };
  process.on("SIGTERM", () => { void shutdown(); });
  process.on("SIGINT", () => { void shutdown(); });
  await app.listen({ port: config.apiPort, host: "0.0.0.0" });
  app.log.info(`NetPulse API running on port ${config.apiPort}`);
}

main().catch(error => { console.error("Failed to start server:", error); process.exit(1); });
