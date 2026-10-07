import { describe, expect, it } from "vitest";
import { isWindowActive, validateWindow } from "../services/maintenance.js";
import type { maintenanceWindows } from "@netpulse/shared";
const window: typeof maintenanceWindows.$inferSelect = {
  id: "11111111-1111-4111-8111-111111111111", name: "QA recurring", description: null,
  deviceIds: [], groupIds: [], startAt: new Date("2026-01-01T01:00:00Z"), endAt: new Date("2026-01-01T01:30:00Z"), recurring: true, cronExpression: "0 10 * * *", timezone: "Asia/Seoul", createdBy: null, createdAt: new Date("2026-01-01T00:00:00Z"),
};
describe("Maintenance recurrence", () => {
  it("suppresses alerts during later cron occurrences in the configured timezone", () => {
    expect(isWindowActive(window, new Date("2026-01-03T01:15:00Z"))).toBe(true);
    expect(isWindowActive(window, new Date("2026-01-03T10:15:00Z"))).toBe(false);
  });
  it("treats the end time as exclusive and does not start before the schedule", () => {
    expect(isWindowActive(window, new Date("2026-01-03T01:30:00Z"))).toBe(false);
    expect(isWindowActive(window, new Date("2025-12-31T01:15:00Z"))).toBe(false);
  });
  it("does not extend nonrecurring windows", () => expect(isWindowActive({ ...window, recurring: false }, new Date("2026-01-03T01:15:00Z"))).toBe(false));
  it("rejects invalid cron/timezone combinations and reversed time ranges", () => {
    expect(() => validateWindow({ ...window, cronExpression: "invalid" })).toThrow();
    expect(() => validateWindow({ ...window, timezone: "Invalid/Timezone" })).toThrow();
    expect(() => validateWindow({ ...window, endAt: window.startAt })).toThrow();
  });
});
