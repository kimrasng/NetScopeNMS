"use client";

import { useState, useCallback, useMemo } from "react";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Badge from "@cloudscape-design/components/badge";
import Modal from "@cloudscape-design/components/modal";
import Wizard from "@cloudscape-design/components/wizard";
import Autosuggest from "@cloudscape-design/components/autosuggest";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Alert from "@cloudscape-design/components/alert";
import Link from "@cloudscape-design/components/link";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import type { SelectProps } from "@cloudscape-design/components/select";
import Toggle from "@cloudscape-design/components/toggle";
import TextFilter from "@cloudscape-design/components/text-filter";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { useApi } from "@/hooks/use-api";
import { useNotifications } from "@/hooks/use-notifications";
import { apiPost, apiPut, apiDelete } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { canAdminister } from "@/lib/permissions";
import Multiselect from "@cloudscape-design/components/multiselect";
import { ResourceScopeFields } from "@/components/common/resource-scope-fields";
import type { NotificationChannel, AlertRule, Severity, Device, DeviceGroup, PaginatedResponse } from "@/lib/types";

// ─── Constants ────────────────────────────────────────

const SEVERITY_COLOR: Record<Severity, "red" | "blue" | "grey"> = {
  critical: "red",
  high: "red",
  medium: "blue",
  low: "grey",
};

const OPERATOR_OPTIONS: SelectProps.Option[] = [
  { value: ">", label: "> (greater than)" },
  { value: ">=", label: ">= (greater or equal)" },
  { value: "<", label: "< (less than)" },
  { value: "<=", label: "<= (less or equal)" },
  { value: "==", label: "== (equal)" },
  { value: "!=", label: "!= (not equal)" },
];

interface RuleFormState {
  name: string;
  metricName: string;
  operator: SelectProps.Option | null;
  threshold: string;
  severity: SelectProps.Option | null;
  deviceId: string;
  groupId: string;
  enabled: boolean;
  flapThreshold: string;
  flapWindow: string;
  channels: string[]; escalationChannels: string[]; escalationMinutes: string; runbookUrl: string;
}

const EMPTY_FORM: RuleFormState = {
  name: "",
  metricName: "",
  operator: OPERATOR_OPTIONS[0],
  threshold: "",
  severity: { value: "medium", label: "Medium" },
  deviceId: "",
  groupId: "",
  enabled: true,
  flapThreshold: "3",
  flapWindow: "5",
  channels: [], escalationChannels: [], escalationMinutes: "", runbookUrl: "",
};

// ─── Alert Rules Page ─────────────────────────────────

export default function AlertRulesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: channels } = useApi<NotificationChannel[]>("/api/notifications/channels");
  const channelOptions = (channels ?? []).map(channel => ({ label: channel.name, value: channel.id }));
  const { addNotification } = useNotifications();
  const { data, loading, refetch } = useApi<AlertRule[]>("/api/alert-rules");

  const SEVERITY_OPTIONS: SelectProps.Option[] = useMemo(() => [
    { value: "critical", label: t("severity.critical") },
    { value: "high", label: t("severity.high") },
    { value: "medium", label: t("severity.medium") },
    { value: "low", label: t("severity.low") },
  ], [t]);

  const { data: devices } = useApi<{ nodes: Device[] }>("/api/topology/graph");
  const { data: groups } = useApi<PaginatedResponse<DeviceGroup>>("/api/device-groups", { limit: 200 });
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [form, setForm] = useState<RuleFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AlertRule | null>(null);

  const rules = data ?? [];

  const { items, collectionProps, filterProps } = useCollection(rules, {
    filtering: {
      empty: (
        <Box textAlign="center" color="inherit">
          <Box variant="strong">{t("No matching alert rules")}</Box>
        </Box>
      ),
      noMatch: (
        <Box textAlign="center" color="inherit">
          <Box variant="strong">{t("No matching alert rules")}</Box>
        </Box>
      ),
    },
    sorting: {
      defaultState: { sortingColumn: { sortingField: "name" }, isDescending: false },
    },
  });

  const openCreate = useCallback(() => {
    setEditingRule(null);
    setForm(EMPTY_FORM);
    setStep(0); setFormError(""); setFieldErrors({});
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((rule: AlertRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      metricName: rule.metricName,
      operator: OPERATOR_OPTIONS.find((o) => o.value === rule.operator) ?? OPERATOR_OPTIONS[0],
      threshold: String(rule.threshold),
      severity: SEVERITY_OPTIONS.find((o) => o.value === rule.severity) ?? SEVERITY_OPTIONS[2],
      deviceId: rule.deviceId ?? "",
      groupId: rule.groupId ?? "",
      enabled: rule.enabled,
      flapThreshold: String(rule.flapThreshold),
      flapWindow: String(rule.flapWindow),
      channels: rule.channels, escalationChannels: rule.escalationChannels ?? [], escalationMinutes: String(rule.escalationMinutes ?? ""), runbookUrl: rule.runbookUrl ?? "",
    });
    setStep(0); setFormError(""); setFieldErrors({});
    setModalVisible(true);
  }, [SEVERITY_OPTIONS]);

  const validateCore = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = t("Name is required.");
    if (!form.metricName.trim()) errors.metric = t("Select a metric.");
    if (!form.threshold.trim() || !Number.isFinite(Number(form.threshold))) errors.threshold = t("Enter a numeric threshold.");
    setFieldErrors(errors);
    return !Object.keys(errors).length;
  }, [form.name, form.metricName, form.threshold, t]);

  const handleSubmit = useCallback(async () => {
    if (!validateCore() || !form.operator || !form.severity) return;
    setFormError("");
    setSubmitting(true);
    try {
      const body = {
        name: form.name,
        metricName: form.metricName,
        operator: form.operator.value,
        threshold: Number(form.threshold),
        severity: form.severity.value,
        deviceId: form.deviceId || null,
        groupId: form.groupId || null,
        enabled: form.enabled,
        flapThreshold: Number(form.flapThreshold),
        flapWindow: Number(form.flapWindow),
        channels: form.channels, escalationChannels: form.escalationChannels, escalationMinutes: form.escalationMinutes ? Number(form.escalationMinutes) : null, runbookUrl: form.runbookUrl || null,
      };
      if (editingRule) {
        await apiPut(`/api/alert-rules/${editingRule.id}`, body);
        addNotification({ type: "success", content: t("alertRule.updated") });
      } else {
        await apiPost("/api/alert-rules", body);
        addNotification({ type: "success", content: t("alertRule.created") });
      }
      setModalVisible(false);
      refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("Rule update failed"));
    } finally {
      setSubmitting(false);
    }
  }, [form, editingRule, addNotification, refetch, t, validateCore]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/api/alert-rules/${deleteTarget.id}`);
      addNotification({ type: "success", content: t("alertRule.deleted") });
      setDeleteTarget(null);
      refetch();
    } catch {
      addNotification({ type: "error", content: t("alertRule.deleted") });
    }
  }, [deleteTarget, addNotification, refetch, t]);

  const handleToggleEnabled = useCallback(async (rule: AlertRule) => {
    try {
      await apiPut(`/api/alert-rules/${rule.id}`, { enabled: !rule.enabled });
      refetch();
    } catch {
      addNotification({ type: "error", content: t("alertRule.updated") });
    }
  }, [addNotification, refetch, t]);

  return (
    <>
      <Table
        {...collectionProps}
        items={items}
        loading={loading}
        loadingText={t("page.alertRules")}
        variant="full-page"
        stickyHeader
        header={
          <Header variant="awsui-h1-sticky"
            counter={`(${rules.length})`}
            actions={
              <Button variant="primary" disabled={!canAdminister(user)} onClick={openCreate}>{t("alertRule.createRule")}</Button>
            }
          >
            {t("page.alertRules")}
          </Header>
        }
        filter={
          <TextFilter
            {...filterProps}
            filteringPlaceholder={t("page.alertRules")}
            filteringAriaLabel={t("page.alertRules")}
          />
        }
        columnDefinitions={[
          {
            id: "name",
            header: t("alertRule.name"),
            cell: (item) => item.name,
            sortingField: "name",
            width: 200,
          },
          {
            id: "metric",
            header: t("alertRule.metric"),
            cell: (item) => t(`metric.${item.metricName}`),
            sortingField: "metricName",
            width: 150,
          },
          {
            id: "condition",
            header: t("alertRule.condition"),
            cell: (item) => `${item.operator} ${item.threshold}`,
            width: 130,
          },
          {
            id: "severity",
            header: t("alertRule.severity"),
            cell: (item) => (
              <Badge color={SEVERITY_COLOR[item.severity]}>
                {t(`severity.${item.severity}` as "severity.critical" | "severity.high" | "severity.medium" | "severity.low")}
              </Badge>
            ),
            sortingField: "severity",
            width: 110,
          },
          {
            id: "target",
            header: t("alertRule.device"),
            cell: (item) => item.deviceId ? <Link href={`/devices/${item.deviceId}`}>{devices?.nodes.find(device => device.id === item.deviceId)?.name ?? t("Device")}</Link> : item.groupId ? groups?.data.find(group => group.id === item.groupId)?.name ?? t("Device groups") : t("All devices"),
            width: 150,
          },
          {
            id: "enabled",
            header: t("alertRule.enabled"),
            cell: (item) => (
              <Toggle
                checked={item.enabled}
                disabled={!canAdminister(user)} ariaLabel={`${item.name}: ${t("common.enabled")}`}
                onChange={() => handleToggleEnabled(item)}
              />
            ),
            width: 100,
          },
          {
            id: "actions",
            header: t("common.actions"),
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="inline-link" disabled={!canAdminister(user)} onClick={() => openEdit(item)}>{t("common.edit")}</Button>
                <Button variant="inline-link" disabled={!canAdminister(user)} onClick={() => setDeleteTarget(item)}>{t("common.delete")}</Button>
              </SpaceBetween>
            ),
            width: 150,
          },
        ]}
        empty={<Box textAlign="center" padding="l"><SpaceBetween size="s"><Box variant="strong">{t("No alert rules")}</Box><Box>{t("Define a condition to detect problems in collected metrics.")}</Box></SpaceBetween></Box>}
      />

      <Modal visible={modalVisible} size="large" onDismiss={() => setModalVisible(false)} header={editingRule ? t("common.edit") : t("alertRule.createRule")}>
        <SpaceBetween size="m">
          {formError && <Alert type="error">{formError}</Alert>}
          <Wizard activeStepIndex={step} onNavigate={({ detail }) => { if (detail.requestedStepIndex <= step || validateCore()) setStep(detail.requestedStepIndex); }} onCancel={() => setModalVisible(false)} onSubmit={handleSubmit} isLoadingNextStep={submitting} submitButtonText={t(editingRule ? "common.save" : "common.create")} steps={[
            { title: t("Rule condition"), content: <SpaceBetween size="m">            <FormField label={t("alertRule.name")} errorText={fieldErrors.name}>
              <Input
                value={form.name}
                onChange={({ detail }) => setForm((f) => ({ ...f, name: detail.value }))}
              />
            </FormField>
            <FormField label={t("alertRule.metric")} errorText={fieldErrors.metric}>
              <Autosuggest
                options={["cpu", "memory", "bandwidth_in", "bandwidth_out", "latency", "ping"].map(value => ({ value, label: t(`metric.${value}`) }))}
                value={form.metricName}
                onChange={({ detail }) => setForm((f) => ({ ...f, metricName: detail.value }))}
              />
            </FormField>
            <SpaceBetween direction="horizontal" size="m">
              <FormField label={t("alertRule.operator")}>
                <Select
                  selectedOption={form.operator ? { ...form.operator, label: t(form.operator.label ?? "") } : null}
                  onChange={({ detail }) => setForm((f) => ({ ...f, operator: detail.selectedOption }))}
                  options={OPERATOR_OPTIONS.map(option => ({ ...option, label: t(option.label ?? "") }))}
                />
              </FormField>
              <FormField label={t("alertRule.threshold")} errorText={fieldErrors.threshold}>
                <Input
                  type="number"
                  value={form.threshold}
                  onChange={({ detail }) => setForm((f) => ({ ...f, threshold: detail.value }))}
                />
              </FormField>
            </SpaceBetween>
            <FormField label={t("alertRule.severity")}>
              <Select
                selectedOption={form.severity ? { ...form.severity, label: t(`severity.${form.severity.value}`) } : null}
                onChange={({ detail }) => setForm((f) => ({ ...f, severity: detail.selectedOption }))}
                options={SEVERITY_OPTIONS}
              />
            </FormField>
</SpaceBetween> },
            { title: t("Resource scope"), content: <SpaceBetween size="m">            <ResourceScopeFields description={t("Select one device and/or group. When both are selected, the device must belong to that group.")} deviceIds={form.deviceId ? [form.deviceId] : []} groupIds={form.groupId ? [form.groupId] : []} onChange={(devices, groups) => setForm({ ...form, deviceId: devices.at(-1) ?? "", groupId: groups.at(-1) ?? "" })} />
            <FormField label={t("alertRule.enabled")}>
              <Toggle
                checked={form.enabled}
                onChange={({ detail }) => setForm((f) => ({ ...f, enabled: detail.checked }))}
              />
            </FormField>
</SpaceBetween> },
            { title: t("Notification policy"), content: <SpaceBetween size="m">            <FormField label={t("Notification channels")}><Multiselect options={channelOptions} selectedOptions={form.channels.map(id => channelOptions.find(option => option.value === id) ?? { value: id, label: id })} onChange={({ detail }) => setForm({ ...form, channels: detail.selectedOptions.map(option => option.value ?? "") })} /></FormField>
<ExpandableSection headerText={t("Advanced settings")}><SpaceBetween size="m">            <FormField label={t("Escalation delay (minutes)")}><Input type="number" value={form.escalationMinutes} onChange={({ detail }) => setForm({ ...form, escalationMinutes: detail.value })} /></FormField>
            <FormField label={t("Escalation channels")}><Multiselect options={channelOptions} selectedOptions={form.escalationChannels.map(id => channelOptions.find(option => option.value === id) ?? { value: id, label: id })} onChange={({ detail }) => setForm({ ...form, escalationChannels: detail.selectedOptions.map(option => option.value ?? "") })} /></FormField>
            <FormField label={t("Runbook URL")}><Input value={form.runbookUrl} onChange={({ detail }) => setForm({ ...form, runbookUrl: detail.value })} /></FormField>
            <SpaceBetween direction="horizontal" size="m">
              <FormField label={t("alertRule.flapThreshold")}>
                <Input
                  type="number"
                  value={form.flapThreshold}
                  onChange={({ detail }) => setForm((f) => ({ ...f, flapThreshold: detail.value }))}
                />
              </FormField>
              <FormField label={`${t("alertRule.flapWindow")} (minutes)`}>
                <Input
                  type="number"
                  value={form.flapWindow}
                  onChange={({ detail }) => setForm((f) => ({ ...f, flapWindow: detail.value }))}
                />
              </FormField>
            </SpaceBetween>
</SpaceBetween></ExpandableSection></SpaceBetween> },
          ]} />
        </SpaceBetween>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        visible={deleteTarget !== null}
        onDismiss={() => setDeleteTarget(null)}
        header={t("common.delete")}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" disabled={!canAdminister(user)} onClick={() => setDeleteTarget(null)}>{t("common.cancel")}</Button>
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
