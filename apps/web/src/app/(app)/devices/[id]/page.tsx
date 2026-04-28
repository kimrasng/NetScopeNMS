"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Tabs from "@cloudscape-design/components/tabs";
import Container from "@cloudscape-design/components/container";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import Badge from "@cloudscape-design/components/badge";
import Spinner from "@cloudscape-design/components/spinner";
import Alert from "@cloudscape-design/components/alert";
import Modal from "@cloudscape-design/components/modal";
import Select from "@cloudscape-design/components/select";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useApi } from "@/hooks/use-api";
import { useNotifications } from "@/hooks/use-notifications";
import { useI18n } from "@/lib/i18n";
import { apiDelete, apiGet } from "@/lib/api";
import type { Device, DeviceInterface, DeviceStatus, MetricPoint } from "@/lib/types";

const STATUS_MAP: Record<DeviceStatus, { type: "success" | "error" | "warning" | "stopped" | "in-progress"; key: string }> = {
  up: { type: "success", key: "status.up" },
  down: { type: "error", key: "status.down" },
  warning: { type: "warning", key: "status.warning" },
  unknown: { type: "stopped", key: "status.unknown" },
  maintenance: { type: "in-progress", key: "status.maintenance" },
};

function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div>{children}</div>
    </div>
  );
}

function formatSpeed(speed: number | null | undefined): string {
  if (!speed) return "—";
  if (speed >= 1_000_000_000) return `${(speed / 1_000_000_000).toFixed(1)} Gbps`;
  if (speed >= 1_000_000) return `${(speed / 1_000_000).toFixed(1)} Mbps`;
  if (speed >= 1_000) return `${(speed / 1_000).toFixed(1)} Kbps`;
  return `${speed} bps`;
}

function formatBps(bps: number): string {
  if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(2)} Kbps`;
  return `${bps} bps`;
}

function OverviewTab({ device }: { device: Device }) {
  const { t } = useI18n();
  const status = STATUS_MAP[device.status];
  return (
    <Container header={<Header variant="h2">{t("device.overview")}</Header>}>
      <ColumnLayout columns={3} variant="text-grid">
        <KeyValue label={t("common.name")}>{device.name}</KeyValue>
        <KeyValue label={t("device.ip")}>{device.ip}</KeyValue>
        <KeyValue label={t("common.type")}>
          {device.type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </KeyValue>
        <KeyValue label={t("common.status")}>
          <StatusIndicator type={status.type}>{t(status.key)}</StatusIndicator>
        </KeyValue>
        <KeyValue label={t("device.snmpVersion")}>{device.snmpVersion ?? "—"}</KeyValue>
        <KeyValue label={t("device.snmpCommunity")}>{device.snmpCommunity ?? "—"}</KeyValue>
        <KeyValue label={t("device.snmpPort")}>{device.snmpPort ?? "—"}</KeyValue>
        <KeyValue label={t("device.location")}>{device.location ?? "—"}</KeyValue>
        <KeyValue label={t("device.vendor")}>{device.vendor ?? "—"}</KeyValue>
        <KeyValue label={t("device.model")}>{device.model ?? "—"}</KeyValue>
        <KeyValue label={t("device.os")}>{device.osVersion ?? "—"}</KeyValue>
        <KeyValue label={t("device.pollingInterval")}>{device.pollingInterval}s</KeyValue>
        <KeyValue label={t("device.pollingEnabled")}>{device.pollingEnabled ? t("common.enabled") : t("common.disabled")}</KeyValue>
        <KeyValue label={t("device.lastPolled")}>
          {device.lastPolledAt ? new Date(device.lastPolledAt).toLocaleString() : "Never"}
        </KeyValue>
        <KeyValue label={t("device.tags")}>
          {device.tags.length > 0 ? (
            <SpaceBetween direction="horizontal" size="xxs">
              {device.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </SpaceBetween>
          ) : (
            "—"
          )}
        </KeyValue>
        <KeyValue label={t("device.latitude")}>{device.latitude ?? "—"}</KeyValue>
        <KeyValue label={t("device.longitude")}>{device.longitude ?? "—"}</KeyValue>
      </ColumnLayout>
    </Container>
  );
}

function InterfacesTab({ deviceId }: { deviceId: string }) {
  const { t } = useI18n();
  const { data, loading, error } = useApi<DeviceInterface[]>(`/api/devices/${deviceId}/interfaces`);
  const interfaces = data ?? [];

  const { items, collectionProps } = useCollection(interfaces, {
    sorting: {
      defaultState: { sortingColumn: { sortingField: "name" }, isDescending: false },
    },
  });

  if (error) return <Alert type="error">Failed to load interfaces: {error}</Alert>;

  return (
    <Table
      {...collectionProps}
      loading={loading}
      loadingText="Loading interfaces..."
      items={items}
      columnDefinitions={[
        {
          id: "name",
          header: t("device.ifName"),
          cell: (item) => item.name,
          sortingField: "name",
          width: 200,
        },
        {
          id: "status",
          header: t("device.ifStatus"),
          cell: (item) => {
            const type = item.status === "up" ? "success" : item.status === "down" ? "error" : "stopped";
            return <StatusIndicator type={type}>{item.status}</StatusIndicator>;
          },
          sortingField: "status",
          width: 120,
        },
        {
          id: "speed",
          header: t("device.speed"),
          cell: (item) => formatSpeed(item.speed),
          sortingField: "speed",
          width: 130,
        },
        {
          id: "inBps",
          header: t("device.inBps"),
          cell: (item) => formatBps(item.inBps),
          sortingField: "inBps",
          width: 150,
        },
        {
          id: "outBps",
          header: t("device.outBps"),
          cell: (item) => formatBps(item.outBps),
          sortingField: "outBps",
          width: 150,
        },
        {
          id: "errors",
          header: "Errors",
          cell: (item) => `In: ${item.inErrors} / Out: ${item.outErrors}`,
          width: 150,
        },
      ]}
      empty={
        <Box textAlign="center" color="inherit">
          <b>No interfaces</b>
          <Box variant="p" color="inherit">
            No interfaces discovered for this device.
          </Box>
        </Box>
      }
    />
  );
}

const TIME_RANGE_OPTIONS = [
  { label: "1 Hour", value: "1h" },
  { label: "6 Hours", value: "6h" },
  { label: "24 Hours", value: "24h" },
  { label: "7 Days", value: "7d" },
];

const METRIC_OPTIONS = [
  { label: "CPU", value: "cpu" },
  { label: "Memory", value: "memory" },
  { label: "Bandwidth In", value: "bandwidth_in" },
  { label: "Bandwidth Out", value: "bandwidth_out" },
  { label: "Latency", value: "latency" },
  { label: "Ping", value: "ping" },
];

function getFromDate(range: string): string {
  const now = new Date();
  switch (range) {
    case "1h": return new Date(now.getTime() - 3600_000).toISOString();
    case "6h": return new Date(now.getTime() - 6 * 3600_000).toISOString();
    case "24h": return new Date(now.getTime() - 24 * 3600_000).toISOString();
    case "7d": return new Date(now.getTime() - 7 * 24 * 3600_000).toISOString();
    default: return new Date(now.getTime() - 3600_000).toISOString();
  }
}

function MetricsTab({ deviceId }: { deviceId: string }) {
  const { t } = useI18n();
  const [metric, setMetric] = useState("cpu");
  const [timeRange, setTimeRange] = useState("1h");
  const [metricsData, setMetricsData] = useState<MetricPoint[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const from = getFromDate(timeRange);
      const to = new Date().toISOString();
      const bucket = timeRange === "7d" ? "1 hour" : timeRange === "24h" ? "5 minutes" : "1 minute";
      const res = await apiGet<{ data: MetricPoint[] }>("/api/metrics", { deviceId, metric, from, to, bucket });
      setMetricsData(res.data ?? []);
    } catch (err) {
      setMetricsError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setMetricsLoading(false);
    }
  }, [deviceId, metric, timeRange]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return (
    <Container
      header={
        <Header
          variant="h2"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Select
                selectedOption={METRIC_OPTIONS.find((o) => o.value === metric) ?? METRIC_OPTIONS[0]}
                onChange={({ detail }) => setMetric(detail.selectedOption.value!)}
                options={METRIC_OPTIONS}
              />
              <Select
                selectedOption={TIME_RANGE_OPTIONS.find((o) => o.value === timeRange) ?? TIME_RANGE_OPTIONS[0]}
                onChange={({ detail }) => setTimeRange(detail.selectedOption.value!)}
                options={TIME_RANGE_OPTIONS}
              />
            </SpaceBetween>
          }
        >
          {t("device.metrics")}
        </Header>
      }
    >
      {metricsLoading && (
        <Box textAlign="center" padding={{ vertical: "xl" }}>
          <Spinner size="large" />
        </Box>
      )}
      {metricsError && <Alert type="error">{metricsError}</Alert>}
      {!metricsLoading && !metricsError && metricsData.length === 0 && (
        <Box textAlign="center" padding={{ vertical: "xl" }} color="text-status-inactive">
          No metrics data available for the selected range.
        </Box>
      )}
      {!metricsLoading && !metricsError && metricsData.length > 0 && (
        <div style={{ width: "100%", height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metricsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickFormatter={(val: string) => new Date(val).toLocaleTimeString()}
              />
              <YAxis />
              <Tooltip labelFormatter={(val: string) => new Date(val).toLocaleString()} />
              <Line type="monotone" dataKey="avg_value" stroke="#0972d3" name="Avg" dot={false} />
              <Line type="monotone" dataKey="max_value" stroke="#d91515" name="Max" dot={false} />
              <Line type="monotone" dataKey="min_value" stroke="#037f0c" name="Min" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Container>
  );
}

export default function DeviceDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addNotification } = useNotifications();
  const { data: device, loading, error } = useApi<Device>(`/api/devices/${id}`);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiDelete(`/api/devices/${id}`);
      addNotification({ type: "success", content: "Device deleted successfully." });
      router.push("/devices");
    } catch (err: unknown) {
      addNotification({
        type: "error",
        content: err instanceof Error ? err.message : "Failed to delete device.",
      });
      setDeleting(false);
      setDeleteVisible(false);
    }
  }

  if (loading) {
    return (
      <ContentLayout header={<Header variant="h1">Loading...</Header>}>
        <Box textAlign="center" padding={{ vertical: "xxxl" }}>
          <Spinner size="large" />
        </Box>
      </ContentLayout>
    );
  }

  if (error || !device) {
    return (
      <ContentLayout header={<Header variant="h1">Device</Header>}>
        <Alert type="error">{error ?? "Device not found."}</Alert>
      </ContentLayout>
    );
  }

  return (
    <>
      <ContentLayout
        header={
          <Header
            variant="h1"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => router.push(`/devices/${id}/edit`)}>{t("common.edit")}</Button>
                <Button onClick={() => setDeleteVisible(true)}>{t("common.delete")}</Button>
              </SpaceBetween>
            }
          >
            {device.name}
          </Header>
        }
      >
        <SpaceBetween size="l">
          <BreadcrumbGroup
            items={[
              { text: "Home", href: "/dashboard" },
              { text: t("page.devices"), href: "/devices" },
              { text: device.name, href: `/devices/${id}` },
            ]}
            onFollow={(e) => {
              e.preventDefault();
              router.push(e.detail.href);
            }}
          />
          <Tabs
            tabs={[
              {
                label: t("device.overview"),
                id: "overview",
                content: <OverviewTab device={device} />,
              },
              {
                label: t("device.interfaces"),
                id: "interfaces",
                content: <InterfacesTab deviceId={id} />,
              },
              {
                label: t("device.metrics"),
                id: "metrics",
                content: <MetricsTab deviceId={id} />,
              },
            ]}
          />
        </SpaceBetween>
      </ContentLayout>

      <Modal
        visible={deleteVisible}
        onDismiss={() => setDeleteVisible(false)}
        header="Delete device"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteVisible(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" loading={deleting} onClick={handleDelete}>
                {t("common.delete")}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        Are you sure you want to delete <b>{device.name}</b>? This action cannot be undone.
      </Modal>
    </>
  );
}
