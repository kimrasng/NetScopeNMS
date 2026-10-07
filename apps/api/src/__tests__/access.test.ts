import { describe, it, expect } from "vitest";
import { validateReadQuery } from "../services/ai.js";
import { publicResource, redactSecrets } from "../services/access.js";
import { validateWindow, isWindowActive } from "../services/maintenance.js";
import { maintenanceWindows } from "@netpulse/shared";

const window: typeof maintenanceWindows.$inferSelect = { id: "fixture", name: "Recurring", description: null, deviceIds: [], groupIds: [], startAt: new Date("2026-10-01T12:00:00Z"), endAt: new Date("2026-10-01T13:00:00Z"), recurring: true, cronExpression: "0 12 * * *", timezone: "UTC", createdBy: null, createdAt: new Date() };
describe("AI query boundary", () => {
  it.each(["SELECT * FROM users", "SELECT * FROM public.devices", "SELECT pg_read_file('x')", "SELECT set_config('search_path','public',false)", "SELECT * FROM devices; DELETE FROM devices", "SELECT * FROM devices FOR UPDATE", "WITH d AS (DELETE FROM devices RETURNING *) SELECT * FROM d"])("rejects %s", query => expect(() => validateReadQuery(query)).toThrow());
  it("accepts public monitoring joins and aggregation", () => expect(validateReadQuery("SELECT d.name, AVG(m.value) FROM devices d JOIN metrics m ON d.id=m.device_id GROUP BY d.name").toLowerCase()).toContain("avg"));
});
describe("Secret serialization", () => {
  it("removes credentials from nested device and channel results", () => {
    const result = JSON.stringify(publicResource({ device: { name: "A", snmpCommunity: "private", snmpV3Config: { username: "poller", authKey: "auth-secret", privKey: "privacy-secret" } }, config: { smtp: { pass: "mail-secret" }, headers: { Authorization: "header-secret" } } }));
    expect(result).not.toContain("auth-secret"); expect(result).not.toContain("privacy-secret"); expect(result).not.toContain("mail-secret");
  });
  it("redacts credentials recursively in audit details", () => expect(redactSecrets({ config: { token: "private" }, snmpCommunity: "private" })).toEqual({ config: { token: "[REDACTED]" }, snmpCommunity: "[REDACTED]" }));
});
describe("Recurring maintenance", () => {
  it("activates a later occurrence and ends at its duration boundary", () => {
    expect(isWindowActive(window, new Date("2026-10-02T12:30:00Z"))).toBe(true);
    expect(isWindowActive(window, new Date("2026-10-02T13:00:00Z"))).toBe(false);
    expect(isWindowActive(window, new Date("2026-09-30T12:30:00Z"))).toBe(false);
  });
  it("validates range, cron and timezone", () => {
    expect(() => validateWindow({ ...window, endAt: window.startAt })).toThrow();
    expect(() => validateWindow({ ...window, cronExpression: "nonsense" })).toThrow();
    expect(() => validateWindow({ ...window, timezone: "Invalid/Zone" })).toThrow();
  });
});
