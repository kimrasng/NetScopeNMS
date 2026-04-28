"use client";

import { useState, useCallback, useMemo } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";
import Tabs from "@cloudscape-design/components/tabs";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Badge from "@cloudscape-design/components/badge";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Modal from "@cloudscape-design/components/modal";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import type { SelectProps } from "@cloudscape-design/components/select";
import Toggle from "@cloudscape-design/components/toggle";
import Textarea from "@cloudscape-design/components/textarea";
import Pagination from "@cloudscape-design/components/pagination";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { useApi } from "@/hooks/use-api";
import { useNotifications } from "@/hooks/use-notifications";
import { apiPost, apiPut, apiDelete } from "@/lib/api";
import type {
  NotificationChannel,
  NotificationChannelType,
  NotificationRecord,
  PaginatedResponse,
} from "@/lib/types";
import { useI18n } from "@/lib/i18n";

// ─── Constants ────────────────────────────────────────

const CHANNEL_TYPE_COLORS: Record<NotificationChannelType, "blue" | "red" | "grey" | "green"> = {
  email: "blue",
  telegram: "blue",
  discord: "blue",
  slack: "green",
  sms: "grey",
  kakao: "grey",
  pagerduty: "green",
  webhook: "grey",
  in_app: "blue",
};

const NOTIFICATION_STATUS_MAP: Record<string, "success" | "error" | "pending" | "in-progress"> = {
  sent: "success",
  failed: "error",
  pending: "pending",
  queued: "in-progress",
};

interface ChannelFormState {
  name: string;
  type: SelectProps.Option | null;
  config: string;
  enabled: boolean;
}

const EMPTY_CHANNEL_FORM: ChannelFormState = {
  name: "",
  type: { value: "email", label: "Email" },
  config: "{}",
  enabled: true,
};

// ─── Channels Tab ─────────────────────────────────────

function ChannelsTab() {
  const { t } = useI18n();
  const { addNotification } = useNotifications();
  const { data, loading, refetch } = useApi<NotificationChannel[]>("/api/notifications/channels");

  const CHANNEL_TYPE_OPTIONS: SelectProps.Option[] = useMemo(() => [
    { value: "email", label: t("channelType.email") },
    { value: "telegram", label: t("channelType.telegram") },
    { value: "discord", label: t("channelType.discord") },
    { value: "slack", label: t("channelType.slack") },
    { value: "sms", label: t("channelType.sms") },
    { value: "pagerduty", label: t("channelType.pagerduty") },
    { value: "webhook", label: t("channelType.webhook") },
  ], [t]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [form, setForm] = useState<ChannelFormState>(EMPTY_CHANNEL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NotificationChannel | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const channels = data ?? [];

  const { items, collectionProps } = useCollection(channels, {
    sorting: {
      defaultState: { sortingColumn: { sortingField: "name" }, isDescending: false },
    },
  });

  const openCreate = useCallback(() => {
    setEditingChannel(null);
    setForm(EMPTY_CHANNEL_FORM);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((ch: NotificationChannel) => {
    setEditingChannel(ch);
    setForm({
      name: ch.name,
      type: CHANNEL_TYPE_OPTIONS.find((o) => o.value === ch.type) ?? CHANNEL_TYPE_OPTIONS[0],
      config: JSON.stringify(ch.config, null, 2),
      enabled: ch.enabled,
    });
    setModalVisible(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name || !form.type) return;
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(form.config);
    } catch {
      addNotification({ type: "error", content: "Invalid JSON in config field." });
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        name: form.name,
        type: form.type.value,
        config: parsedConfig,
        enabled: form.enabled,
      };
      if (editingChannel) {
        await apiPut(`/api/notifications/channels/${editingChannel.id}`, body);
        addNotification({ type: "success", content: t("notification.updated") });
      } else {
        await apiPost("/api/notifications/channels", body);
        addNotification({ type: "success", content: t("notification.created") });
      }
      setModalVisible(false);
      refetch();
    } catch {
      addNotification({ type: "error", content: editingChannel ? t("notification.updated") : t("notification.created") });
    } finally {
      setSubmitting(false);
    }
  }, [form, editingChannel, addNotification, refetch]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/api/notifications/channels/${deleteTarget.id}`);
      addNotification({ type: "success", content: t("notification.deleted") });
      setDeleteTarget(null);
      refetch();
    } catch {
      addNotification({ type: "error", content: t("notification.deleted") });
    }
  }, [deleteTarget, addNotification, refetch]);

  const handleTest = useCallback(async (channelId: string) => {
    setTestingId(channelId);
    try {
      await apiPost(`/api/notifications/test/${channelId}`);
      addNotification({ type: "success", content: t("notification.testSent") });
    } catch {
      addNotification({ type: "error", content: t("notification.testFailed") });
    } finally {
      setTestingId(null);
    }
  }, [addNotification]);

  return (
    <>
      <Table
        {...collectionProps}
        items={items}
        loading={loading}
        loadingText={t("notification.channels")}
        variant="full-page"
        stickyHeader
        header={
          <Header
            counter={`(${channels.length})`}
            actions={
              <Button variant="primary" onClick={openCreate}>{t("notification.addChannel")}</Button>
            }
          >
            {t("notification.channels")}
          </Header>
        }
        columnDefinitions={[
          {
            id: "name",
            header: t("notification.channelName"),
            cell: (item) => item.name,
            sortingField: "name",
            width: 200,
          },
          {
            id: "type",
            header: t("notification.channelType"),
            cell: (item) => (
              <Badge color={CHANNEL_TYPE_COLORS[item.type]}>
                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
              </Badge>
            ),
            sortingField: "type",
            width: 130,
          },
          {
            id: "enabled",
            header: t("common.enabled"),
            cell: (item) => (
              <StatusIndicator type={item.enabled ? "success" : "stopped"}>
                {item.enabled ? t("common.enabled") : t("common.enabled")}
              </StatusIndicator>
            ),
            width: 120,
          },
          {
            id: "createdAt",
            header: t("common.createdAt"),
            cell: (item) => new Date(item.createdAt).toLocaleString(),
            sortingField: "createdAt",
            width: 180,
          },
          {
            id: "actions",
            header: t("common.actions"),
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="inline-link"
                  loading={testingId === item.id}
                  onClick={() => handleTest(item.id)}
                >
                  {t("notification.testChannel")}
                </Button>
                <Button variant="inline-link" onClick={() => openEdit(item)}>{t("notification.editChannel")}</Button>
                <Button variant="inline-link" onClick={() => setDeleteTarget(item)}>{t("common.delete")}</Button>
              </SpaceBetween>
            ),
            width: 200,
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit" padding="l">
            <SpaceBetween size="m">
              <Box variant="strong">{t("notification.channels")}</Box>
              <Box variant="p" color="inherit">{t("notification.addChannel")}</Box>
              <Button variant="primary" onClick={openCreate}>{t("notification.addChannel")}</Button>
            </SpaceBetween>
          </Box>
        }
      />

      <Modal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        header={editingChannel ? t("notification.editChannel") : t("notification.addChannel")}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setModalVisible(false)}>{t("common.cancel")}</Button>
              <Button variant="primary" loading={submitting} onClick={handleSubmit}>
                {editingChannel ? t("common.save") : t("common.create")}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Form>
          <SpaceBetween size="m">
            <FormField label={t("notification.channelName")}>
              <Input
                value={form.name}
                onChange={({ detail }) => setForm((f) => ({ ...f, name: detail.value }))}
              />
            </FormField>
            <FormField label={t("notification.selectType")}>
              <Select
                selectedOption={form.type}
                onChange={({ detail }) => setForm((f) => ({ ...f, type: detail.selectedOption }))}
                options={CHANNEL_TYPE_OPTIONS}
              />
            </FormField>
            <FormField label={t("notification.config")}>
              <Textarea
                value={form.config}
                onChange={({ detail }) => setForm((f) => ({ ...f, config: detail.value }))}
                rows={6}
              />
            </FormField>
            <FormField label={t("common.enabled")}>
              <Toggle
                checked={form.enabled}
                onChange={({ detail }) => setForm((f) => ({ ...f, enabled: detail.checked }))}
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </Modal>

      <Modal
        visible={deleteTarget !== null}
        onDismiss={() => setDeleteTarget(null)}
        header={t("common.delete")}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteTarget(null)}>{t("common.cancel")}</Button>
              <Button variant="primary" onClick={handleDelete}>{t("common.delete")}</Button>
            </SpaceBetween>
          </Box>
        }
      >
        {deleteTarget?.name}
      </Modal>
    </>
  );
}

// ─── History Tab ──────────────────────────────────────

function HistoryTab() {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const { data, loading } = useApi<PaginatedResponse<NotificationRecord>>(
    "/api/notifications/history",
    { page, limit: 50 },
  );

  const records = data?.data ?? [];
  const pagination = data?.pagination;

  const { items, collectionProps } = useCollection(records, {
    sorting: {
      defaultState: { sortingColumn: { sortingField: "createdAt" }, isDescending: true },
    },
  });

  return (
    <Table
      {...collectionProps}
      items={items}
      loading={loading}
      loadingText={t("notification.history")}
      variant="full-page"
      stickyHeader
      header={
        <Header counter={pagination ? `(${pagination.total})` : undefined}>
          {t("notification.history")}
        </Header>
      }
      pagination={
        pagination ? (
          <Pagination
            currentPageIndex={page}
            pagesCount={pagination.totalPages}
            onChange={({ detail }) => setPage(detail.currentPageIndex)}
            ariaLabels={{
              nextPageLabel: "Next page",
              previousPageLabel: "Previous page",
              pageLabel: (pageNumber) => `Page ${pageNumber}`,
            }}
          />
        ) : undefined
      }
      columnDefinitions={[
        {
          id: "channelType",
          header: t("notification.channelType"),
          cell: (item) => (
            <Badge color={CHANNEL_TYPE_COLORS[item.channelType]}>
              {item.channelType.charAt(0).toUpperCase() + item.channelType.slice(1)}
            </Badge>
          ),
          sortingField: "channelType",
          width: 130,
        },
        {
          id: "status",
          header: t("common.status"),
          cell: (item) => (
            <StatusIndicator type={NOTIFICATION_STATUS_MAP[item.status] ?? "stopped"}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </StatusIndicator>
          ),
          sortingField: "status",
          width: 120,
        },
        {
          id: "incidentId",
          header: t("notification.incident"),
          cell: (item) => item.incidentId ?? "—",
          width: 280,
        },
        {
          id: "sentAt",
          header: t("notification.sentAt"),
          cell: (item) => (item.sentAt ? new Date(item.sentAt).toLocaleString() : "—"),
          sortingField: "sentAt",
          width: 180,
        },
        {
          id: "error",
          header: t("notification.error"),
          cell: (item) => item.error ?? "—",
        },
      ]}
      empty={
        <Box textAlign="center" color="inherit" padding="l">
          <Box variant="strong">{t("notification.history")}</Box>
        </Box>
      }
    />
  );
}

// ─── Notifications Page ───────────────────────────────

export default function NotificationsPage() {
  const { t } = useI18n();
  return (
    <ContentLayout header={<Header variant="h1">{t("page.notifications")}</Header>}>
      <Tabs
        tabs={[
          { label: t("notification.channels"), id: "channels", content: <ChannelsTab /> },
          { label: t("notification.history"), id: "history", content: <HistoryTab /> },
        ]}
      />
    </ContentLayout>
  );
}
