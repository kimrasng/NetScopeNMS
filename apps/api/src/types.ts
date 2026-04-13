import type { Database } from "@netpulse/shared";
import type { Server as SocketIOServer } from "socket.io";
import type { Sql } from "postgres";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
    dbClient: Sql;
    io: SocketIOServer;
  }
  interface FastifyRequest {
    userId?: string;
    userRole?: string;
    userScope?: string;
    userAllowedDeviceIds?: string[];
    userAllowedGroupIds?: string[];
  }
}
