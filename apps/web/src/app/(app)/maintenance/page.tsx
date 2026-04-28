"use client";

import { useState, useCallback } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Pagination from "@cloudscape-design/components/pagination";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Modal from "@cloudscape-design/components/modal";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Textarea from "@cloudscape-design/components/textarea";
import Toggle from "@cloudscape-design/components/toggle";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { useApi } from "@/hooks/use-api";
import { useNotifications } from "@/hooks/use-notifications";
import { useI18n } from "@/lib/i18n";
import { apiPost, apiPut, apiDelete } from "@/lib/api";
import type { MaintenanceWindow, PaginatedResponse } from "@/lib/types";

interface MaintenanceFormState {
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  recurring: boolean;
  cronExpression: string;
  deviceIds: string;
  groupIds: string;
}

const INITIAL_FORM: MaintenanceFormState = {
  name: "",
  description: "",
  startAt: "",
  endAt: "",
  recurring: false,
  cronExpression: "",
  deviceIds: "",
  groupIds: "",
};

function getWindowStatus(start: string, end: string, t: (key: string) => string): { type: "success" | "info" | "stopped"; label: string } {
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (now >= s && now <= e) return { type: "success", label: t("maintenance.active") };
  if (now < s) return { type: "info", label: t("maintenance.upcoming") };
  return { type: "stopped", label: t("maintenance.past") };
}

export default function MaintenancePage() {
  const { t } = useI18n();
  const { addNotification } = useNotifications();
  const [page, setPage] = useState(1);
  const { data, loading, refetch } = useApi<PaginatedResponse<MaintenanceWindow>>(
    "/api/maintenance-windows",
    { page, limit: 50 },
  );

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MaintenanceFormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const windows = data?.data ?? [];

  const { items, collectionProps } = useCollection(windows, {
    sorting: { defaultState: { sortingColumn: { sortingField: "startAt" }, isDescending: true } },
  });

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setShowModal(true);
  }, []);

  const openEdit = useCallback((w: MaintenanceWindow) => {
    setEditingId(w.id);
    setForm({
      name: w.name,
      description: w.description ?? "",
      startAt: w.startAt.slice(0, 16),
      endAt: w.endAt.slice(0, 16),
      recurring: w.recurring,
      cronExpression: w.cronExpression ?? "",
      deviceIds: w.deviceIds.join(", "),
      groupIds: w.groupIds.join(", "),
    });
    setShowModal(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description || undefined,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        recurring: form.recurring,
        cronExpression: form.cronExpression || undefined,
        deviceIds: form.deviceIds ? form.deviceIds.split(",").map((s) => s.trim()).filter(Boolean) : [],
        groupIds: form.groupIds ? form.groupIds.split(",").map((s) => s.trim()).filter(Boolean) : [],
      };

      if (editingId) {
        await apiPut(`/api/maintenance-windows/${editingId}`, body);
        addNotification({ type: "success", content: t("maintenance.updated") });
      } else {
        await apiPost("/api/maintenance-windows", body);
        addNotification({ type: "success", content: t("maintenance.created") });
      }
      setShowModal(false);
      refetch();
    } catch (err) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : "Failed to save." });
    } finally {
      setSaving(false);
    }
  }, [form, editingId, addNotification, refetch, t]);

  const handleDelete = useCallback(async (id: string) => {
    setDeleteLoading(id);
    try {
      await apiDelete(`/api/maintenance-windows/${id}`);
      addNotification({ type: "success", content: t("maintenance.deleted") });
      refetch();
    } catch (err) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : "Failed to delete." });
    } finally {
      setDeleteLoading(null);
    }
  }, [addNotification, refetch, t]);

  return (
    <ContentLayout header={<Header variant="h1">{t("page.maintenance")}</Header>}>
      <Table
        {...collectionProps}
        items={items}
        loading={loading}
        loadingText="Loading maintenance windows..."
        variant="full-page"
        stickyHeader
        header={
          <Header
            variant="h2"
            counter={data ? `(${data.pagination.total})` : undefined}
            actions={
              <Button variant="primary" onClick={openCreate}>
                {t("maintenance.createWindow")}
              </Button>
            }
          >
            {t("page.maintenance")}
          </Header>
        }
        pagination={
          <Pagination
            currentPageIndex={page}
            pagesCount={data?.pagination.totalPages ?? 1}
            onChange={({ detail }) => setPage(detail.currentPageIndex)}
          />
        }
        columnDefinitions={[
          {
            id: "name",
            header: t("maintenance.name"),
            cell: (item) => item.name,
            sortingField: "name",
            width: 200,
          },
          {
            id: "startAt",
            header: t("maintenance.startAt"),
            cell: (item) => new Date(item.startAt).toLocaleString(),
            sortingField: "startAt",
            width: 180,
          },
          {
            id: "endAt",
            header: t("maintenance.endAt"),
            cell: (item) => new Date(item.endAt).toLocaleString(),
            sortingField: "endAt",
            width: 180,
          },
          {
            id: "recurring",
            header: t("maintenance.recurring"),
            cell: (item) => (
              <StatusIndicator type={item.recurring ? "success" : "stopped"}>
                {item.recurring ? "Yes" : "No"}
              </StatusIndicator>
            ),
            width: 110,
          },
          {
            id: "devices",
            header: t("maintenance.devices"),
            cell: (item) => item.deviceIds.length > 0 ? `${item.deviceIds.length} device(s)` : "—",
            width: 120,
          },
          {
            id: "status",
            header: t("maintenance.statusLabel"),
            cell: (item) => {
              const s = getWindowStatus(item.startAt, item.endAt, t);
              return <StatusIndicator type={s.type}>{s.label}</StatusIndicator>;
            },
            width: 120,
          },
          {
            id: "actions",
            header: t("common.actions"),
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="inline-link" onClick={() => openEdit(item)}>Edit</Button>
                <Button
                  variant="inline-link"
                  loading={deleteLoading === item.id}
                  onClick={() => handleDelete(item.id)}
                >
                  {t("common.delete")}
                </Button>
              </SpaceBetween>
            ),
            width: 150,
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit" padding="l">
            <SpaceBetween size="m">
              <Box variant="strong">No maintenance windows</Box>
              <Box variant="p" color="inherit">Create a maintenance window to suppress alerts during planned work.</Box>
              <Button variant="primary" onClick={openCreate}>{t("maintenance.createWindow")}</Button>
            </SpaceBetween>
          </Box>
        }
      />

      <Modal
        visible={showModal}
        onDismiss={() => setShowModal(false)}
        header={editingId ? t("maintenance.createWindow") : t("maintenance.createWindow")}
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
            <FormField label={t("maintenance.name")}>
              <Input
                value={form.name}
                onChange={({ detail }) => setForm((f) => ({ ...f, name: detail.value }))}
              />
            </FormField>
            <FormField label={t("common.description")}>
              <Textarea
                value={form.description}
                onChange={({ detail }) => setForm((f) => ({ ...f, description: detail.value }))}
              />
            </FormField>
            <FormField label={t("maintenance.startAt")}>
              <Input
                value={form.startAt}
                onChange={({ detail }) => setForm((f) => ({ ...f, startAt: detail.value }))}
                type="text"
                placeholder="YYYY-MM-DDTHH:mm"
              />
            </FormField>
            <FormField label={t("maintenance.endAt")}>
              <Input
                value={form.endAt}
                onChange={({ detail }) => setForm((f) => ({ ...f, endAt: detail.value }))}
                type="text"
                placeholder="YYYY-MM-DDTHH:mm"
              />
            </FormField>
            <FormField label={t("maintenance.recurring")}>
              <Toggle
                checked={form.recurring}
                onChange={({ detail }) => setForm((f) => ({ ...f, recurring: detail.checked }))}
              />
            </FormField>
            {form.recurring && (
              <FormField label={t("maintenance.cronExpression")}>
                <Input
                  value={form.cronExpression}
                  onChange={({ detail }) => setForm((f) => ({ ...f, cronExpression: detail.value }))}
                  placeholder="0 2 * * 0"
                />
              </FormField>
            )}
            <FormField label={t("maintenance.devices")} description="Comma-separated list of device IDs">
              <Input
                value={form.deviceIds}
                onChange={({ detail }) => setForm((f) => ({ ...f, deviceIds: detail.value }))}
              />
            </FormField>
            <FormField label="Group IDs" description="Comma-separated list of group IDs">
              <Input
                value={form.groupIds}
                onChange={({ detail }) => setForm((f) => ({ ...f, groupIds: detail.value }))}
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </Modal>
    </ContentLayout>
  );
}
