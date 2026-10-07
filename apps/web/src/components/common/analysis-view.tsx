"use client";
import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import SpaceBetween from "@cloudscape-design/components/space-between";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Textarea from "@cloudscape-design/components/textarea";
import { useI18n } from "@/lib/i18n";

export function parseAnalysis(raw: string): Record<string, unknown> | null {
  try { const value: unknown = JSON.parse(raw); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; } catch { return null; }
}
export function AnalysisView({ raw, summary }: { raw: string; summary?: string | null }) {
  const { t } = useI18n();
  const analysis = parseAnalysis(raw);
  const scope = Array.isArray(analysis?.affectedScope) ? analysis.affectedScope.filter((value): value is string => typeof value === "string") : [];
  const actions = Array.isArray(analysis?.remediation) ? analysis.remediation.filter((value): value is string => typeof value === "string") : [];
  return <SpaceBetween size="l">
    <Box variant="p">{typeof analysis?.summary === "string" ? analysis.summary : summary || (!analysis ? raw : "")}</Box>
    {analysis && <>
      <ColumnLayout columns={2} variant="text-grid"><div><Box variant="awsui-key-label">{t("Root cause")}</Box><Box>{typeof analysis.rootCause === "string" ? analysis.rootCause : "—"}</Box></div><div><Box variant="awsui-key-label">{t("Confidence")}</Box><Box>{typeof analysis.confidence === "number" ? `${analysis.confidence.toFixed(0)}%` : "—"}</Box></div></ColumnLayout>
      {scope.length > 0 && <div><Box variant="h3">{t("Affected resources")}</Box><ul>{scope.map(resource => <li key={resource}>{resource}</li>)}</ul></div>}
      {actions.length > 0 && <div><Box variant="h3">{t("Recommended actions")}</Box><ol>{actions.map((action, index) => <li key={index}>{action}</li>)}</ol></div>}
      <ExpandableSection headerText={t("Raw data")}><Textarea readOnly value={JSON.stringify(analysis, null, 2)} rows={8} /></ExpandableSection>
    </>}
  </SpaceBetween>;
}
