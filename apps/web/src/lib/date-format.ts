function displayLocale(): string {
  return typeof document === "undefined" ? "ko" : document.documentElement.lang || "ko";
}
export function formatDateTime(date: Date): string {
  return Number.isFinite(date.getTime()) ? date.toLocaleString(displayLocale(), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
}
export function formatDate(date: Date): string {
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(displayLocale()) : "—";
}
