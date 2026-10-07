"use client";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Box from "@cloudscape-design/components/box";
import Table from "@cloudscape-design/components/table";
import Link from "@cloudscape-design/components/link";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Alert from "@cloudscape-design/components/alert";
import Badge from "@cloudscape-design/components/badge";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { TimeSeriesChart, metricUnit } from "@/components/common/time-series-chart";
import { useApi } from "@/hooks/use-api";
import { useI18n } from "@/lib/i18n";
import type { DashboardWidget, DashboardSummary, Incident, MetricPoint, PaginatedResponse, TopDevice, ThroughputPoint } from "@/lib/types";

export const widgetNames: Record<string, string> = { summary: "Summary", metric: "Metric", incidents: "Active incidents", throughput: "Throughput", top_devices: "Top devices", text: "Notes" };

function SummaryWidget() {
  const { t } = useI18n();
  const { data, error } = useApi<DashboardSummary>("/api/dashboard/summary");
  if (error) return <Alert type="error">{error}</Alert>;
  return <ColumnLayout columns={3} variant="text-grid">
    {[{ label: t("All devices"), value: data?.devices.total, href: "/devices" }, { label: t("Devices down"), value: data?.devices.down_count, href: "/devices?status=down" }, { label: t("Active incidents"), value: data?.incidents.active_count, href: "/incidents?status=active" }].map(item => <div key={item.label}><Box variant="awsui-key-label">{t(item.label)}</Box><Box><Link href={item.href} fontSize="heading-xl">{item.value ?? "—"}</Link></Box></div>)}
  </ColumnLayout>;
}
function MetricWidget({ config }: { config: Record<string, unknown> }) {
  const { t } = useI18n();
  const metric = String(config.metric ?? "cpu");
  const { data: device } = useApi<{ id: string; name: string }>(typeof config.deviceId === "string" ? `/api/devices/${config.deviceId}` : null);
  const { data, loading, error } = useApi<{ data: MetricPoint[] }>(typeof config.deviceId === "string" ? "/api/metrics" : null, { deviceId: String(config.deviceId ?? ""), metric, bucket: "5 minutes" });
  if (error) return <Alert type="error">{error}</Alert>;
  return <SpaceBetween size="xs"><Box>{device && <Link href={`/devices/${device.id}`}>{device.name}</Link>} · {t("Last hour")} · {t("metrics.5min")}</Box><TimeSeriesChart height={240} loading={loading} title={t(`metric.${metric}`)} unit={metricUnit(metric)} series={[{ title: t("metrics.avg"), points: (data?.data ?? []).map(point => ({ time: point.time, value: point.avg_value })) }]} /></SpaceBetween>;
}
function IncidentWidget() {
  const { t } = useI18n();
  const { data, loading, error } = useApi<PaginatedResponse<Incident>>("/api/incidents", { limit: 5, status: "active" });
  if (error) return <Alert type="error">{error}</Alert>;
  return <Table variant="embedded" loading={loading} items={data?.data ?? []} columnDefinitions={[{ id: "title", header: t("Incident"), cell: incident => <Link href={`/incidents/${incident.id}`}>{incident.title}</Link> }, { id: "severity", header: t("Severity"), cell: incident => <Badge color={incident.severity === "critical" || incident.severity === "high" ? "red" : "blue"}>{t(`severity.${incident.severity}`)}</Badge> }]} empty={t("No active incidents")} />;
}
function ThroughputWidget() {
  const { t } = useI18n();
  const { data, loading, error } = useApi<ThroughputPoint[]>("/api/dashboard/throughput", { hours: 6 });
  if (error) return <Alert type="error">{error}</Alert>;
  return <TimeSeriesChart loading={loading} title={t("Throughput")} unit="bps" series={[{ title: t("dashboard.bandwidthIn"), points: (data ?? []).map(point => ({ time: point.bucket, value: point.total_in })) }, { title: t("dashboard.bandwidthOut"), points: (data ?? []).map(point => ({ time: point.bucket, value: point.total_out })) }]} />;
}
function TopDevicesWidget() {
  const { t } = useI18n();
  const { data, loading, error } = useApi<TopDevice[]>("/api/dashboard/top-devices", { metric: "cpu", limit: 5 });
  if (error) return <Alert type="error">{error}</Alert>;
  return <Table variant="embedded" loading={loading} items={data ?? []} columnDefinitions={[{ id: "device", header: t("Device"), cell: device => <Link href={`/devices/${device.device_id}`}>{device.name}</Link> }, { id: "value", header: t("CPU (%)"), cell: device => Number(device.value).toFixed(1) }]} empty={t("No CPU samples")} />;
}
export function Widget({ widget, framed = true, fitHeight = false }: { widget: DashboardWidget; framed?: boolean; fitHeight?: boolean }) {
  const { t } = useI18n();
  const content = widget.widgetType === "summary" ? <SummaryWidget /> : widget.widgetType === "metric" ? <MetricWidget config={widget.config} /> : widget.widgetType === "incidents" ? <IncidentWidget /> : widget.widgetType === "throughput" ? <ThroughputWidget /> : widget.widgetType === "top_devices" ? <TopDevicesWidget /> : widget.widgetType === "text" ? <Box variant="p">{String(widget.config.text ?? "")}</Box> : <Alert type="warning">{t("Unsupported widget")}</Alert>;
  return framed ? <Container fitHeight={fitHeight} header={<Header variant="h2">{String(widget.config.title || t(widget.widgetType === "metric" ? `metric.${widget.config.metric ?? "cpu"}` : widgetNames[widget.widgetType] ?? widget.widgetType))}</Header>}>{content}</Container> : content;
}
