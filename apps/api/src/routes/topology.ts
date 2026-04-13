import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { topologyPositions } from "@netpulse/shared";
import { authenticate } from "../middleware/auth.js";

const positionItemSchema = z.object({
  deviceId: z.string().min(1),
  x: z.number(),
  y: z.number(),
});

const bulkPositionsSchema = z.array(positionItemSchema).min(1);

export async function topologyRoutes(app: FastifyInstance) {
  app.get("/positions", { preHandler: [authenticate] }, async (request) => {
    const userId = request.userId!;
    const result = await app.db
      .select()
      .from(topologyPositions)
      .where(eq(topologyPositions.userId, userId));
    return { data: result };
  });

  app.put("/positions", { preHandler: [authenticate] }, async (request) => {
    const userId = request.userId!;
    const positions = bulkPositionsSchema.parse(request.body);

    const results = await Promise.all(
      positions.map((pos) =>
        app.db
          .insert(topologyPositions)
          .values({ userId, deviceId: pos.deviceId, x: pos.x, y: pos.y })
          .onConflictDoUpdate({
            target: [topologyPositions.userId, topologyPositions.deviceId],
            set: { x: pos.x, y: pos.y, updatedAt: new Date() },
          })
          .returning()
      )
    );

    return { data: results.map((r) => r[0]) };
  });
}
