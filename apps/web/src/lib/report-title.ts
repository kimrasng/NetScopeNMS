import type { Report } from "./types";
const typeKeys = { availability: "report.availability", performance: "report.performance", alert_summary: "report.alertSummary", ai_narrative: "report.aiNarrative" };
export function reportTitle(report: Pick<Report, "title" | "type" | "period">, t: (key: string) => string): string {
  return report.title === `${report.type.replaceAll("_", " ")} Report - ${report.period}` ? `${t(typeKeys[report.type])} · ${t(`report.${report.period}`)}` : report.title;
}
