import { EventEmitter } from "node:events";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import snmp from "net-snmp";
import { createDb, devices } from "@netpulse/shared";
import { eq } from "drizzle-orm";

// ─── Interfaces ──────────────────────────────────────

export interface TrapReceiverConfig {
  port?: number;
  community?: string;
  disableAuthorization?: boolean;
  redisUrl?: string;
  databaseUrl?: string;
}

export interface TrapEvent {
  sourceIp: string;
  version: "v1" | "v2c" | "v3";
  oid: string;
  varbinds: { oid: string; type: number; value: unknown }[];
  timestamp: Date;
  deviceId?: string;
  community?: string;
}

/** Well-known OID for snmpTrapOID.0 used in v2c/v3 notifications */
const SNMP_TRAP_OID = "1.3.6.1.6.3.1.1.4.1.0";

// ─── TrapReceiver ────────────────────────────────────

export class TrapReceiver extends EventEmitter {
  private config: Required<Pick<TrapReceiverConfig, "port" | "community" | "disableAuthorization">> & {
    redisUrl?: string;
    databaseUrl?: string;
  };
  private receiver: ReturnType<typeof snmp.createReceiver> | null = null;
  private trapQueue: Queue | null = null;
  private redis: IORedis | null = null;
  private db: ReturnType<typeof createDb>["db"] | null = null;

  constructor(config: TrapReceiverConfig = {}) {
    super();
    this.config = {
      port: config.port ?? 162,
      community: config.community ?? "public",
      disableAuthorization: config.disableAuthorization ?? false,
      redisUrl: config.redisUrl,
      databaseUrl: config.databaseUrl,
    };
  }

  /** Start listening for SNMP traps. */
  start(): void {
    if (this.receiver) return;

    if (this.config.redisUrl) {
      this.redis = new IORedis(this.config.redisUrl, { maxRetriesPerRequest: null });
      this.trapQueue = new Queue("trap-events", { connection: this.redis });
    }

    if (this.config.databaseUrl) {
      const { db } = createDb(this.config.databaseUrl);
      this.db = db;
    }

    this.receiver = snmp.createReceiver(
      {
        port: this.config.port,
        community: this.config.community,
        disableAuthorization: this.config.disableAuthorization,
      },
      (error, notification) => {
        if (error) {
          this.emit("error", error);
          return;
        }
        this.handleNotification(notification).catch((err) => {
          this.emit("error", err);
        });
      },
    );

    this.emit("listening", { port: this.config.port });
  }

  /** Stop the trap receiver and clean up resources. */
  async stop(): Promise<void> {
    if (this.receiver) {
      this.receiver.close();
      this.receiver = null;
    }
    if (this.trapQueue) {
      await this.trapQueue.close();
      this.trapQueue = null;
    }
    if (this.redis) {
      this.redis.disconnect();
      this.redis = null;
    }
    this.db = null;
  }

  /** Register a callback for trap events. */
  onTrap(callback: (event: TrapEvent) => void): void {
    this.on("trap", callback);
  }

  /** Parse and process an incoming SNMP notification. */
  private async handleNotification(notification: snmp.TrapNotification): Promise<void> {
    const { pdu, rinfo } = notification;
    const sourceIp = rinfo.address;

    const version = this.detectVersion(pdu.type);
    const oid = this.extractTrapOid(pdu, version);
    const varbinds = pdu.varbinds.map((vb) => ({
      oid: vb.oid,
      type: vb.type,
      value: vb.value,
    }));

    const event: TrapEvent = {
      sourceIp,
      version,
      oid,
      varbinds,
      timestamp: new Date(),
    };

    if (this.db) {
      try {
        const rows = await this.db
          .select({ id: devices.id })
          .from(devices)
          .where(eq(devices.ip, sourceIp))
          .limit(1);
        if (rows.length > 0) {
          event.deviceId = rows[0].id;
        }
      } catch {
      }
    }

    if (this.trapQueue) {
      await this.trapQueue.add("trap", event, {
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    }

    this.emit("trap", event);
  }

  /** Detect SNMP version from PDU type. */
  private detectVersion(pduType: number): "v1" | "v2c" | "v3" {
    if (pduType === snmp.PduType.Trap) return "v1";
    if (pduType === snmp.PduType.InformRequest) return "v3";
    return "v2c";
  }

  /** Extract the trap OID from the PDU based on version. */
  private extractTrapOid(
    pdu: snmp.TrapNotification["pdu"],
    version: "v1" | "v2c" | "v3",
  ): string {
    if (version === "v1") {
      // v1: enterprise OID + specific trap number
      const enterprise = pdu.enterprise ?? "0.0";
      const specific = pdu.specificTrap ?? 0;
      return `${enterprise}.0.${specific}`;
    }

    // v2c/v3: look for snmpTrapOID.0 in varbinds
    const trapOidVb = pdu.varbinds.find((vb) => vb.oid === SNMP_TRAP_OID);
    if (trapOidVb && typeof trapOidVb.value === "string") {
      return trapOidVb.value;
    }

    return "unknown";
  }
}
