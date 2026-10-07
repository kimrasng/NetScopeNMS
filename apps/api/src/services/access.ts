import type { FastifyRequest } from "fastify";
import { and, eq, inArray, or, sql, type SQL, type AnyColumn } from "drizzle-orm";
import { devices, users, type Database } from "@netpulse/shared";

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export async function loadPrincipal(db: Database, id: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, id), columns: { passwordHash: false } });
  if (!user?.enabled) throw new HttpError(401, "Account is unavailable");
  const allowed = user.scope === "restricted"
    ? await db.select({ id: devices.id }).from(devices).where(or(
      user.allowedDeviceIds?.length ? inArray(devices.id, user.allowedDeviceIds) : sql`false`,
      user.allowedGroupIds?.length ? inArray(devices.groupId, user.allowedGroupIds) : sql`false`,
    )) : null;
  return { user, deviceIds: allowed?.map(d => d.id) ?? null };
}

export function deviceScope(request: FastifyRequest, column: AnyColumn | SQL): SQL {
  const ids = request.userDeviceIds;
  return ids === null ? sql`true` : ids?.length ? inArray(sql`${column}`, ids) : sql`false`;
}

export async function assertDeviceAccess(request: FastifyRequest, id: string) {
  const [device] = await request.server.db.select({ id: devices.id }).from(devices)
    .where(and(eq(devices.id, id), deviceScope(request, devices.id))).limit(1);
  if (!device) throw new HttpError(404, "Device not found or access denied");
}

export function isAdmin(role?: string) { return role === "admin" || role === "super_admin"; }

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      /password|secret|token|authKey|privKey|apiKey|keyHash|snmpCommunity|sshKey|privateKey|routingKey|webhookUrl|authorization|cookie|^pass$|^key$/i.test(key)
        ? "[REDACTED]" : redactSecrets(item),
    ]));
  }
  return value;
}

export function publicResource(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicResource);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const record = value as Record<string, unknown>;
    const flags = Object.fromEntries([["snmpCommunity", "snmpCommunityConfigured"], ["authKey", "authKeyConfigured"], ["privKey", "privKeyConfigured"], ["sshKeyEncrypted", "sshKeyConfigured"]].filter(([field]) => field in record).map(([field, flag]) => [flag, !!record[field]]));
    return { ...flags, ...Object.fromEntries(Object.entries(value)
      .filter(([key]) => !/^(passwordHash|apiKey|keyHash|sshKeyEncrypted|snmpCommunity|authKey|privKey)$/.test(key))
      .map(([key, item]) => [key, key === "config" ? redactSecrets(item) : publicResource(item)])) };
  }
  return value;
}
