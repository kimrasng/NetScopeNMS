import type { FastifyInstance } from "fastify";
import { loadPrincipal, publicResource } from "./access.js";

export async function emitDeviceEvent(app: FastifyInstance, event: string, deviceId: string, payload: unknown) {
  if (!app.hasDecorator("io")) return;
  for (const socket of app.io.sockets.sockets.values()) {
    try {
      const { user, deviceIds } = await loadPrincipal(app.db, String(socket.data.userId));
      if (socket.data.authVersion !== user.authVersion) { socket.disconnect(true); continue; }
      if (deviceIds === null || deviceIds.includes(deviceId)) socket.emit(event, publicResource(payload));
    } catch { socket.disconnect(true); }
  }
}
