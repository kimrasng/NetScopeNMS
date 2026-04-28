declare module "net-snmp" {
  function createSession(host: string, community: string, options?: Record<string, unknown>): Session;
  function isVarbindError(varbind: unknown): boolean;

  interface Session {
    get(oids: string[], callback: (error: Error | null, varbinds: Varbind[]) => void): void;
    subtree(oid: string, maxRepetitions: number, feedCallback: (varbinds: Varbind[]) => void, doneCallback: (error: Error | null) => void): void;
    close(): void;
  }

  interface Varbind {
    oid: string;
    type: number;
    value: unknown;
  }

  const PduType: {
    Trap: number;
    TrapV2: number;
    InformRequest: number;
  };

  interface TrapNotification {
    pdu: {
      type: number;
      enterprise?: string;
      specificTrap?: number;
      varbinds: Varbind[];
    };
    rinfo: {
      address: string;
      port: number;
    };
  }

  interface Receiver {
    close(): void;
  }

  function createReceiver(
    options: { port?: number; disableAuthorization?: boolean; community?: string },
    callback: (error: Error | null, notification: TrapNotification) => void,
  ): Receiver;

  function createV3Session(host: string, user: Record<string, unknown>, options?: Record<string, unknown>): Session;

  export { createSession, createV3Session, createReceiver, isVarbindError, Session, Varbind, Receiver, TrapNotification, PduType };
}

declare module "ping" {
  namespace promise {
    function probe(host: string, options?: Record<string, unknown>): Promise<{
      alive: boolean;
      time: string | number;
      host: string;
    }>;
  }
  export { promise };
}
