"use client";
import { formatDateTime } from "@/lib/date-format";
import { useState } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Select from "@cloudscape-design/components/select";
import FormField from "@cloudscape-design/components/form-field";
import Button from "@cloudscape-design/components/button";
import Alert from "@cloudscape-design/components/alert";
import Table from "@cloudscape-design/components/table";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Link from "@cloudscape-design/components/link";
import Modal from "@cloudscape-design/components/modal";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Textarea from "@cloudscape-design/components/textarea";
import Box from "@cloudscape-design/components/box";
import { useApi } from "@/hooks/use-api";
import { useI18n } from "@/lib/i18n";
import { apiPost } from "@/lib/api";
import type { Device } from "@/lib/types";
interface ScanResult { sourceDeviceId: string; sourceDeviceName: string; neighborsFound: { ip: string; hostname?: string; discoveryMethod: string }[]; newDevicesCreated: number; alreadyKnown: number; errors: string[] }
interface DiscoveryJob { id: string; name?: string; deviceId?: string; state: string; timestamp: number; result?: ScanResult | ScanResult[] | null; error?: string }
function scanResults(job: DiscoveryJob): ScanResult[] { return job.result ? Array.isArray(job.result) ? job.result : [job.result] : []; }
export default function DiscoveryPage() {
  const { t } = useI18n();
  const { data: devices } = useApi<{ nodes: Device[] }>("/api/topology/graph");
  const { data: jobs, loading, error, refetch } = useApi<{ data: DiscoveryJob[] }>("/api/discovery/jobs");
  const [deviceId, setDeviceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selected, setSelected] = useState<DiscoveryJob | null>(null);
  const options = [{ value: "", label: t("All polling-enabled devices") }, ...(devices?.nodes ?? []).filter(device => device.pollingEnabled).map(device => ({ value: device.id, label: `${device.name} (${device.ip})` }))];
  const scope = (job: DiscoveryJob) => job.deviceId ? devices?.nodes.find(device => device.id === job.deviceId)?.name ?? scanResults(job)[0]?.sourceDeviceName ?? t("Device") : t("All polling-enabled devices");
  const status = (job: DiscoveryJob) => job.state === "completed" && scanResults(job).some(result => result.errors.length) ? "warning" : job.state === "completed" ? "success" : job.state === "failed" ? "error" : job.state === "active" ? "in-progress" : "pending";
  return <ContentLayout header={<Header variant="h1" description={t("Discover neighboring devices and network connections using configured SNMP access.")} actions={<Link href="/topology">{t("View topology")}</Link>}>{t("Network discovery")}</Header>}><SpaceBetween size="l">
    {error && <Alert type="error">{error}</Alert>}
    {feedback && <Alert type={feedback.type} dismissible onDismiss={() => setFeedback(null)}>{feedback.message}</Alert>}
    <Container header={<Header variant="h2">{t("Start a scan")}</Header>}><SpaceBetween size="m">
      <FormField label={t("Scan scope")} description={t("New devices inherit the source group and polling credentials. Review discovered devices after scanning.")}><Select filteringType="auto" options={options} selectedOption={options.find(option => option.value === deviceId) ?? options[0]} onChange={({ detail }) => setDeviceId(detail.selectedOption.value ?? "")} /></FormField>
      <Button loading={busy} variant="primary" onClick={async () => { setBusy(true); setFeedback(null); try { await apiPost("/api/discovery/run", deviceId ? { deviceId } : {}); setFeedback({ type: "success", message: t("Scan queued. Results will update automatically.") }); await refetch(); } catch (err) { setFeedback({ type: "error", message: err instanceof Error ? err.message : t("Discovery failed") }); } finally { setBusy(false); } }}>{t("Run discovery")}</Button>
    </SpaceBetween></Container>
    <Table header={<Header counter={`(${jobs?.data.length ?? 0})`} actions={<Button iconName="refresh" onClick={refetch}>{t("Refresh")}</Button>}>{t("Recent scans")}</Header>} loading={loading} items={jobs?.data ?? []} columnDefinitions={[
      { id: "scope", header: t("Scan scope"), cell: job => <Button variant="inline-link" onClick={() => setSelected(job)}>{scope(job)}</Button> },
      { id: "state", header: t("common.status"), cell: job => <StatusIndicator type={status(job)}>{t(job.state === "completed" && status(job) === "warning" ? "Completed with errors" : `scan.${job.state}`)}</StatusIndicator> },
      { id: "time", header: t("Queued at"), cell: job => formatDateTime(new Date(job.timestamp)) },
      { id: "neighbors", header: t("Neighbors"), cell: job => job.result ? scanResults(job).reduce((total, result) => total + result.neighborsFound.length, 0) : "—" },
      { id: "new", header: t("New devices"), cell: job => job.result ? scanResults(job).reduce((total, result) => total + result.newDevicesCreated, 0) : "—" },
      { id: "errors", header: t("Errors"), cell: job => job.error ? 1 : job.result ? scanResults(job).reduce((total, result) => total + result.errors.length, 0) : "—" },
    ]} empty={<Box textAlign="center" padding="l">{t("No discovery jobs. Start a scan to find neighboring devices.")}</Box>} />
    <Modal visible={!!selected} onDismiss={() => setSelected(null)} header={t("Scan results")} size="large">{selected && <SpaceBetween size="l">
      {selected.error && <Alert type="error">{selected.error}</Alert>}
      <ColumnLayout columns={2} variant="text-grid"><div><Box variant="awsui-key-label">{t("Scan scope")}</Box><Box>{scope(selected)}</Box></div><div><Box variant="awsui-key-label">{t("Queued at")}</Box><Box>{formatDateTime(new Date(selected.timestamp))}</Box></div></ColumnLayout>
      {scanResults(selected).map(result => <Container key={result.sourceDeviceId} header={<Header><Link href={`/devices/${result.sourceDeviceId}`}>{result.sourceDeviceName}</Link></Header>}><SpaceBetween size="m">
        {result.errors.length > 0 && <Alert type="warning"><ul>{result.errors.map((message, index) => <li key={index}>{message}</li>)}</ul></Alert>}
        <Table variant="embedded" items={result.neighborsFound} columnDefinitions={[{ id: "name", header: t("common.name"), cell: neighbor => neighbor.hostname ?? "—" }, { id: "ip", header: t("device.ip"), cell: neighbor => neighbor.ip }, { id: "protocol", header: t("Protocol"), cell: neighbor => neighbor.discoveryMethod.toUpperCase() }]} empty={t("No neighbors found")} />
      </SpaceBetween></Container>)}
      <ExpandableSection headerText={t("Raw data")}><Textarea readOnly rows={8} value={JSON.stringify(selected, null, 2)} /></ExpandableSection>
    </SpaceBetween>}</Modal>
  </SpaceBetween></ContentLayout>;
}
