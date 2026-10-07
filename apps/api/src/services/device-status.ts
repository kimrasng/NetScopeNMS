import type { FastifyInstance } from "fastify";
import { eq, and, ne, desc } from "drizzle-orm";
import { devices, incidents, metrics } from "@netpulse/shared";
import { isDeviceInMaintenance } from "./maintenance.js";
import { emitDeviceEvent } from "./realtime.js";
export async function refreshDeviceStatus(app: FastifyInstance, deviceId: string) {
  const device = await app.db.query.devices.findFirst({ where: eq(devices.id, deviceId) });
  if (!device) return;
  const [active, ping] = await Promise.all([
    app.db.query.incidents.findFirst({ where: and(eq(incidents.deviceId, deviceId), ne(incidents.status, "resolved")) }),
    app.db.query.metrics.findFirst({ where: and(eq(metrics.deviceId, deviceId), eq(metrics.metricName, "ping")), orderBy: desc(metrics.timestamp) }),
  ]);
  const status = await isDeviceInMaintenance(app.db, device) ? "maintenance" : ping ? ping.value > 0 ? active ? "warning" : "up" : "down" : "unknown";
  const [updated] = await app.db.update(devices).set({ status, updatedAt: new Date() }).where(eq(devices.id, deviceId)).returning();
  await emitDeviceEvent(app, "device:updated", deviceId, { id: updated.id, status });
}
