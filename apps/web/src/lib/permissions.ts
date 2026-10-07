import type { User } from "./types";
export function canOperate(user: User | null) { return !!user && user.role !== "viewer"; }
export function canAdminister(user: User | null) { return !!user && user.scope === "all" && (user.role === "admin" || user.role === "super_admin"); }
export function canVisit(path: string, user: User | null) {
  if (/^\/settings\/(users|site|audit-logs)/.test(path) || /^\/(device-groups|discovery)/.test(path)) return canAdminister(user);
  if (/^\/devices\/(create|[^/]+\/edit)/.test(path)) return canOperate(user);
  if (/^\/alert-rules\/(create|[^/]+\/edit)/.test(path)) return canAdminister(user);
  return !!user;
}
