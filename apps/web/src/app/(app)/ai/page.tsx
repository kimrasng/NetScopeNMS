"use client";

import { useEffect, useState } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Tabs from "@cloudscape-design/components/tabs";
import Container from "@cloudscape-design/components/container";
import SpaceBetween from "@cloudscape-design/components/space-between";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Button from "@cloudscape-design/components/button";
import Box from "@cloudscape-design/components/box";
import Table from "@cloudscape-design/components/table";
import Pagination from "@cloudscape-design/components/pagination";
import Modal from "@cloudscape-design/components/modal";
import Form from "@cloudscape-design/components/form";
import Select from "@cloudscape-design/components/select";
import Toggle from "@cloudscape-design/components/toggle";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import PromptInput from "@cloudscape-design/components/prompt-input";
import Alert from "@cloudscape-design/components/alert";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Link from "@cloudscape-design/components/link";
import { useAuth } from "@/lib/auth";
import { canAdminister } from "@/lib/permissions";
import { useApi } from "@/hooks/use-api";
import { useNotifications } from "@/hooks/use-notifications";
import { apiPost, apiPut, apiDelete } from "@/lib/api";
import type { AIProvider, AIProviderType, Incident, PaginatedResponse } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { AnalysisView, parseAnalysis } from "@/components/common/analysis-view";

interface QueryResult {
  type: "data" | "answer";
  answer?: string;
  explanation?: string;
  sql?: string;
  data?: Record<string, unknown>[];
  columns?: string[];
}

// ─── Query ────────────────────────────────────────────

function QueryTab() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState("");
  const { items, collectionProps, paginationProps } = useCollection(result?.data ?? [], { sorting: {}, pagination: { pageSize: 20 } });
  const ask = async () => {
    if (!query.trim() || loading) return;
    setLoading(true); setResult(null); setError("");
    try { setResult(await apiPost<QueryResult>("/api/ai/query", { query: query.trim() })); }
    catch (err) { setError(err instanceof Error ? err.message : t("Query failed")); }
    finally { setLoading(false); }
  };
  const columns = (result?.columns ?? []).filter(column => column !== "id" || !result?.columns?.includes("name"));
  return <SpaceBetween size="l">
    <Container header={<Header variant="h2">{t("ai.query")}</Header>}>
      <SpaceBetween size="m">
        <FormField label={t("ai.askQuestion")} description={t("Ask about devices, metrics, and incidents within your access scope.")}>
          <PromptInput ariaLabel={t("ai.ask")} value={query} onChange={({ detail }) => setQuery(detail.value)} onAction={ask} disabled={loading} placeholder={t("Which devices are currently down?")} actionButtonIconName="send" i18nStrings={{ actionButtonAriaLabel: t("ai.ask") }} />
        </FormField>
        <SpaceBetween direction="horizontal" size="s">
          {["Which devices are currently down?", "Show the devices with the highest CPU usage.", "How many incidents were opened today?"].map(example => <Button key={example} variant="inline-link" disabled={loading} onClick={() => setQuery(t(example))}>{t(example)}</Button>)}
        </SpaceBetween>
        {loading && <StatusIndicator type="loading">{t("ai.ask")}</StatusIndicator>}
        {error && <Alert type="error">{error}</Alert>}
      </SpaceBetween>
    </Container>
    {result && <Container header={<Header variant="h2">{t("ai.result")}</Header>}>
      <SpaceBetween size="m">
        {(result.answer || result.explanation) && <Box variant="p">{result.answer || result.explanation}</Box>}
        {result.type === "data" && <Table {...collectionProps} variant="embedded" items={items} pagination={<Pagination {...paginationProps} />} columnDefinitions={columns.map(column => ({
          id: column, header: t(column),
          sortingField: column,
          cell: (item: Record<string, unknown>) => column === "name" && typeof item.id === "string" && /\bFROM\s+"?devices"?\b/i.test(result.sql ?? "") ? <Link href={`/devices/${item.id}`}>{String(item[column])}</Link> : column === "status" ? t(`status.${item[column]}`) : String(item[column] ?? "—"),
        }))} empty={t("No matching results")} />}
        {result.sql && <ExpandableSection headerText={t("ai.sql")}><Box variant="code">{result.sql}</Box></ExpandableSection>}
      </SpaceBetween>
    </Container>}
  </SpaceBetween>;
}

// ─── Incident Assistance ──────────────────────────────

function ChatTab() {
  const { t } = useI18n();
  const [incidentId, setIncidentId] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { data: incidents, loading: incidentsLoading } = useApi<PaginatedResponse<Incident>>("/api/incidents", { limit: 200 });
  const { data: selected } = useApi<Incident & { device?: { name: string } }>(incidentId ? `/api/incidents/${incidentId}` : null);
  useEffect(() => { setIncidentId(new URLSearchParams(window.location.search).get("incidentId") ?? ""); }, []);
  const choices = [...(incidents?.data ?? [])];
  if (selected && !choices.some(incident => incident.id === selected.id)) choices.unshift(selected);
  const options = choices.map(incident => ({ value: incident.id, label: `${incident.title} · ${incident.deviceName ?? (incident.id === selected?.id ? selected.device?.name : undefined) ?? "—"}`, description: `${t(`severity.${incident.severity}`)} · ${t(`status.${incident.status}`)}` }));
  const send = async () => {
    if (!message.trim() || !incidentId || loading) return;
    const question = message.trim();
    setMessage(""); setError(""); setLoading(true);
    setMessages(previous => [...previous, { role: "user", content: question }]);
    try { const response = await apiPost<{ response: string }>("/api/ai/chat", { message: question, incidentId }); setMessages(previous => [...previous, { role: "assistant", content: response.response }]); }
    catch (err) { setError(err instanceof Error ? err.message : t("Chat request failed")); setMessage(question); setMessages(previous => previous.slice(0, -1)); }
    finally { setLoading(false); }
  };
  return <Container header={<Header variant="h2">{t("ai.chatWithIncident")}</Header>}>
    <SpaceBetween size="m">
      <FormField label={t("Incident")} description={t("Select an incident to ask about its device, events, and recent metrics.")}>
        <Select filteringType="auto" disabled={loading} statusType={incidentsLoading ? "loading" : "finished"} options={options} selectedOption={options.find(option => option.value === incidentId) ?? null} placeholder={t("Select an incident")} empty={t("No incidents")} onChange={({ detail }) => { setIncidentId(detail.selectedOption.value ?? ""); setMessages([]); setError(""); }} />
      </FormField>
      {selected && <Link href={`/incidents/${selected.id}`}>{t("Open incident details")}</Link>}
      {messages.map((entry, index) => <SpaceBetween key={index} size="xs"><Box variant="awsui-key-label">{entry.role === "user" ? t("You") : t("page.ai")}</Box>{entry.role === "assistant" && typeof parseAnalysis(entry.content)?.rootCause === "string" ? <AnalysisView raw={entry.content} /> : <Box variant="p">{entry.content}</Box>}</SpaceBetween>)}
      {!messages.length && incidentId && <Box color="text-body-secondary">{t("Ask about the probable cause, troubleshooting steps, or recovery actions.")}</Box>}
      {error && <Alert type="error">{error}</Alert>}
      {loading && <StatusIndicator type="loading">{t("ai.chat")}</StatusIndicator>}
      <PromptInput ariaLabel={t("ai.sendMessage")} value={message} onChange={({ detail }) => setMessage(detail.value)} onAction={send} disabled={!incidentId || loading} placeholder={t("ai.sendMessage")} actionButtonIconName="send" i18nStrings={{ actionButtonAriaLabel: t("ai.sendMessage") }} />
    </SpaceBetween>
  </Container>;
}

// ─── Provider Administration ──────────────────────────

interface ProviderForm {
  name: string; type: AIProviderType; apiKey: string; model: string; baseUrl: string; enabled: boolean; isDefault: boolean;
}
const initialForm: ProviderForm = { name: "", type: "openai", apiKey: "", model: "", baseUrl: "", enabled: true, isDefault: false };

function ProvidersTab() {
  const { t } = useI18n();
  const { addNotification } = useNotifications();
  const { data: providers, loading, refetch } = useApi<AIProvider[]>("/api/ai/providers");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState("");
  const [deleting, setDeleting] = useState<AIProvider | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const types = ["openai", "gemini", "claude", "custom"].map(value => ({ value, label: value === "openai" ? "OpenAI" : value === "custom" ? t("Custom") : value === "gemini" ? "Gemini" : "Claude" }));
  const open = (provider?: AIProvider) => {
    setEditingId(provider?.id ?? null);
    setForm(provider ? { name: provider.name, type: provider.type, apiKey: "", model: provider.model ?? "", baseUrl: provider.baseUrl ?? "", enabled: provider.enabled, isDefault: provider.isDefault } : initialForm);
    setFormError(""); setShowModal(true);
  };
  const save = async () => {
    if (!form.name.trim()) { setFormError(t("Name is required.")); return; }
    if (!editingId && !form.apiKey.trim()) { setFormError(t("API key is required.")); return; }
    if (form.baseUrl) { try { if (!["http:", "https:"].includes(new URL(form.baseUrl).protocol)) throw new Error(); } catch { setFormError(t("Enter an HTTP or HTTPS URL.")); return; } }
    setSaving(true); setFormError("");
    const body = { name: form.name.trim(), type: form.type, model: form.model || undefined, baseUrl: form.baseUrl || undefined, enabled: form.enabled, isDefault: form.isDefault, ...(form.apiKey ? { apiKey: form.apiKey } : {}) };
    try {
      if (editingId) await apiPut(`/api/ai/providers/${editingId}`, body); else await apiPost("/api/ai/providers", body);
      setShowModal(false); await refetch(); addNotification({ type: "success", content: t(editingId ? "ai.updated" : "ai.created") });
    } catch (err) { setFormError(err instanceof Error ? err.message : t("Save failed")); }
    finally { setSaving(false); }
  };
  const test = async (id: string) => {
    setTestingId(id);
    try { await apiPost(`/api/ai/providers/${id}/test`); addNotification({ type: "success", content: t("ai.testSuccess") }); }
    catch (err) { addNotification({ type: "error", content: err instanceof Error ? err.message : t("ai.testFailed") }); }
    finally { setTestingId(""); }
  };
  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true); setDeleteError("");
    try { await apiDelete(`/api/ai/providers/${deleting.id}`); setDeleting(null); await refetch(); addNotification({ type: "success", content: t("ai.deleted") }); }
    catch (err) { setDeleteError(err instanceof Error ? err.message : t("Delete failed")); }
    finally { setDeleteBusy(false); }
  };
  return <SpaceBetween size="m">
    <Table items={providers ?? []} loading={loading} loadingText={t("ai.providers")} variant="container" header={<Header variant="h2" counter={`(${providers?.length ?? 0})`} actions={<Button variant="primary" onClick={() => open()}>{t("ai.addProvider")}</Button>}>{t("ai.providers")}</Header>} columnDefinitions={[
      { id: "name", header: t("ai.providerName"), cell: provider => provider.name },
      { id: "type", header: t("ai.providerType"), cell: provider => types.find(type => type.value === provider.type)?.label },
      { id: "model", header: t("ai.model"), cell: provider => provider.model || "—" },
      { id: "enabled", header: t("common.enabled"), cell: provider => <StatusIndicator type={provider.enabled ? "success" : "stopped"}>{t(provider.enabled ? "common.enabled" : "Disabled")}</StatusIndicator> },
      { id: "default", header: t("ai.isDefault"), cell: provider => provider.isDefault ? t("ai.isDefault") : "—" },
      { id: "actions", header: t("common.actions"), cell: provider => <SpaceBetween direction="horizontal" size="xs"><Button variant="inline-link" loading={testingId === provider.id} onClick={() => test(provider.id)}>{t("ai.testProvider")}</Button><Button variant="inline-link" onClick={() => open(provider)}>{t("common.edit")}</Button><Button variant="inline-link" onClick={() => { setDeleting(provider); setDeleteError(""); }}>{t("common.delete")}</Button></SpaceBetween> },
    ]} empty={<Box textAlign="center" padding="l"><SpaceBetween size="s"><Box variant="strong">{t("No AI providers")}</Box><Box>{t("Configure a provider to use AI queries and incident assistance.")}</Box></SpaceBetween></Box>} />
    <Modal visible={showModal} onDismiss={() => setShowModal(false)} header={t(editingId ? "ai.editProvider" : "ai.addProvider")} footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={() => setShowModal(false)}>{t("common.cancel")}</Button><Button variant="primary" loading={saving} onClick={save}>{t(editingId ? "common.save" : "common.create")}</Button></SpaceBetween></Box>}>
      <Form errorText={formError}><SpaceBetween size="m">
        <FormField label={t("ai.providerName")}><Input value={form.name} onChange={({ detail }) => setForm(previous => ({ ...previous, name: detail.value }))} /></FormField>
        <FormField label={t("ai.selectType")}><Select selectedOption={types.find(type => type.value === form.type) ?? types[0]} options={types} onChange={({ detail }) => setForm(previous => ({ ...previous, type: detail.selectedOption.value as AIProviderType }))} /></FormField>
        <FormField label={t("ai.apiKey")} description={editingId ? t("Leave blank to keep the existing credential.") : undefined}><Input type="password" value={form.apiKey} onChange={({ detail }) => setForm(previous => ({ ...previous, apiKey: detail.value }))} /></FormField>
        <FormField label={t("ai.model")}><Input value={form.model} onChange={({ detail }) => setForm(previous => ({ ...previous, model: detail.value }))} /></FormField>
        <FormField label={t("ai.baseUrl")}><Input value={form.baseUrl} onChange={({ detail }) => setForm(previous => ({ ...previous, baseUrl: detail.value }))} /></FormField>
        <Toggle checked={form.enabled} onChange={({ detail }) => setForm(previous => ({ ...previous, enabled: detail.checked }))}>{t("common.enabled")}</Toggle>
        <Toggle checked={form.isDefault} onChange={({ detail }) => setForm(previous => ({ ...previous, isDefault: detail.checked }))}>{t("ai.isDefault")}</Toggle>
      </SpaceBetween></Form>
    </Modal>
    <Modal visible={!!deleting} onDismiss={() => setDeleting(null)} header={t("common.delete")} footer={<Box float="right"><SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={() => setDeleting(null)}>{t("common.cancel")}</Button><Button variant="primary" loading={deleteBusy} onClick={remove}>{t("common.delete")}</Button></SpaceBetween></Box>}>
      <SpaceBetween size="m"><Box>{deleting?.name}</Box><Box>{t("Remove this AI provider?")}</Box>{deleteError && <Alert type="error">{deleteError}</Alert>}</SpaceBetween>
    </Modal>
  </SpaceBetween>;
}

// ─── Page ──────────────────────────────────────────────

export default function AIPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("query");
  useEffect(() => { if (new URLSearchParams(window.location.search).has("incidentId")) setActiveTab("chat"); }, []);
  return <ContentLayout header={<Header variant="h1" description={t("Ask about network resources and investigate incidents.")}>{t("page.ai")}</Header>}>
    <Tabs activeTabId={activeTab} onChange={({ detail }) => setActiveTab(detail.activeTabId)} tabs={[
      { id: "query", label: t("ai.query"), content: <QueryTab /> },
      { id: "chat", label: t("ai.chat"), content: <ChatTab /> },
      ...(canAdminister(user) ? [{ id: "providers", label: t("ai.providers"), content: <ProvidersTab /> }] : []),
    ]} />
  </ContentLayout>;
}
