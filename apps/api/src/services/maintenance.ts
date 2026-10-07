import cronParser from "cron-parser";
import { maintenanceWindows, type Database } from "@netpulse/shared";
import { z } from "zod";

type MaintenanceWindow = typeof maintenanceWindows.$inferSelect;
export function validateWindow(window: { startAt: string | Date; endAt: string | Date; recurring?: boolean | null; cronExpression?: string | null; timezone?: string }) {
  const start = new Date(window.startAt), end = new Date(window.endAt);
  const issues: z.ZodIssue[] = [];
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) issues.push({ code: "custom", path: ["endAt"], message: "End must be after start" });
  if (window.recurring) {
    try {
      if (!window.cronExpression) throw new Error("Cron is required");
      new Intl.DateTimeFormat("en", { timeZone: window.timezone ?? "UTC" });
      cronParser.parseExpression(window.cronExpression, { currentDate: start, tz: window.timezone ?? "UTC" });
    } catch { issues.push({ code: "custom", path: ["cronExpression"], message: "Valid cron and timezone are required" }); }
  }
  if (issues.length) throw new z.ZodError(issues);
}

export function isWindowActive(window: MaintenanceWindow, at = new Date()) {
  if (at < window.startAt) return false;
  if (at < window.endAt) return true;
  if (!window.recurring || !window.cronExpression) return false;
  try {
    const previous = cronParser.parseExpression(window.cronExpression, { currentDate: new Date(at.getTime() + 1), tz: window.timezone }).prev().toDate();
    return previous >= window.startAt && at.getTime() - previous.getTime() < window.endAt.getTime() - window.startAt.getTime();
  } catch { return false; }
}

export async function isDeviceInMaintenance(db: Pick<Database, "select">, device: { id: string; groupId: string | null }, at = new Date()) {
  const windows = await db.select().from(maintenanceWindows);
  return windows.some(window => isWindowActive(window, at) && (
    (!window.deviceIds?.length && !window.groupIds?.length) || window.deviceIds?.includes(device.id) || (!!device.groupId && window.groupIds?.includes(device.groupId))
  ));
}
