"use client";

import { useState, useCallback, useMemo } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Badge from "@cloudscape-design/components/badge";
import Modal from "@cloudscape-design/components/modal";
import Form from "@cloudscape-design/components/form";
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
import type { AlertRule, Severity } from "@/lib/types";

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
  flapWindow: "300",
};

// ─── Alert Rules Page ─────────────────────────────────

export default function AlertRulesPage() {
  const { t } = useI18n();
  const { addNotification } = useNotifications();
  const { data, loading, refetch } = useApi<AlertRule[]>("/api/alert-rules");

  const SEVERITY_OPTIONS: SelectProps.Option[] = useMemo(() => [
    { value: "critical", label: t("severity.critical") },
    { value: "high", label: t("severity.high") },
    { value: "medium", label: t("severity.medium") },
    { value: "low", label: t("severity.low") },
  ], [t]);

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
          <Box variant="strong">{t("page.alertRules")}</Box>
        </Box>
      ),
      noMatch: (
        <Box textAlign="center" color="inherit">
          <Box variant="strong">{t("page.alertRules")}</Box>
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
    });
    setModalVisible(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name || !form.metricName || !form.operator || !form.threshold || !form.severity) return;
    setSubmitting(true);
    try {
      const body = {
        name: form.name,
        metricName: form.metricName,
        operator: form.operator.value,
        threshold: Number(form.threshold),
        severity: form.severity.value,
        deviceId: form.deviceId || undefined,
        groupId: form.groupId || undefined,
        enabled: form.enabled,
        flapThreshold: Number(form.flapThreshold),
        flapWindow: Number(form.flapWindow),
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
    } catch {
      addNotification({ type: "error", content: editingRule ? t("alertRule.updated") : t("alertRule.created") });
    } finally {
      setSubmitting(false);
    }
  }, [form, editingRule, addNotification, refetch]);

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
  }, [deleteTarget, addNotification, refetch]);

  const handleToggleEnabled = useCallback(async (rule: AlertRule) => {
    try {
      await apiPut(`/api/alert-rules/${rule.id}`, { enabled: !rule.enabled });
      refetch();
    } catch {
      addNotification({ type: "error", content: t("alertRule.updated") });
    }
  }, [addNotification, refetch]);

  return (
    <ContentLayout header={<Header variant="h1">{t("page.alertRules")}</Header>}>
      <Table
        {...collectionProps}
        items={items}
        loading={loading}
        loadingText={t("page.alertRules")}
        variant="full-page"
        stickyHeader
        header={
          <Header
            counter={`(${rules.length})`}
            actions={
              <Button variant="primary" onClick={openCreate}>{t("alertRule.createRule")}</Button>
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
            cell: (item) => item.metricName,
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
            cell: (item) => item.deviceId ?? item.groupId ?? "All",
            width: 150,
          },
          {
            id: "enabled",
            header: t("alertRule.enabled"),
            cell: (item) => (
              <Toggle
                checked={item.enabled}
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
                <Button variant="inline-link" onClick={() => openEdit(item)}>{t("common.save")}</Button>
                <Button variant="inline-link" onClick={() => setDeleteTarget(item)}>{t("common.delete")}</Button>
              </SpaceBetween>
            ),
            width: 150,
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit" padding="l">
            <SpaceBetween size="m">
              <Box variant="strong">{t("page.alertRules")}</Box>
              <Box variant="p" color="inherit">{t("alertRule.createRule")}</Box>
              <Button variant="primary" onClick={openCreate}>{t("alertRule.createRule")}</Button>
            </SpaceBetween>
          </Box>
        }
      />

      {/* Create / Edit Modal */}
      <Modal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        header={editingRule ? t("alertRule.createRule") : t("alertRule.createRule")}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setModalVisible(false)}>{t("common.cancel")}</Button>
              <Button variant="primary" loading={submitting} onClick={handleSubmit}>
                {editingRule ? t("common.save") : t("common.create")}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Form>
          <SpaceBetween size="m">
            <FormField label={t("alertRule.name")}>
              <Input
                value={form.name}
                onChange={({ detail }) => setForm((f) => ({ ...f, name: detail.value }))}
              />
            </FormField>
            <FormField label={t("alertRule.metric")}>
              <Input
                value={form.metricName}
                onChange={({ detail }) => setForm((f) => ({ ...f, metricName: detail.value }))}
              />
            </FormField>
            <SpaceBetween direction="horizontal" size="m">
              <FormField label={t("alertRule.operator")}>
                <Select
                  selectedOption={form.operator}
                  onChange={({ detail }) => setForm((f) => ({ ...f, operator: detail.selectedOption }))}
                  options={OPERATOR_OPTIONS}
                />
              </FormField>
              <FormField label={t("alertRule.threshold")}>
                <Input
                  type="number"
                  value={form.threshold}
                  onChange={({ detail }) => setForm((f) => ({ ...f, threshold: detail.value }))}
                />
              </FormField>
            </SpaceBetween>
            <FormField label={t("alertRule.severity")}>
              <Select
                selectedOption={form.severity}
                onChange={({ detail }) => setForm((f) => ({ ...f, severity: detail.selectedOption }))}
                options={SEVERITY_OPTIONS}
              />
            </FormField>
            <FormField label={t("alertRule.device")}>
              <Input
                value={form.deviceId}
                onChange={({ detail }) => setForm((f) => ({ ...f, deviceId: detail.value }))}
              />
            </FormField>
            <FormField label={t("alertRule.enabled")}>
              <Toggle
                checked={form.enabled}
                onChange={({ detail }) => setForm((f) => ({ ...f, enabled: detail.checked }))}
              />
            </FormField>
            <SpaceBetween direction="horizontal" size="m">
              <FormField label={t("alertRule.flapThreshold")}>
                <Input
                  type="number"
                  value={form.flapThreshold}
                  onChange={({ detail }) => setForm((f) => ({ ...f, flapThreshold: detail.value }))}
                />
              </FormField>
              <FormField label={t("alertRule.flapWindow")}>
                <Input
                  type="number"
                  value={form.flapWindow}
                  onChange={({ detail }) => setForm((f) => ({ ...f, flapWindow: detail.value }))}
                />
              </FormField>
            </SpaceBetween>
          </SpaceBetween>
        </Form>
      </Modal>

      {/* Delete Confirmation */}
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
    </ContentLayout>
  );
}
