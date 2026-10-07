import type { Database } from "@netpulse/shared";
import type { Server as SocketIOServer } from "socket.io";
import type { startPollingEngine, DiscoveryEngine } from "@netpulse/polling-engine";
import type { Sql } from "postgres";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
    dbClient: Sql;
    io: SocketIOServer;
    pollingEngine?: ReturnType<typeof startPollingEngine>;
    discoveryEngine?: ReturnType<DiscoveryEngine["start"]>;
  }
  interface FastifyRequest {
    userId?: string;
    userRole?: string;
    userScope?: string;
    userAllowedDeviceIds?: string[];
    userAllowedGroupIds?: string[];
    userDeviceIds?: string[] | null;
    auditLogged?: boolean;
  }
}
