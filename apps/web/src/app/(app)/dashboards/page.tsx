"use client";
import { formatDate } from "@/lib/date-format";

import { useState, useCallback } from "react";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import { useAuth } from "@/lib/auth";
import Table from "@cloudscape-design/components/table";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
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
import { apiPost, apiDelete } from "@/lib/api";
import type { Dashboard } from "@/lib/types";

export default function DashboardsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { data, loading, refetch } = useApi<{ data: Dashboard[] }>("/api/dashboards");

  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formShared, setFormShared] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [duplicateLoading, setDuplicateLoading] = useState<string | null>(null);

  const dashboards = data?.data ?? [];

  const { items, collectionProps } = useCollection(dashboards, {
    sorting: { defaultState: { sortingColumn: { sortingField: "name" } } },
  });

  const openCreate = useCallback(() => {
    setFormName("");
    setFormDescription("");
    setFormShared(false);
    setFormError(""); setShowModal(true);
  }, []);

  const handleCreate = useCallback(async () => {
    setFormError("");
    if (!formName.trim()) { setFormError(t("Name is required.")); return; }
    setSaving(true);
    try {
      await apiPost("/api/dashboards", {
        name: formName,
        description: formDescription || undefined,
        isShared: formShared,
      });
      addNotification({ type: "success", content: t("dashboards.created") });
      setShowModal(false);
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("Failed to create dashboard."));
    } finally {
      setSaving(false);
    }
  }, [formName, formDescription, formShared, addNotification, refetch, t]);

  const handleDelete = useCallback(async (id: string) => {
    setDeleteLoading(id);
    try {
      await apiDelete(`/api/dashboards/${id}`);
      addNotification({ type: "success", content: t("dashboards.deleted") });
      refetch();
    } catch (err) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : "Failed to delete dashboard." });
    } finally {
      setDeleteLoading(null);
    }
  }, [addNotification, refetch, t]);

  const handleDuplicate = useCallback(async (id: string) => {
    setDuplicateLoading(id);
    try {
      await apiPost(`/api/dashboards/${id}/duplicate`);
      addNotification({ type: "success", content: t("dashboards.duplicated") });
      refetch();
    } catch (err) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : "Failed to duplicate dashboard." });
    } finally {
      setDuplicateLoading(null);
    }
  }, [addNotification, refetch, t]);

  return (
    <>
      <Table
        {...collectionProps}
        items={items}
        loading={loading}
        loadingText={t("Loading dashboards...")}
        variant="full-page"
        stickyHeader
        header={
          <Header variant="awsui-h1-sticky"
            counter={dashboards.length > 0 ? `(${dashboards.length})` : undefined}
            actions={
              <Button variant="primary" onClick={openCreate}>
                {t("dashboards.createDashboard")}
              </Button>
            }
          >
            {t("page.dashboards")}
          </Header>
        }
        columnDefinitions={[
          {
            id: "name",
            header: t("dashboards.name"),
            cell: (item) => <Link href={`/dashboards/${item.id}`}>{item.name}</Link>,
            sortingField: "name",
            width: 200,
          },
          {
            id: "description",
            header: t("common.description"),
            cell: (item) => item.description ?? "—",
            width: 300,
          },
          {
            id: "isDefault",
            header: t("dashboards.isDefault"),
            cell: (item) => (
              <StatusIndicator type={item.isDefault ? "success" : "stopped"}>
                {t(item.isDefault ? "Yes" : "No")}
              </StatusIndicator>
            ),
            width: 100,
          },
          {
            id: "isShared",
            header: t("dashboards.isShared"),
            cell: (item) => (
              <StatusIndicator type={item.isShared ? "success" : "stopped"}>
                {t(item.isShared ? "Yes" : "No")}
              </StatusIndicator>
            ),
            width: 100,
          },
          {
            id: "createdAt",
            header: t("common.createdAt"),
            cell: (item) => formatDate(new Date(item.createdAt)),
            sortingField: "createdAt",
            width: 130,
          },
          {
            id: "actions",
            header: t("common.actions"),
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="inline-link"
                  loading={duplicateLoading === item.id}
                  onClick={() => handleDuplicate(item.id)}
                >
                  {t("common.duplicate")}
                </Button>
                <Button
                  variant="inline-link"
                  disabled={item.userId !== user?.id} loading={deleteLoading === item.id}
                  onClick={() => handleDelete(item.id)}
                >
                  {t("common.delete")}
                </Button>
              </SpaceBetween>
            ),
            width: 180,
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit" padding="l">
            <SpaceBetween size="m">
              <Box variant="strong">{t("No dashboards")}</Box>
              <Box variant="p" color="inherit">{t("Create a custom dashboard to visualize your network data.")}</Box>

            </SpaceBetween>
          </Box>
        }
      />

      <Modal
        visible={showModal}
        onDismiss={() => setShowModal(false)}
        header={t("dashboards.createDashboard")}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowModal(false)}>{t("common.cancel")}</Button>
              <Button variant="primary" loading={saving} onClick={handleCreate}>{t("common.create")}</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Form errorText={formError}>
          <SpaceBetween size="m">
            <FormField label={t("dashboards.name")}>
              <Input
                value={formName}
                onChange={({ detail }) => setFormName(detail.value)}
              />
            </FormField>
            <FormField label={t("common.description")}>
              <Textarea
                value={formDescription}
                onChange={({ detail }) => setFormDescription(detail.value)}
              />
            </FormField>
            <FormField label={t("dashboards.isShared")}>
              <Toggle
                checked={formShared}
                onChange={({ detail }) => setFormShared(detail.checked)}
              >
                {t("Make this dashboard visible to all users")}</Toggle>
            </FormField>
          </SpaceBetween>
        </Form>
      </Modal>
    </>
  );
}
