import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../middleware/auth.js";

export async function discoveryRoutes(app: FastifyInstance) {
  app.post("/run", { preHandler: [requireRole("super_admin", "admin")] }, async (request, reply) => {
    const body = z.object({ deviceId: z.string().uuid().optional() }).parse(request.body ?? {});
    const engine = app.discoveryEngine;
    if (!engine) return reply.code(503).send({ error: "Discovery is unavailable" });
    const job = await engine.queue.add(body.deviceId ? "device-discovery" : "full-discovery", body, { removeOnComplete: 50, removeOnFail: 20 });
    return reply.code(202).send({ jobId: job.id });
  });
  app.get("/jobs", { preHandler: [requireRole("super_admin", "admin")] }, async (_request, reply) => {
    if (!app.discoveryEngine) return reply.code(503).send({ error: "Discovery is unavailable" });
    const jobs = await app.discoveryEngine.queue.getJobs(["waiting", "active", "completed", "failed"], 0, 19);
    return { data: await Promise.all(jobs.map(async job => ({ id: job.id, name: job.name, deviceId: job.data.deviceId, state: await job.getState(), result: job.returnvalue, error: job.failedReason, timestamp: job.timestamp }))) };
  });
}
