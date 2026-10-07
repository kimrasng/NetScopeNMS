"use client";
import { formatDateTime } from "@/lib/date-format";
import Box from "@cloudscape-design/components/box";
import Table from "@cloudscape-design/components/table";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Link from "@cloudscape-design/components/link";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Textarea from "@cloudscape-design/components/textarea";
import { formatMetric, metricUnit } from "@/components/common/time-series-chart";
import { useI18n } from "@/lib/i18n";
import type { Report } from "@/lib/types";
import { observedAvailability } from "@/lib/report-data";

function rows(content: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = content[key];
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row)) : [];
}
export function ReportView({ report }: { report: Report }) {
  const { t } = useI18n();
  const content = report.content ?? {};
  const availability = rows(content, "availability");
  const performance = rows(content, "performance");
  const alerts = rows(content, "alertSummary");
  const observed = observedAvailability(availability);
  const deviceCell = (row: Record<string, unknown>) => typeof row.id === "string" ? <Link href={`/devices/${row.id}`}>{String(row.name ?? t("Device"))}</Link> : String(row.name ?? "—");
  const numberCell = (value: unknown, metric: unknown) => value == null ? "—" : formatMetric(Number(value), metricUnit(String(metric)));
  return <SpaceBetween size="l">
    <ColumnLayout columns={3} variant="text-grid"><div><Box variant="awsui-key-label">{t("Monitoring period")}</Box><Box>{t(`report.${report.period ?? "weekly"}`)}</Box></div><div><Box variant="awsui-key-label">{t("Included devices")}</Box><Box>{Array.isArray(content.deviceIds) ? content.deviceIds.length : availability.length || "—"}</Box></div><div><Box variant="awsui-key-label">{t("report.generatedAt")}</Box><Box>{formatDateTime(new Date(report.generatedAt))}</Box></div></ColumnLayout>
    {report.aiSummary && <div><Box variant="h3">{t("report.aiSummary")}</Box><Box variant="p">{report.aiSummary}</Box></div>}
    {(report.type === "availability" || report.type === "ai_narrative") && <>
      <Box><Box variant="awsui-key-label">{t("Observed availability (weighted samples)")}</Box><Box fontSize="heading-xl">{observed == null ? t("No samples") : `${observed.toFixed(2)}%`}</Box></Box>
      <Table variant="container" header={<Header>{t("Availability")}</Header>} items={availability} columnDefinitions={[
        { id: "device", header: t("Device"), cell: deviceCell }, { id: "ip", header: t("device.ip"), cell: row => String(row.ip ?? "—") },
        { id: "availability", header: t("Availability"), cell: row => row.uptime_pct == null || !Number(row.samples) ? t("No samples") : `${Number(row.uptime_pct).toFixed(2)}%` }, { id: "samples", header: t("Samples"), cell: row => Number(row.samples ?? 0).toLocaleString() },
      ]} empty={t("No observations")} />
    </>}
    {report.type === "performance" && <Table variant="container" header={<Header>{t("report.performance")}</Header>} items={performance} columnDefinitions={[
      { id: "device", header: t("Device"), cell: deviceCell }, { id: "metric", header: t("Metric"), cell: row => t(`metric.${row.metric_name}`) }, { id: "avg", header: t("Average"), cell: row => numberCell(row.avg_val, row.metric_name) }, { id: "max", header: t("Maximum"), cell: row => numberCell(row.max_val, row.metric_name) }, { id: "min", header: t("Minimum"), cell: row => numberCell(row.min_val, row.metric_name) },
    ]} empty={t("No observations")} />}
    {(report.type === "alert_summary" || report.type === "ai_narrative") && <Table variant="container" header={<Header>{t("report.alertSummary")}</Header>} items={alerts} columnDefinitions={[
      { id: "severity", header: t("Severity"), cell: row => t(`severity.${row.severity}`) }, { id: "total", header: t("common.total"), cell: row => Number(row.total).toLocaleString() }, { id: "resolved", header: t("status.resolved"), cell: row => Number(row.resolved).toLocaleString() }, { id: "duration", header: t("Average incident duration"), cell: row => row.avg_mttr_seconds == null ? "—" : `${(Number(row.avg_mttr_seconds) / 60).toFixed(1)} ${t("minutes")}` },
    ]} empty={t("No observations")} />}
    <ExpandableSection headerText={t("Raw data")}><Textarea readOnly value={JSON.stringify(content, null, 2)} rows={8} /></ExpandableSection>
  </SpaceBetween>;
}
