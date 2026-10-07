"use client";
import { formatDateTime } from "@/lib/date-format";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Dashboard } from "@/lib/types";
import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Box from "@cloudscape-design/components/box";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Badge from "@cloudscape-design/components/badge";
import Table from "@cloudscape-design/components/table";
import Spinner from "@cloudscape-design/components/spinner";
import Link from "@cloudscape-design/components/link";
import { TimeSeriesChart } from "@/components/common/time-series-chart";
import { useApi } from "@/hooks/use-api";
import { useI18n } from "@/lib/i18n";
import type {
  DashboardSummary,
  ThroughputPoint,
  TopDevice,
  Incident,
  DeviceStatus,
  Severity,
} from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────

const STATUS_MAP: Record<DeviceStatus, { type: "success" | "error" | "warning" | "stopped" | "in-progress"; key: string }> = {
  up: { type: "success", key: "status.up" },
  down: { type: "error", key: "status.down" },
  warning: { type: "warning", key: "status.warning" },
  unknown: { type: "stopped", key: "status.unknown" },
  maintenance: { type: "in-progress", key: "status.maintenance" },
};

const SEVERITY_COLOR: Record<Severity, "red" | "blue" | "grey"> = {
  critical: "red",
  high: "red",
  medium: "blue",
  low: "grey",
};

const INCIDENT_STATUS_MAP: Record<string, { type: "success" | "error" | "warning"; key: string }> = {
  problem: { type: "error", key: "status.problem" },
  acknowledged: { type: "warning", key: "status.acknowledged" },
  resolved: { type: "success", key: "status.resolved" },
};

// ─── Summary Stats Widget ─────────────────────────────

function SummaryStats({ data }: { data: DashboardSummary | null }) {
  const { t } = useI18n();
  if (!data) return <Spinner />;
  return <ColumnLayout columns={4} variant="text-grid">
    {[
      { label: t("Active incidents"), empty: "No active incidents", value: data.incidents.active_count, href: "/incidents?status=active", type: "error" as const },
      { label: t("Devices down"), empty: "No devices down", value: data.devices.down_count, href: "/devices?status=down", type: "error" as const },
      { label: t("Devices warning"), empty: "No devices warning", value: data.devices.warning_count, href: "/devices?status=warning", type: "warning" as const },
      { label: t("All devices"), empty: "All devices", value: data.devices.total, href: "/devices", type: "info" as const },
    ].map(item => <div key={item.label}><Box variant="awsui-key-label">{t(item.label)}</Box><Box padding={{ top: "xs", bottom: "xs" }}><Link href={item.href} fontSize="heading-xl">{item.value}</Link></Box><StatusIndicator type={Number(item.value) === 0 && item.type !== "info" ? "success" : item.type}>{t(item.type === "info" ? "All devices" : Number(item.value) === 0 ? item.empty : "Needs attention")}</StatusIndicator></div>)}
  </ColumnLayout>;
}

// ─── Throughput Chart Widget ──────────────────────────

function ThroughputChart({ data }: { data: ThroughputPoint[] | null }) {
  const { t } = useI18n();
  return <TimeSeriesChart title={t("dashboard.throughput")} unit="bps" loading={!data} series={[
    { title: t("dashboard.bandwidthIn"), points: (data ?? []).map(point => ({ time: point.bucket, value: point.total_in })) },
    { title: t("dashboard.bandwidthOut"), points: (data ?? []).map(point => ({ time: point.bucket, value: point.total_out })) },
  ]} />;
}

// ─── Top Devices Widget ───────────────────────────────

function TopDevicesTable({ data }: { data: TopDevice[] | null }) {
  const { t } = useI18n();
  return (
    <Table
      items={data ?? []}
      loading={!data}
      loadingText={t("Loading")}
      variant="embedded"
      columnDefinitions={[
        {
          id: "name",
          header: t("common.name"),
          cell: (item) => <SpaceBetween size="xxs"><Link href={`/devices/${item.device_id}`}>{item.name}</Link><Box color="text-body-secondary" fontSize="body-s">{item.ip}</Box></SpaceBetween>,
          sortingField: "name",
          minWidth: 150,
        },
        {
          id: "status",
          header: t("common.status"),
          minWidth: 90,
          cell: (item) => {
            const s = STATUS_MAP[item.status];
            return <StatusIndicator type={s.type}>{t(s.key)}</StatusIndicator>;
          },
        },
        {
          id: "value",
          header: t("dashboard.value"),
          minWidth: 80,
          cell: (item) => `${item.value.toFixed(1)}%`,
        },
      ]}
      empty={<Box textAlign="center" color="inherit">{t("No CPU samples")}</Box>}
    />
  );
}

// ─── Recent Alerts Widget ─────────────────────────────

interface RecentAlert {
  incident: Incident;
  deviceName: string;
  deviceIp: string;
}

function RecentAlertsTable({ data }: { data: RecentAlert[] | null }) {
  const { t } = useI18n();
  return (
    <Table
      items={data ?? []}
      loading={!data}
      loadingText={t("Loading")}
      variant="embedded"
      columnDefinitions={[
        {
          id: "severity",
          header: t("incident.severity"),
          cell: (item) => (
            <Badge color={SEVERITY_COLOR[item.incident.severity]}>
              {t(`severity.${item.incident.severity}`)}
            </Badge>
          ),
          width: 120,
        },
        {
          id: "title",
          header: t("incident.title"),
          cell: (item) => <Link href={`/incidents/${item.incident.id}`}>{item.incident.title}</Link>,
        },
        {
          id: "device",
          header: t("incident.device"),
          cell: (item) => <Link href={`/devices/${item.incident.deviceId}`}>{item.deviceName}</Link>,
        },
        {
          id: "time",
          header: t("dashboard.time"),
          cell: (item) => formatDateTime(new Date(item.incident.startedAt)),
          width: 180,
        },
        {
          id: "status",
          header: t("common.status"),
          cell: (item) => {
            const s = INCIDENT_STATUS_MAP[item.incident.status];
            if (!s) return item.incident.status;
            return <StatusIndicator type={s.type}>{t(s.key)}</StatusIndicator>;
          },
          width: 140,
        },
      ]}
      empty={<Box textAlign="center" color="inherit">{t("No recent alerts")}</Box>}
    />
  );
}

// ─── Dashboard Page ───────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { data: preference } = useApi<{ dashboard: Dashboard | null }>("/api/dashboards/default");
  const defaultDashboardId = preference?.dashboard?.id;
  useEffect(() => { if (defaultDashboardId) router.replace(`/dashboards/${defaultDashboardId}`); }, [defaultDashboardId, router]);
  const { t } = useI18n();
  const { data: summary, error: summaryError, refetch } = useApi<DashboardSummary>("/api/dashboard/summary");
  const { data: throughput, error: throughputError } = useApi<ThroughputPoint[]>("/api/dashboard/throughput", { hours: 6 });
  const { data: topDevices, error: topError } = useApi<TopDevice[]>("/api/dashboard/top-devices", { metric: "cpu", limit: 10 });
  const { data: recentAlerts, error: alertsError } = useApi<RecentAlert[]>("/api/dashboard/recent-alerts", { limit: 10 });

  if (summaryError || throughputError || topError || alertsError) return <Alert type="error" action={<Button onClick={() => { void refetch(); window.dispatchEvent(new Event("focus")); }}>{t("Retry")}</Button>}>{summaryError || throughputError || topError || alertsError}</Alert>;
  return (
    <ContentLayout header={<Header variant="h1" description={t("Updates automatically every 30 seconds.")} actions={<Button iconName="refresh" onClick={() => window.dispatchEvent(new Event("focus"))}>{t("Refresh")}</Button>}>{t("page.dashboard")}</Header>}>
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">{t("Network health")}</Header>}><SummaryStats data={summary} /></Container>
        <Container header={<Header variant="h2" description={t("Latest 10 incidents")} actions={<Link href="/incidents">{t("All incidents")}</Link>}>{t("dashboard.recentAlerts")}</Header>}><RecentAlertsTable data={recentAlerts} /></Container>
        <ColumnLayout columns={2}>
          <Container header={<Header variant="h2" description={t("Last 6 hours")}>{t("dashboard.throughput")}</Header>}><ThroughputChart data={throughput} /></Container>
          <Container header={<Header variant="h2" description={t("CPU (%) · Latest observation within 10 minutes")} actions={<Link href="/devices">{t("All devices")}</Link>}>{t("dashboard.topDevices")}</Header>}><TopDevicesTable data={topDevices} /></Container>
        </ColumnLayout>
      </SpaceBetween>
    </ContentLayout>
  );
}
