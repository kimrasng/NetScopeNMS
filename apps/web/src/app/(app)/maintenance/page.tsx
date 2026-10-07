"use client";
import { formatDateTime } from "@/lib/date-format";

import { useState, useCallback } from "react";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Pagination from "@cloudscape-design/components/pagination";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Modal from "@cloudscape-design/components/modal";
import Form from "@cloudscape-design/components/form";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import DatePicker from "@cloudscape-design/components/date-picker";
import TimeInput from "@cloudscape-design/components/time-input";
import Autosuggest from "@cloudscape-design/components/autosuggest";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Select from "@cloudscape-design/components/select";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Textarea from "@cloudscape-design/components/textarea";
import Toggle from "@cloudscape-design/components/toggle";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { useApi } from "@/hooks/use-api";
import { useNotifications } from "@/hooks/use-notifications";
import { useI18n } from "@/lib/i18n";
import { apiPost, apiPut, apiDelete } from "@/lib/api";
import { ResourceScopeFields } from "@/components/common/resource-scope-fields";
import { useAuth } from "@/lib/auth";
import { canAdminister } from "@/lib/permissions";
import type { MaintenanceWindow, PaginatedResponse } from "@/lib/types";

interface MaintenanceFormState {
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  recurring: boolean;
  cronExpression: string;
  timezone: string;
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
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  deviceIds: "",
  groupIds: "",
};

function localDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function getWindowStatus(start: string, end: string, t: (key: string) => string, isActive?: boolean, recurring = false): { type: "success" | "info" | "stopped"; label: string } {
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isActive ?? (now >= s && now < e)) return { type: "success", label: t("maintenance.active") };
  if (now < s || recurring) return { type: "info", label: t("maintenance.upcoming") };
  return { type: "stopped", label: t("maintenance.past") };
}

export default function MaintenancePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [page, setPage] = useState(1);
  const { data, loading, refetch } = useApi<PaginatedResponse<MaintenanceWindow>>(
    "/api/maintenance-windows",
    { page, limit: 50 },
  );

  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    setFormError(""); setFieldErrors({});
    setShowModal(true);
  }, []);

  const openEdit = useCallback((w: MaintenanceWindow) => {
    setEditingId(w.id);
    setForm({
      name: w.name,
      description: w.description ?? "",
      startAt: localDateTime(w.startAt),
      endAt: localDateTime(w.endAt),
      recurring: w.recurring,
      cronExpression: w.cronExpression ?? "",
      timezone: w.timezone ?? "UTC",
      deviceIds: w.deviceIds.join(", "),
      groupIds: w.groupIds.join(", "),
    });
    setFormError(""); setFieldErrors({});
    setShowModal(true);
  }, []);

  const handleSave = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = t("Name is required.");
    if (!Number.isFinite(new Date(form.startAt).getTime())) errors.start = t("Select a valid start date and time.");
    if (!Number.isFinite(new Date(form.endAt).getTime()) || new Date(form.endAt) <= new Date(form.startAt)) errors.end = t("End time must be after start time.");
    setFieldErrors(errors); setFormError("");
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description || undefined,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        recurring: form.recurring,
        timezone: form.timezone,
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
      setFormError(err instanceof Error ? err.message : t("Failed to save."));
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
    <>
      <Table
        {...collectionProps}
        items={items}
        loading={loading}
        loadingText={t("Loading maintenance windows...")}
        variant="full-page"
        stickyHeader
        header={
          <Header variant="awsui-h1-sticky"
            counter={data ? `(${data.pagination.total})` : undefined}
            actions={
              <Button variant="primary" disabled={!canAdminister(user)} onClick={openCreate}>
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
            cell: (item) => formatDateTime(new Date(item.startAt)),
            sortingField: "startAt",
            width: 180,
          },
          {
            id: "endAt",
            header: t("maintenance.endAt"),
            cell: (item) => formatDateTime(new Date(item.endAt)),
            sortingField: "endAt",
            width: 180,
          },
          {
            id: "recurring",
            header: t("maintenance.recurring"),
            cell: (item) => (
              <StatusIndicator type={item.recurring ? "success" : "stopped"}>
                {t(item.recurring ? "Yes" : "No")}
              </StatusIndicator>
            ),
            width: 110,
          },
          {
            id: "devices",
            header: t("maintenance.devices"),
            cell: (item) => item.deviceIds.length || item.groupIds.length ? `${t("devices")}: ${item.deviceIds.length}, ${t("groups")}: ${item.groupIds.length}` : t("All devices"),
            width: 120,
          },
          {
            id: "status",
            header: t("maintenance.statusLabel"),
            cell: (item) => {
              const s = getWindowStatus(item.startAt, item.endAt, t, item.isActive, item.recurring);
              return <StatusIndicator type={s.type}>{s.label}</StatusIndicator>;
            },
            width: 120,
          },
          {
            id: "actions",
            header: t("common.actions"),
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="inline-link" disabled={!canAdminister(user)} onClick={() => openEdit(item)}>{t("Edit")}</Button>
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
              <Box variant="strong">{t("No maintenance windows")}</Box>
              <Box variant="p" color="inherit">{t("Create a maintenance window to suppress alerts during planned work.")}</Box>

            </SpaceBetween>
          </Box>
        }
      />

      <Modal
        size="large"
        visible={showModal}
        onDismiss={() => setShowModal(false)}
        header={editingId ? `${t("page.maintenance")} — ${t("common.edit")}` : t("maintenance.createWindow")}
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
        <Form errorText={formError}>
          <SpaceBetween size="m">
            <FormField label={t("maintenance.name")} errorText={fieldErrors.name}>
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
            <ColumnLayout columns={2}>
              <FormField label={t("Start date")} errorText={fieldErrors.start} constraintText={t("Times are shown in your local timezone.")}><DatePicker value={form.startAt.split("T")[0] ?? ""} placeholder="YYYY/MM/DD" onChange={({ detail }) => setForm(f => ({ ...f, startAt: `${detail.value}T${f.startAt.split("T")[1] || "00:00"}` }))} /></FormField>
              <FormField label={t("Start time")}><TimeInput format="hh:mm" value={form.startAt.split("T")[1] ?? ""} placeholder="hh:mm" onChange={({ detail }) => setForm(f => ({ ...f, startAt: `${f.startAt.split("T")[0] || ""}T${detail.value}` }))} /></FormField>
            </ColumnLayout>
            <ColumnLayout columns={2}>
              <FormField label={t("End date")} errorText={fieldErrors.end} constraintText={t("Times are shown in your local timezone.")}><DatePicker value={form.endAt.split("T")[0] ?? ""} placeholder="YYYY/MM/DD" onChange={({ detail }) => setForm(f => ({ ...f, endAt: `${detail.value}T${f.endAt.split("T")[1] || "00:00"}` }))} /></FormField>
              <FormField label={t("End time")}><TimeInput format="hh:mm" value={form.endAt.split("T")[1] ?? ""} placeholder="hh:mm" onChange={({ detail }) => setForm(f => ({ ...f, endAt: `${f.endAt.split("T")[0] || ""}T${detail.value}` }))} /></FormField>
            </ColumnLayout>
            <FormField label={t("maintenance.recurring")}>
              <Toggle
                checked={form.recurring}
                onChange={({ detail }) => setForm((f) => ({ ...f, recurring: detail.checked }))}
              />
            </FormField>
            {form.recurring && <ExpandableSection defaultExpanded headerText={t("Recurrence schedule")}><SpaceBetween size="m">
              <FormField label={t("Schedule")}><Select options={[{ value: "0 2 * * *", label: t("Daily at 02:00") }, { value: "0 2 * * 0", label: t("Sundays at 02:00") }, { value: "0 2 * * 1-5", label: t("Weekdays at 02:00") }, { value: "custom", label: t("Custom cron expression") }]} selectedOption={{ value: ["0 2 * * *", "0 2 * * 0", "0 2 * * 1-5"].includes(form.cronExpression) ? form.cronExpression : "custom", label: t({ "0 2 * * *": "Daily at 02:00", "0 2 * * 0": "Sundays at 02:00", "0 2 * * 1-5": "Weekdays at 02:00" }[form.cronExpression] ?? "Custom cron expression") }} onChange={({ detail }) => setForm({ ...form, cronExpression: detail.selectedOption.value === "custom" ? "" : detail.selectedOption.value ?? "" })} /></FormField>
              <FormField label={t("maintenance.cronExpression")} description={t("Format: minute hour day month weekday. The first window defines the duration of each recurrence.")}><Input value={form.cronExpression} onChange={({ detail }) => setForm({ ...form, cronExpression: detail.value })} placeholder="0 2 * * 0" /></FormField>
              <FormField label={t("Recurrence timezone")}><Autosuggest value={form.timezone} options={["UTC", ...Intl.supportedValuesOf("timeZone")].map(value => ({ value }))} onChange={({ detail }) => setForm({ ...form, timezone: detail.value })} /></FormField>
            </SpaceBetween></ExpandableSection>}
            <ResourceScopeFields deviceIds={form.deviceIds.split(",").map(id => id.trim()).filter(Boolean)} groupIds={form.groupIds.split(",").map(id => id.trim()).filter(Boolean)} onChange={(devices, groups) => setForm({ ...form, deviceIds: devices.join(","), groupIds: groups.join(",") })} />
          </SpaceBetween>
        </Form>
      </Modal>
    </>
  );
}
