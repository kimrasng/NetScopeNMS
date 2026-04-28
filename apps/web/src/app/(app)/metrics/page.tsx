"use client";

import { useState, useMemo, useCallback } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import SpaceBetween from "@cloudscape-design/components/space-between";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import Button from "@cloudscape-design/components/button";
import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Spinner from "@cloudscape-design/components/spinner";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import type { SelectProps } from "@cloudscape-design/components/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useApi } from "@/hooks/use-api";
import { useI18n } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import type { MetricPoint, AnomalyPoint } from "@/lib/types";

const METRIC_OPTIONS: SelectProps.Option[] = [
  { label: "CPU", value: "cpu" },
  { label: "Memory", value: "memory" },
  { label: "Bandwidth In", value: "bandwidth_in" },
  { label: "Bandwidth Out", value: "bandwidth_out" },
  { label: "Latency", value: "latency" },
  { label: "Ping", value: "ping" },
];

const BUCKET_OPTIONS: SelectProps.Option[] = [
  { label: "1 minute", value: "1 minute" },
  { label: "5 minutes", value: "5 minutes" },
  { label: "1 hour", value: "1 hour" },
];

const PRESET_RANGES: { label: string; hours: number }[] = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
];

interface PredictionResult {
  currentTrend: string;
  predictedBreach?: string;
  estimatedTime?: string;
}

export default function MetricsPage() {
  const { t } = useI18n();
  const [deviceId, setDeviceId] = useState("");
  const [metric, setMetric] = useState<SelectProps.Option>(METRIC_OPTIONS[0]);
  const [bucket, setBucket] = useState<SelectProps.Option>(BUCKET_OPTIONS[1]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [threshold, setThreshold] = useState("90");

  const [queryParams, setQueryParams] = useState<Record<string, string | number | undefined> | null>(null);
  const [anomalyParams, setAnomalyParams] = useState<Record<string, string | number | undefined> | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);

  const { data: metricsData, loading: metricsLoading } = useApi<{ data: MetricPoint[] }>(
    queryParams ? "/api/metrics" : null,
    queryParams ?? undefined,
  );

  const { data: anomaliesData, loading: anomaliesLoading } = useApi<AnomalyPoint[]>(
    anomalyParams ? "/api/metrics/anomalies" : null,
    anomalyParams ?? undefined,
  );

  const applyPreset = useCallback((hours: number) => {
    const now = new Date();
    const from = new Date(now.getTime() - hours * 60 * 60 * 1000);
    setFromDate(from.toISOString().slice(0, 16));
    setToDate(now.toISOString().slice(0, 16));
  }, []);

  const handleQuery = useCallback(() => {
    if (!deviceId.trim() || !fromDate || !toDate) return;
    const params = {
      deviceId,
      metric: metric.value,
      from: new Date(fromDate).toISOString(),
      to: new Date(toDate).toISOString(),
      bucket: bucket.value,
    };
    setQueryParams(params);
    setAnomalyParams({ deviceId, metric: metric.value });
  }, [deviceId, metric, fromDate, toDate, bucket]);

  const handlePredict = useCallback(async () => {
    if (!deviceId.trim()) return;
    setPredictionLoading(true);
    try {
      const res = await apiGet<PredictionResult>("/api/metrics/predict", {
        deviceId,
        metric: metric.value,
        threshold: Number(threshold),
      });
      setPrediction(res);
    } catch {
      setPrediction(null);
    } finally {
      setPredictionLoading(false);
    }
  }, [deviceId, metric, threshold]);

  const chartData = useMemo(() => {
    if (!metricsData?.data) return [];
    return metricsData.data.map((p) => ({
      time: new Date(p.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      avg: p.avg_value,
      max: p.max_value,
      min: p.min_value,
    }));
  }, [metricsData]);

  const anomalyItems = useMemo(() => {
    if (!anomaliesData) return [];
    return (Array.isArray(anomaliesData) ? anomaliesData : []).filter((a) => a.is_anomaly);
  }, [anomaliesData]);

  return (
    <ContentLayout header={<Header variant="h1">{t("page.metrics")}</Header>}>
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">Query Parameters</Header>}>
          <SpaceBetween size="m">
            <ColumnLayout columns={4}>
              <FormField label={t("metrics.deviceId")}>
                <Input
                  value={deviceId}
                  onChange={({ detail }) => setDeviceId(detail.value)}
                  placeholder={t("metrics.selectDevice")}
                />
              </FormField>
              <FormField label={t("metrics.metric")}>
                <Select
                  selectedOption={metric}
                  onChange={({ detail }) => setMetric(detail.selectedOption)}
                  options={METRIC_OPTIONS}
                  placeholder={t("metrics.selectMetric")}
                />
              </FormField>
              <FormField label="From">
                <Input
                  value={fromDate}
                  onChange={({ detail }) => setFromDate(detail.value)}
                  type="text"
                  placeholder="YYYY-MM-DDTHH:mm"
                />
              </FormField>
              <FormField label="To">
                <Input
                  value={toDate}
                  onChange={({ detail }) => setToDate(detail.value)}
                  type="text"
                  placeholder="YYYY-MM-DDTHH:mm"
                />
              </FormField>
            </ColumnLayout>
            <SpaceBetween direction="horizontal" size="xs">
              <FormField label={t("metrics.bucket")}>
                <Select
                  selectedOption={bucket}
                  onChange={({ detail }) => setBucket(detail.selectedOption)}
                  options={BUCKET_OPTIONS}
                />
              </FormField>
              <FormField label={t("metrics.timeRange")}>
                <SpaceBetween direction="horizontal" size="xs">
                  {PRESET_RANGES.map((p) => (
                    <Button key={p.label} onClick={() => applyPreset(p.hours)}>
                      {p.label}
                    </Button>
                  ))}
                </SpaceBetween>
              </FormField>
            </SpaceBetween>
            <Button variant="primary" onClick={handleQuery}>
              {t("metrics.query")}
            </Button>
          </SpaceBetween>
        </Container>

        {metricsLoading && (
          <Container>
            <Box textAlign="center" padding="l"><Spinner size="large" /></Box>
          </Container>
        )}

        {chartData.length > 0 && (
          <Container header={<Header variant="h2">Chart</Header>}>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="avg" stroke="#0972d3" name={t("metrics.avg")} dot={false} />
                <Line type="monotone" dataKey="max" stroke="#d91515" name={t("metrics.max")} dot={false} />
                <Line type="monotone" dataKey="min" stroke="#037f0c" name={t("metrics.min")} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Container>
        )}

        {anomalyParams && (
          <Container header={<Header variant="h2">{t("metrics.anomalies")}</Header>}>
            {anomaliesLoading ? (
              <Spinner size="large" />
            ) : anomalyItems.length > 0 ? (
              <Table
                items={anomalyItems}
                variant="embedded"
                columnDefinitions={[
                  {
                    id: "timestamp",
                    header: "Timestamp",
                    cell: (item) => new Date(item.timestamp).toLocaleString(),
                    width: 200,
                  },
                  {
                    id: "value",
                    header: "Value",
                    cell: (item) => item.value.toFixed(2),
                    width: 120,
                  },
                  {
                    id: "mean",
                    header: "Mean",
                    cell: (item) => item.mean.toFixed(2),
                    width: 120,
                  },
                  {
                    id: "stddev",
                    header: "Std Dev",
                    cell: (item) => item.stddev.toFixed(2),
                    width: 120,
                  },
                  {
                    id: "status",
                    header: "Status",
                    cell: () => <StatusIndicator type="warning">Anomaly</StatusIndicator>,
                    width: 120,
                  },
                ]}
                empty={<Box textAlign="center" color="inherit">No anomalies detected</Box>}
              />
            ) : (
              <Box textAlign="center" color="inherit" padding="l">No anomalies detected</Box>
            )}
          </Container>
        )}

        <Container header={<Header variant="h2">{t("metrics.prediction")}</Header>}>
          <SpaceBetween size="m">
            <ColumnLayout columns={2}>
              <FormField label={t("metrics.threshold")}>
                <Input
                  value={threshold}
                  onChange={({ detail }) => setThreshold(detail.value)}
                  type="number"
                />
              </FormField>
              <FormField label=" ">
                <Button onClick={handlePredict} loading={predictionLoading}>
                  {t("metrics.predict")}
                </Button>
              </FormField>
            </ColumnLayout>
            {prediction && (
              <ColumnLayout columns={3} variant="text-grid">
                <div>
                  <Box variant="awsui-key-label">Current Trend</Box>
                  <Box variant="p">{prediction.currentTrend}</Box>
                </div>
                <div>
                  <Box variant="awsui-key-label">Predicted Breach</Box>
                  <Box variant="p">{prediction.predictedBreach ?? "—"}</Box>
                </div>
                <div>
                  <Box variant="awsui-key-label">Estimated Time</Box>
                  <Box variant="p">{prediction.estimatedTime ?? "—"}</Box>
                </div>
              </ColumnLayout>
            )}
          </SpaceBetween>
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}
