"use client";
import { formatDateTime } from "@/lib/date-format";
import { useState } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import SpaceBetween from "@cloudscape-design/components/space-between";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Autosuggest from "@cloudscape-design/components/autosuggest";
import Select from "@cloudscape-design/components/select";
import Button from "@cloudscape-design/components/button";
import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Table from "@cloudscape-design/components/table";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import DateRangePicker, { type DateRangePickerProps } from "@cloudscape-design/components/date-range-picker";
import Alert from "@cloudscape-design/components/alert";
import { TimeSeriesChart, metricUnit, formatMetric } from "@/components/common/time-series-chart";
import { useApi } from "@/hooks/use-api";
import { useI18n } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import type { MetricPoint, AnomalyPoint, Device } from "@/lib/types";

const metrics = ["cpu", "memory", "bandwidth_in", "bandwidth_out", "latency", "ping"];
const ranges: DateRangePickerProps.RelativeOption[] = [1, 6, 24].map(amount => ({ key: `${amount}h`, amount, unit: "hour", type: "relative" }));
ranges.push({ key: "7d", amount: 7, unit: "day", type: "relative" });
interface PredictionResult { prediction: { daysUntilThreshold: number; slope: number; currentAvg: number } | null; message?: string }
function metricRange(value: DateRangePickerProps.Value): { from: string; to: string } {
  if (value.type === "absolute") return { from: new Date(value.startDate).toISOString(), to: new Date(value.endDate).toISOString() };
  const seconds = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2592000, year: 31536000 }[value.unit];
  const now = new Date();
  return { from: new Date(now.getTime() - value.amount * seconds * 1000).toISOString(), to: now.toISOString() };
}
export default function MetricsPage() {
  const { t } = useI18n();
  const [deviceId, setDeviceId] = useState("");
  const [metric, setMetric] = useState("cpu");
  const [bucket, setBucket] = useState("5 minutes");
  const [range, setRange] = useState<DateRangePickerProps.Value | null>(ranges[2]);
  const [query, setQuery] = useState<{ deviceId: string; metric: string; from: string; to: string; bucket: string } | null>(null);
  const [threshold, setThreshold] = useState("90");
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [error, setError] = useState("");
  const [predictionError, setPredictionError] = useState("");
  const [predicting, setPredicting] = useState(false);
  const { data: graph } = useApi<{ nodes: Device[] }>("/api/topology/graph");
  const { data, loading, error: queryError } = useApi<{ data: MetricPoint[] }>(query ? "/api/metrics" : null, query ?? undefined);
  const { data: anomalies, loading: anomalyLoading, error: anomalyError } = useApi<{ data: AnomalyPoint[] }>(query ? "/api/metrics/anomalies" : null, query ? { deviceId: query.deviceId, metric: query.metric } : undefined);
  const devices = (graph?.nodes ?? []).map(device => ({ value: device.id, label: `${device.name} (${device.ip})` }));
  const unit = metricUnit(query?.metric ?? metric);
  const chartTitle = `${devices.find(device => device.value === query?.deviceId)?.label ?? t("Device")} · ${t(`metric.${query?.metric ?? metric}`)}`;
  const anomalyItems = (anomalies?.data ?? []).filter(point => point.is_anomaly);
  const validateRange: DateRangePickerProps.ValidationFunction = value => {
    if (!value) return { valid: false, errorMessage: t("Select a time range.") };
    if (value.type === "relative") return value.amount > 0 ? { valid: true } : { valid: false, errorMessage: t("Select a time range.") };
    const from = new Date(value.startDate).getTime(), to = new Date(value.endDate).getTime();
    return Number.isFinite(from) && Number.isFinite(to) && from < to ? { valid: true } : { valid: false, errorMessage: t("Start time must be before end time.") };
  };
  return <ContentLayout header={<Header variant="h1" description={t("Explore collected metrics for a device and time range.")}>{t("page.metrics")}</Header>}><SpaceBetween size="l">
    <Container header={<Header variant="h2">{t("Metric query")}</Header>}><SpaceBetween size="m">
      <ColumnLayout columns={2}><FormField label={t("Device")} errorText={error && !deviceId ? error : undefined}><Select filteringType="auto" options={devices} selectedOption={devices.find(device => device.value === deviceId) ?? null} placeholder={t("Select a device")} onChange={({ detail }) => { setDeviceId(detail.selectedOption.value ?? ""); setError(""); }} /></FormField>
      <FormField label={t("Metric")}><Autosuggest value={metric} options={metrics.map(value => ({ value, label: t(`metric.${value}`) }))} onChange={({ detail }) => setMetric(detail.value)} placeholder={t("Select a metric or enter its name.")} /></FormField></ColumnLayout>
      <ColumnLayout columns={2}><FormField label={t("metrics.timeRange")} constraintText={t("Times are shown in your local timezone.")}><DateRangePicker value={range} onChange={({ detail }) => setRange(detail.value)} relativeOptions={ranges} isValidRange={validateRange} absoluteFormat="long-localized" /></FormField>
      <FormField label={t("Aggregation interval")}><Select options={[{ value: "1 minute", label: t("metrics.1min") }, { value: "5 minutes", label: t("metrics.5min") }, { value: "1 hour", label: t("metrics.1hour") }]} selectedOption={{ value: bucket, label: t({ "1 minute": "metrics.1min", "5 minutes": "metrics.5min", "1 hour": "metrics.1hour" }[bucket] ?? bucket) }} onChange={({ detail }) => setBucket(detail.selectedOption.value ?? "5 minutes")} /></FormField></ColumnLayout>
      {error && deviceId && <Alert type="error">{error}</Alert>}
      <Button variant="primary" loading={loading} onClick={() => { if (!deviceId) { setError(t("Select a device.")); return; } if (!metric.trim()) { setError(t("Select a metric.")); return; } if (!range || !validateRange(range).valid) { setError(t("Select a time range.")); return; } setQuery({ deviceId, metric, bucket, ...metricRange(range) }); setError(""); setPrediction(null); setPredictionError(""); }}>{t("metrics.query")}</Button>
    </SpaceBetween></Container>
    {query && <>
      {queryError && <Alert type="error">{queryError}</Alert>}
      <Container header={<Header variant="h2" description={`${formatDateTime(new Date(query.from))} – ${formatDateTime(new Date(query.to))}`}>{chartTitle}</Header>}><TimeSeriesChart loading={loading} title={chartTitle} unit={unit} height={320} series={[{ title: t("metrics.avg"), points: (data?.data ?? []).map(point => ({ time: point.time, value: point.avg_value })) }, { title: t("metrics.max"), points: (data?.data ?? []).map(point => ({ time: point.time, value: point.max_value })) }, { title: t("metrics.min"), points: (data?.data ?? []).map(point => ({ time: point.time, value: point.min_value })) }]} /></Container>
      <ExpandableSection variant="container" headerText={t("metrics.anomalies")}><SpaceBetween size="m"><Box>{t("Anomalies use the latest samples for the selected device and metric.")}</Box>{anomalyError && <Alert type="error">{anomalyError}</Alert>}<Table variant="embedded" loading={anomalyLoading} items={anomalyItems} columnDefinitions={[
        { id: "timestamp", header: t("Time"), cell: point => formatDateTime(new Date(point.timestamp)) }, { id: "value", header: t("Value"), cell: point => formatMetric(point.value, unit) }, { id: "mean", header: t("Average"), cell: point => point.mean == null ? "—" : formatMetric(point.mean, unit) }, { id: "deviation", header: t("Standard deviation"), cell: point => point.stddev == null ? "—" : formatMetric(point.stddev, unit) },
      ]} empty={t("No anomalies detected")} /></SpaceBetween></ExpandableSection>
      <ExpandableSection variant="container" headerText={t("metrics.prediction")}><SpaceBetween size="m"><Box>{t("Prediction uses the recent trend, independent of the displayed time range.")}</Box><FormField label={`${t("metrics.threshold")}${unit ? ` (${unit})` : ""}`}><Input type="number" value={threshold} onChange={({ detail }) => setThreshold(detail.value)} /></FormField>
        <Button loading={predicting} onClick={async () => { if (!threshold.trim() || !Number.isFinite(Number(threshold))) { setPredictionError(t("Enter a numeric threshold.")); return; } setPredicting(true); setPredictionError(""); try { setPrediction(await apiGet<PredictionResult>("/api/metrics/predict", { deviceId: query.deviceId, metric: query.metric, threshold: Number(threshold) })); } catch (err) { setPredictionError(err instanceof Error ? err.message : t("Prediction failed")); } finally { setPredicting(false); } }}>{t("metrics.predict")}</Button>
        {predictionError && <Alert type="error">{predictionError}</Alert>}
        {prediction && (prediction.prediction ? <ColumnLayout columns={2} variant="text-grid"><div><Box variant="awsui-key-label">{t("Current average")}</Box><Box>{formatMetric(prediction.prediction.currentAvg, unit)}</Box></div><div><Box variant="awsui-key-label">{t("Estimated time to threshold")}</Box><Box>{prediction.prediction.daysUntilThreshold.toFixed(1)} {t("days")}</Box></div></ColumnLayout> : <Box>{prediction.message ? t(prediction.message) : t("No reliable prediction is available.")}</Box>)}
      </SpaceBetween></ExpandableSection>
    </>}
  </SpaceBetween></ContentLayout>;
}
