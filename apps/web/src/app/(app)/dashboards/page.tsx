"use client";

import { useState, useCallback } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
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
  const { addNotification } = useNotifications();
  const { data, loading, refetch } = useApi<{ data: Dashboard[] }>("/api/dashboards");

  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formShared, setFormShared] = useState(false);
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
    setShowModal(true);
  }, []);

  const handleCreate = useCallback(async () => {
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
      addNotification({ type: "error", content: err instanceof Error ? err.message : "Failed to create dashboard." });
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
    <ContentLayout header={<Header variant="h1">{t("page.dashboards")}</Header>}>
      <Table
        {...collectionProps}
        items={items}
        loading={loading}
        loadingText="Loading dashboards..."
        variant="full-page"
        stickyHeader
        header={
          <Header
            variant="h2"
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
            cell: (item) => item.name,
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
                {item.isDefault ? "Yes" : "No"}
              </StatusIndicator>
            ),
            width: 100,
          },
          {
            id: "isShared",
            header: t("dashboards.isShared"),
            cell: (item) => (
              <StatusIndicator type={item.isShared ? "success" : "stopped"}>
                {item.isShared ? "Yes" : "No"}
              </StatusIndicator>
            ),
            width: 100,
          },
          {
            id: "createdAt",
            header: t("common.createdAt"),
            cell: (item) => new Date(item.createdAt).toLocaleDateString(),
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
                  loading={deleteLoading === item.id}
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
              <Box variant="strong">No dashboards</Box>
              <Box variant="p" color="inherit">Create a custom dashboard to visualize your network data.</Box>
              <Button variant="primary" onClick={openCreate}>{t("dashboards.createDashboard")}</Button>
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
        <Form>
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
                Make this dashboard visible to all users
              </Toggle>
            </FormField>
          </SpaceBetween>
        </Form>
      </Modal>
    </ContentLayout>
  );
}
