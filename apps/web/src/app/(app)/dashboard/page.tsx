"use client";

import { useMemo } from "react";
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
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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

function formatBandwidth(bps: number): string {
  if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`;
  return `${bps.toFixed(0)} bps`;
}

function formatBandwidthShort(bps: number): string {
  if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(1)}G`;
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(0)}M`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)}K`;
  return `${bps}`;
}

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
  if (!data) return <Spinner size="large" />;

  const { devices, incidents } = data;

  return (
    <ColumnLayout columns={2} variant="text-grid">
      <SpaceBetween size="l">
        <Box variant="h3">{t("dashboard.deviceStatus")}</Box>
        <ColumnLayout columns={3} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">{t("dashboard.devicesUp")}</Box>
            <StatusIndicator type="success">{devices.up_count}</StatusIndicator>
          </div>
          <div>
            <Box variant="awsui-key-label">{t("dashboard.devicesDown")}</Box>
            <StatusIndicator type="error">{devices.down_count}</StatusIndicator>
          </div>
          <div>
            <Box variant="awsui-key-label">{t("dashboard.devicesWarning")}</Box>
            <StatusIndicator type="warning">{devices.warning_count}</StatusIndicator>
          </div>
          <div>
            <Box variant="awsui-key-label">{t("dashboard.devicesUnknown")}</Box>
            <StatusIndicator type="stopped">{devices.unknown_count}</StatusIndicator>
          </div>
          <div>
            <Box variant="awsui-key-label">{t("dashboard.devicesMaintenance")}</Box>
            <StatusIndicator type="in-progress">{devices.maintenance_count}</StatusIndicator>
          </div>
          <div>
            <Box variant="awsui-key-label">{t("dashboard.totalDevices")}</Box>
            <Box variant="p">{devices.total}</Box>
          </div>
        </ColumnLayout>
      </SpaceBetween>
      <SpaceBetween size="l">
        <Box variant="h3">{t("dashboard.incidentStatus")}</Box>
        <ColumnLayout columns={2} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">{t("dashboard.incidentsProblem")}</Box>
            <StatusIndicator type="error">{incidents.problem_count}</StatusIndicator>
          </div>
          <div>
            <Box variant="awsui-key-label">{t("dashboard.incidentsAcknowledged")}</Box>
            <StatusIndicator type="warning">{incidents.acknowledged_count}</StatusIndicator>
          </div>
          <div>
            <Box variant="awsui-key-label">{t("dashboard.incidentsResolvedToday")}</Box>
            <StatusIndicator type="success">{incidents.resolved_today}</StatusIndicator>
          </div>
          <div>
            <Box variant="awsui-key-label">{t("dashboard.incidentsActive")}</Box>
            <Box variant="p">{incidents.active_count}</Box>
          </div>
        </ColumnLayout>
      </SpaceBetween>
    </ColumnLayout>
  );
}

// ─── Throughput Chart Widget ──────────────────────────

function ThroughputChart({ data }: { data: ThroughputPoint[] | null }) {
  const { t } = useI18n();
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((p) => ({
      time: new Date(p.bucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      in: p.total_in,
      out: p.total_out,
    }));
  }, [data]);

  if (!data) return <Spinner size="large" />;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis tickFormatter={(v: number) => formatBandwidthShort(v)} />
        <Tooltip formatter={(value: number | string) => formatBandwidth(Number(value))} />
        <Area type="monotone" dataKey="in" stroke="#0972d3" fill="#0972d3" fillOpacity={0.3} name={t("dashboard.bandwidthIn")} />
        <Area type="monotone" dataKey="out" stroke="#037f0c" fill="#037f0c" fillOpacity={0.3} name={t("dashboard.bandwidthOut")} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Top Devices Widget ───────────────────────────────

function TopDevicesTable({ data }: { data: TopDevice[] | null }) {
  const { t } = useI18n();
  return (
    <Table
      items={data ?? []}
      loading={!data}
      loadingText="Loading top devices..."
      variant="embedded"
      columnDefinitions={[
        {
          id: "name",
          header: t("common.name"),
          cell: (item) => item.name,
          sortingField: "name",
        },
        {
          id: "ip",
          header: t("device.ip"),
          cell: (item) => item.ip,
        },
        {
          id: "type",
          header: t("common.type"),
          cell: (item) => item.type,
        },
        {
          id: "status",
          header: t("common.status"),
          cell: (item) => {
            const s = STATUS_MAP[item.status];
            return <StatusIndicator type={s.type}>{t(s.key)}</StatusIndicator>;
          },
        },
        {
          id: "value",
          header: t("dashboard.value"),
          cell: (item) => `${item.value.toFixed(1)}%`,
        },
      ]}
      empty={<Box textAlign="center" color="inherit">No devices</Box>}
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
      loadingText="Loading recent alerts..."
      variant="embedded"
      columnDefinitions={[
        {
          id: "severity",
          header: t("incident.severity"),
          cell: (item) => (
            <Badge color={SEVERITY_COLOR[item.incident.severity]}>
              {item.incident.severity.charAt(0).toUpperCase() + item.incident.severity.slice(1)}
            </Badge>
          ),
          width: 120,
        },
        {
          id: "title",
          header: t("incident.title"),
          cell: (item) => item.incident.title,
        },
        {
          id: "device",
          header: t("incident.device"),
          cell: (item) => item.deviceName,
        },
        {
          id: "time",
          header: t("dashboard.time"),
          cell: (item) => new Date(item.incident.startedAt).toLocaleString(),
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
      empty={<Box textAlign="center" color="inherit">No recent alerts</Box>}
    />
  );
}

// ─── Dashboard Page ───────────────────────────────────

export default function DashboardPage() {
  const { t } = useI18n();
  const { data: summary } = useApi<DashboardSummary>("/api/dashboard/summary");
  const { data: throughput } = useApi<ThroughputPoint[]>("/api/dashboard/throughput", { hours: 6 });
  const { data: topDevices } = useApi<TopDevice[]>("/api/dashboard/top-devices", { metric: "cpu", limit: 10 });
  const { data: recentAlerts } = useApi<RecentAlert[]>("/api/dashboard/recent-alerts", { limit: 10 });

  return (
    <ContentLayout header={<Header variant="h1">{t("page.dashboard")}</Header>}>
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">{t("dashboard.summary")}</Header>}>
          <SummaryStats data={summary} />
        </Container>

        <Container header={<Header variant="h2">{t("dashboard.throughput")}</Header>}>
          <ThroughputChart data={throughput} />
        </Container>

        <ColumnLayout columns={2}>
          <Container header={<Header variant="h2">{t("dashboard.topDevices")}</Header>}>
            <TopDevicesTable data={topDevices} />
          </Container>

          <Container header={<Header variant="h2">{t("dashboard.recentAlerts")}</Header>}>
            <RecentAlertsTable data={recentAlerts} />
          </Container>
        </ColumnLayout>
      </SpaceBetween>
    </ContentLayout>
  );
}
