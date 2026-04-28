"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
import Modal from "@cloudscape-design/components/modal";
import Form from "@cloudscape-design/components/form";
import Select from "@cloudscape-design/components/select";
import Toggle from "@cloudscape-design/components/toggle";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Spinner from "@cloudscape-design/components/spinner";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { useApi } from "@/hooks/use-api";
import { useNotifications } from "@/hooks/use-notifications";
import { apiPost, apiPut, apiDelete } from "@/lib/api";
import type { AIProvider, AIProviderType } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────

interface QueryResult {
  type: "data" | "answer";
  answer?: string;
  sql?: string;
  data?: Record<string, unknown>[];
  columns?: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Constants ────────────────────────────────────────

const PROVIDER_TYPE_OPTIONS = [
  { label: "OpenAI", value: "openai" },
  { label: "Gemini", value: "gemini" },
  { label: "Claude", value: "claude" },
  { label: "Custom", value: "custom" },
];

// ─── Query Tab ────────────────────────────────────────

function QueryTab() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await apiPost<QueryResult>("/api/ai/query", { query });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <SpaceBetween size="l">
      <Container header={<Header variant="h2">{t("ai.query")}</Header>}>
        <SpaceBetween size="m">
          <FormField label={t("ai.askQuestion")}>
            <SpaceBetween direction="horizontal" size="xs">
              <div style={{ flex: 1 }}>
                <Input
                  value={query}
                  onChange={({ detail }) => setQuery(detail.value)}
                  placeholder={t("ai.askQuestion")}
                  onKeyDown={({ detail }) => {
                    if (detail.key === "Enter") handleAsk();
                  }}
                />
              </div>
              <Button variant="primary" loading={loading} onClick={handleAsk}>
                {t("ai.ask")}
              </Button>
            </SpaceBetween>
          </FormField>
        </SpaceBetween>
      </Container>

      {error && (
        <Container>
          <StatusIndicator type="error">{error}</StatusIndicator>
        </Container>
      )}

      {result && (
        <Container header={<Header variant="h2">{t("ai.result")}</Header>}>
          <SpaceBetween size="m">
            {result.sql && (
              <FormField label={t("ai.sql")}>
                <Box variant="code">{result.sql}</Box>
              </FormField>
            )}
            {result.type === "answer" && result.answer && (
              <Box variant="p">{result.answer}</Box>
            )}
            {result.type === "data" && result.data && result.columns && (
              <Table
                items={result.data}
                variant="embedded"
                columnDefinitions={result.columns.map((col) => ({
                  id: col,
                  header: col,
                  cell: (item: Record<string, unknown>) => String(item[col] ?? "—"),
                }))}
                empty={<Box textAlign="center" color="inherit">{t("ai.result")}</Box>}
              />
            )}
          </SpaceBetween>
        </Container>
      )}
    </SpaceBetween>
  );
}

// ─── Chat Tab ─────────────────────────────────────────

function ChatTab() {
  const { t } = useI18n();
  const [incidentId, setIncidentId] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || !incidentId.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: message };
    setMessages((prev) => [...prev, userMsg]);
    setMessage("");
    setLoading(true);
    try {
      const res = await apiPost<{ response: string }>("/api/ai/chat", {
        message: userMsg.content,
        incidentId,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: err instanceof Error ? err.message : "Chat request failed" },
      ]);
    } finally {
      setLoading(false);
    }
  }, [message, incidentId]);

  return (
    <SpaceBetween size="l">
      <Container header={<Header variant="h2">{t("ai.chatWithIncident")}</Header>}>
        <SpaceBetween size="m">
          <FormField label={t("ai.incidentId")}>
            <Input
              value={incidentId}
              onChange={({ detail }) => setIncidentId(detail.value)}
              placeholder={t("ai.incidentId")}
            />
          </FormField>

          {incidentId.trim() && (
            <>
              <div
                ref={scrollRef}
                style={{
                  maxHeight: 400,
                  overflowY: "auto",
                  border: "1px solid var(--color-border-divider-default, #e9ebed)",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                {messages.length === 0 ? (
                  <Box textAlign="center" color="text-body-secondary" padding="l">
                    {t("ai.chatWithIncident")}
                  </Box>
                ) : (
                  <SpaceBetween size="m">
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                        }}
                      >
                        <Box
                          padding="s"
                          variant={msg.role === "user" ? "awsui-key-label" : "p"}
                          color={msg.role === "user" ? "text-status-info" : "inherit"}
                        >
                          <Box variant="small" color="text-body-secondary">
                            {msg.role === "user" ? "You" : "AI Assistant"}
                          </Box>
                          {msg.content}
                        </Box>
                      </div>
                    ))}
                    {loading && <Spinner />}
                  </SpaceBetween>
                )}
              </div>

              <SpaceBetween direction="horizontal" size="xs">
                <div style={{ flex: 1 }}>
                  <Input
                    value={message}
                    onChange={({ detail }) => setMessage(detail.value)}
                    placeholder={t("ai.sendMessage")}
                    onKeyDown={({ detail }) => {
                      if (detail.key === "Enter") handleSend();
                    }}
                  />
                </div>
                <Button variant="primary" loading={loading} onClick={handleSend} disabled={!message.trim()}>
                  {t("ai.sendMessage")}
                </Button>
              </SpaceBetween>
            </>
          )}
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
}

// ─── Provider Modal ───────────────────────────────────

interface ProviderFormState {
  name: string;
  type: AIProviderType;
  apiKey: string;
  model: string;
  baseUrl: string;
  enabled: boolean;
  isDefault: boolean;
}

const INITIAL_PROVIDER_FORM: ProviderFormState = {
  name: "",
  type: "openai",
  apiKey: "",
  model: "",
  baseUrl: "",
  enabled: true,
  isDefault: false,
};

// ─── AI Page ──────────────────────────────────────────

export default function AIPage() {
  const { t } = useI18n();
  const { addNotification } = useNotifications();
  const { data: providers, loading: providersLoading, refetch } = useApi<AIProvider[]>("/api/ai/providers");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderFormState>(INITIAL_PROVIDER_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState<string | null>(null);

  const { items, collectionProps } = useCollection(providers ?? [], {
    sorting: { defaultState: { sortingColumn: { sortingField: "name" } } },
  });

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_PROVIDER_FORM);
    setShowModal(true);
  }, []);

  const openEdit = useCallback((provider: AIProvider) => {
    setEditingId(provider.id);
    setForm({
      name: provider.name,
      type: provider.type,
      apiKey: "",
      model: provider.model ?? "",
      baseUrl: provider.baseUrl ?? "",
      enabled: provider.enabled,
      isDefault: provider.isDefault,
    });
    setShowModal(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        type: form.type,
        model: form.model || undefined,
        baseUrl: form.baseUrl || undefined,
        enabled: form.enabled,
        isDefault: form.isDefault,
      };
      if (form.apiKey) body.apiKey = form.apiKey;

      if (editingId) {
        await apiPut(`/api/ai/providers/${editingId}`, body);
        addNotification({ type: "success", content: t("ai.updated") });
      } else {
        body.apiKey = form.apiKey;
        await apiPost("/api/ai/providers", body);
        addNotification({ type: "success", content: t("ai.created") });
      }
      setShowModal(false);
      refetch();
    } catch (err) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : t("ai.created") });
    } finally {
      setSaving(false);
    }
  }, [form, editingId, addNotification, refetch]);

  const handleDelete = useCallback(async (id: string) => {
    setDeleteLoading(id);
    try {
      await apiDelete(`/api/ai/providers/${id}`);
      addNotification({ type: "success", content: t("ai.deleted") });
      refetch();
    } catch (err) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : t("ai.deleted") });
    } finally {
      setDeleteLoading(null);
    }
  }, [addNotification, refetch]);

  const handleTest = useCallback(async (id: string) => {
    setTestLoading(id);
    try {
      await apiPost(`/api/ai/providers/${id}/test`);
      addNotification({ type: "success", content: t("ai.testSuccess") });
    } catch (err) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : t("ai.testFailed") });
    } finally {
      setTestLoading(null);
    }
  }, [addNotification]);

  return (
    <ContentLayout header={<Header variant="h1">{t("page.ai")}</Header>}>
      <SpaceBetween size="l">
        <Tabs
          tabs={[
            { label: t("ai.query"), id: "query", content: <QueryTab /> },
            { label: t("ai.chat"), id: "chat", content: <ChatTab /> },
          ]}
        />

        <Table
          {...collectionProps}
          items={items}
          loading={providersLoading}
          loadingText={t("ai.providers")}
          variant="container"
          header={
            <Header
              variant="h2"
              counter={providers ? `(${providers.length})` : undefined}
              actions={
                <Button variant="primary" onClick={openCreate}>
                  {t("ai.addProvider")}
                </Button>
              }
            >
              {t("ai.providers")}
            </Header>
          }
          columnDefinitions={[
            {
              id: "name",
              header: t("ai.providerName"),
              cell: (item) => item.name,
              sortingField: "name",
              width: 180,
            },
            {
              id: "type",
              header: t("ai.providerType"),
              cell: (item) => item.type.charAt(0).toUpperCase() + item.type.slice(1),
              sortingField: "type",
              width: 120,
            },
            {
              id: "model",
              header: t("ai.model"),
              cell: (item) => item.model ?? "—",
              width: 180,
            },
            {
              id: "enabled",
              header: t("common.enabled"),
              cell: (item) => (
                <StatusIndicator type={item.enabled ? "success" : "stopped"}>
                  {item.enabled ? t("common.enabled") : t("common.enabled")}
                </StatusIndicator>
              ),
              width: 100,
            },
            {
              id: "isDefault",
              header: t("ai.isDefault"),
              cell: (item) => (
                <StatusIndicator type={item.isDefault ? "success" : "stopped"}>
                  {item.isDefault ? t("ai.isDefault") : "—"}
                </StatusIndicator>
              ),
              width: 100,
            },
            {
              id: "createdAt",
              header: t("common.createdAt"),
              cell: (item) => new Date(item.createdAt).toLocaleDateString(),
              sortingField: "createdAt",
              width: 120,
            },
            {
              id: "actions",
              header: t("common.actions"),
              cell: (item) => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    variant="inline-link"
                    loading={testLoading === item.id}
                    onClick={() => handleTest(item.id)}
                  >
                    {t("ai.testProvider")}
                  </Button>
                  <Button variant="inline-link" onClick={() => openEdit(item)}>{t("ai.editProvider")}</Button>
                  <Button
                    variant="inline-link"
                    loading={deleteLoading === item.id}
                    onClick={() => handleDelete(item.id)}
                  >
                    {t("common.delete")}
                  </Button>
                </SpaceBetween>
              ),
              width: 200,
            },
          ]}
          empty={
            <Box textAlign="center" color="inherit" padding="l">
              <SpaceBetween size="m">
                <Box variant="strong">{t("ai.providers")}</Box>
                <Box variant="p" color="inherit">{t("ai.addProvider")}</Box>
                <Button variant="primary" onClick={openCreate}>{t("ai.addProvider")}</Button>
              </SpaceBetween>
            </Box>
          }
        />

        <Modal
          visible={showModal}
          onDismiss={() => setShowModal(false)}
          header={editingId ? t("ai.editProvider") : t("ai.addProvider")}
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowModal(false)}>{t("common.cancel")}</Button>
                <Button variant="primary" loading={saving} onClick={handleSave}>
                  {editingId ? t("common.save") : t("common.create")}
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <Form>
            <SpaceBetween size="m">
              <FormField label={t("ai.providerName")}>
                <Input
                  value={form.name}
                  onChange={({ detail }) => setForm((f) => ({ ...f, name: detail.value }))}
                />
              </FormField>
              <FormField label={t("ai.selectType")}>
                <Select
                  selectedOption={PROVIDER_TYPE_OPTIONS.find((o) => o.value === form.type) ?? PROVIDER_TYPE_OPTIONS[0]}
                  onChange={({ detail }) =>
                    setForm((f) => ({ ...f, type: detail.selectedOption.value as AIProviderType }))
                  }
                  options={PROVIDER_TYPE_OPTIONS}
                />
              </FormField>
              <FormField label={t("ai.apiKey")}>
                <Input
                  value={form.apiKey}
                  onChange={({ detail }) => setForm((f) => ({ ...f, apiKey: detail.value }))}
                  type="password"
                />
              </FormField>
              <FormField label={t("ai.model")}>
                <Input
                  value={form.model}
                  onChange={({ detail }) => setForm((f) => ({ ...f, model: detail.value }))}
                />
              </FormField>
              <FormField label={t("ai.baseUrl")}>
                <Input
                  value={form.baseUrl}
                  onChange={({ detail }) => setForm((f) => ({ ...f, baseUrl: detail.value }))}
                />
              </FormField>
              <FormField label={t("common.enabled")}>
                <Toggle
                  checked={form.enabled}
                  onChange={({ detail }) => setForm((f) => ({ ...f, enabled: detail.checked }))}
                />
              </FormField>
              <FormField label={t("ai.isDefault")}>
                <Toggle
                  checked={form.isDefault}
                  onChange={({ detail }) => setForm((f) => ({ ...f, isDefault: detail.checked }))}
                />
              </FormField>
            </SpaceBetween>
          </Form>
        </Modal>
      </SpaceBetween>
    </ContentLayout>
  );
}
