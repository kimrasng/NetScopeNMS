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
import { createDb } from "@netpulse/shared";
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

  // ─── Health Check ────────────────────────────────
  app.get("/api/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // ─── Socket.IO ───────────────────────────────────
  const io = new Server(app.server, {
    cors: { origin: config.corsOrigin, credentials: true },
    path: "/ws",
  });
  app.decorate("io", io);

  const verifyJwt = createVerifier({ key: config.jwtSecret, algorithms: ["HS256"] });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      const decoded = verifyJwt(token);
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    app.log.info(`Socket connected: ${socket.id}`);
    socket.on("disconnect", () => {
      app.log.info(`Socket disconnected: ${socket.id}`);
    });
  });

  // ─── Graceful Shutdown ───────────────────────────
  const shutdown = async () => {
    app.log.info("Shutting down gracefully...");
    io.close();
    await app.close();
    await client.end();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // ─── Start ───────────────────────────────────────
  await app.listen({ port: config.apiPort, host: "0.0.0.0" });
  app.log.info(`NetPulse API running on port ${config.apiPort}`);
  app.log.info(`Swagger docs at http://localhost:${config.apiPort}/docs`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
