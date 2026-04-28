"use client";

import { useState, useCallback } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Pagination from "@cloudscape-design/components/pagination";
import Modal from "@cloudscape-design/components/modal";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Textarea from "@cloudscape-design/components/textarea";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { useApi } from "@/hooks/use-api";
import { useNotifications } from "@/hooks/use-notifications";
import { useI18n } from "@/lib/i18n";
import { apiPost, apiDelete, apiGet } from "@/lib/api";
import type { ConfigSnapshot, PaginatedResponse } from "@/lib/types";

interface DiffResult {
  added: string[];
  removed: string[];
  unchanged: number;
}

export default function ConfigSnapshotsPage() {
  const { t } = useI18n();
  const { addNotification } = useNotifications();
  const [page, setPage] = useState(1);
  const { data, loading, refetch } = useApi<PaginatedResponse<ConfigSnapshot>>(
    "/api/config-snapshots",
    { page, limit: 50 },
  );

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<ConfigSnapshot | null>(null);
  const [createDeviceId, setCreateDeviceId] = useState("");
  const [createConfigText, setCreateConfigText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<ConfigSnapshot[]>([]);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const snapshots = data?.data ?? [];

  const { items, collectionProps } = useCollection(snapshots, {
    sorting: { defaultState: { sortingColumn: { sortingField: "capturedAt" }, isDescending: true } },
  });

  const handleCreate = useCallback(async () => {
    setSaving(true);
    try {
      await apiPost("/api/config-snapshots", {
        deviceId: createDeviceId,
        configText: createConfigText,
      });
      addNotification({ type: "success", content: t("configSnapshot.created") });
      setShowCreateModal(false);
      setCreateDeviceId("");
      setCreateConfigText("");
      refetch();
    } catch (err) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : "Failed to create snapshot." });
    } finally {
      setSaving(false);
    }
  }, [createDeviceId, createConfigText, addNotification, refetch, t]);

  const handleDelete = useCallback(async (id: string) => {
    setDeleteLoading(id);
    try {
      await apiDelete(`/api/config-snapshots/${id}`);
      addNotification({ type: "success", content: t("configSnapshot.deleted") });
      refetch();
    } catch (err) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : "Failed to delete snapshot." });
    } finally {
      setDeleteLoading(null);
    }
  }, [addNotification, refetch, t]);

  const handleRowClick = useCallback((snapshot: ConfigSnapshot) => {
    setSelectedSnapshot(snapshot);
    setShowDetailModal(true);
  }, []);

  const handleCompare = useCallback(async () => {
    if (selectedItems.length !== 2) return;
    setDiffLoading(true);
    setDiffResult(null);
    try {
      const res = await apiGet<DiffResult>(`/api/config-snapshots/${selectedItems[0].id}/diff/${selectedItems[1].id}`);
      setDiffResult(res);
      setShowDiffModal(true);
    } catch (err) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : "Failed to compare snapshots." });
    } finally {
      setDiffLoading(false);
    }
  }, [selectedItems, addNotification]);

  return (
    <ContentLayout header={<Header variant="h1">{t("page.configSnapshots")}</Header>}>
      <Table
        {...collectionProps}
        items={items}
        loading={loading}
        loadingText="Loading config snapshots..."
        variant="full-page"
        stickyHeader
        selectionType="multi"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => {
          if (detail.selectedItems.length <= 2) {
            setSelectedItems(detail.selectedItems);
          }
        }}
        onRowClick={({ detail }) => handleRowClick(detail.item)}
        header={
          <Header
            variant="h2"
            counter={data ? `(${data.pagination.total})` : undefined}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  disabled={selectedItems.length !== 2}
                  loading={diffLoading}
                  onClick={handleCompare}
                >
                  {t("configSnapshot.compare")}
                </Button>
                <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                  {t("configSnapshot.createSnapshot")}
                </Button>
              </SpaceBetween>
            }
          >
            {t("page.configSnapshots")}
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
            id: "deviceId",
            header: t("configSnapshot.device"),
            cell: (item) => item.deviceId,
            sortingField: "deviceId",
            width: 280,
          },
          {
            id: "hash",
            header: t("configSnapshot.hash"),
            cell: (item) => item.hash.slice(0, 12) + "…",
            width: 150,
          },
          {
            id: "diff",
            header: "Diff Preview",
            cell: (item) => item.diff ? item.diff.slice(0, 80) + (item.diff.length > 80 ? "…" : "") : "—",
            width: 300,
          },
          {
            id: "capturedAt",
            header: t("configSnapshot.capturedAt"),
            cell: (item) => new Date(item.capturedAt).toLocaleString(),
            sortingField: "capturedAt",
            width: 200,
          },
          {
            id: "actions",
            header: t("common.actions"),
            cell: (item) => (
              <Button
                variant="inline-link"
                loading={deleteLoading === item.id}
                onClick={() => handleDelete(item.id)}
              >
                {t("common.delete")}
              </Button>
            ),
            width: 100,
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit" padding="l">
            <SpaceBetween size="m">
              <Box variant="strong">No config snapshots</Box>
              <Box variant="p" color="inherit">Create a snapshot to track device configuration changes.</Box>
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>{t("configSnapshot.createSnapshot")}</Button>
            </SpaceBetween>
          </Box>
        }
      />

      <Modal
        visible={showCreateModal}
        onDismiss={() => setShowCreateModal(false)}
        header={t("configSnapshot.createSnapshot")}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowCreateModal(false)}>{t("common.cancel")}</Button>
              <Button variant="primary" loading={saving} onClick={handleCreate}>{t("common.create")}</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Form>
          <SpaceBetween size="m">
            <FormField label={t("configSnapshot.device")}>
              <Input
                value={createDeviceId}
                onChange={({ detail }) => setCreateDeviceId(detail.value)}
                placeholder="Enter device ID"
              />
            </FormField>
            <FormField label={t("configSnapshot.configText")}>
              <Textarea
                value={createConfigText}
                onChange={({ detail }) => setCreateConfigText(detail.value)}
                rows={12}
                placeholder="Paste device configuration here"
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </Modal>

      <Modal
        visible={showDetailModal}
        onDismiss={() => setShowDetailModal(false)}
        header="Config Snapshot Detail"
        size="large"
        footer={
          <Box float="right">
            <Button variant="link" onClick={() => setShowDetailModal(false)}>Close</Button>
          </Box>
        }
      >
        {selectedSnapshot && (
          <SpaceBetween size="m">
            <Box variant="awsui-key-label">{t("configSnapshot.device")}</Box>
            <Box variant="p">{selectedSnapshot.deviceId}</Box>
            <Box variant="awsui-key-label">{t("configSnapshot.hash")}</Box>
            <Box variant="p">{selectedSnapshot.hash}</Box>
            <Box variant="awsui-key-label">{t("configSnapshot.capturedAt")}</Box>
            <Box variant="p">{new Date(selectedSnapshot.capturedAt).toLocaleString()}</Box>
            <Box variant="awsui-key-label">{t("configSnapshot.configText")}</Box>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                background: "var(--color-background-container-content, #fafafa)",
                border: "1px solid var(--color-border-divider-default, #e9ebed)",
                borderRadius: 8,
                padding: 16,
                maxHeight: 500,
                overflowY: "auto",
              }}
            >
              {selectedSnapshot.configText}
            </div>
          </SpaceBetween>
        )}
      </Modal>

      <Modal
        visible={showDiffModal}
        onDismiss={() => setShowDiffModal(false)}
        header={t("configSnapshot.diffResult")}
        size="large"
        footer={
          <Box float="right">
            <Button variant="link" onClick={() => setShowDiffModal(false)}>Close</Button>
          </Box>
        }
      >
        {diffResult && (
          <SpaceBetween size="m">
            <Box variant="p">{t("configSnapshot.unchanged")}: {diffResult.unchanged}</Box>
            {diffResult.added.length > 0 && (
              <div>
                <Box variant="awsui-key-label">{t("configSnapshot.added")}</Box>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 13,
                    whiteSpace: "pre-wrap",
                    background: "#e6ffec",
                    border: "1px solid #abf2bc",
                    borderRadius: 8,
                    padding: 16,
                    maxHeight: 250,
                    overflowY: "auto",
                  }}
                >
                  {diffResult.added.map((line, i) => (
                    <div key={i}>+ {line}</div>
                  ))}
                </div>
              </div>
            )}
            {diffResult.removed.length > 0 && (
              <div>
                <Box variant="awsui-key-label">{t("configSnapshot.removed")}</Box>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 13,
                    whiteSpace: "pre-wrap",
                    background: "#ffebe9",
                    border: "1px solid #ffcecb",
                    borderRadius: 8,
                    padding: 16,
                    maxHeight: 250,
                    overflowY: "auto",
                  }}
                >
                  {diffResult.removed.map((line, i) => (
                    <div key={i}>- {line}</div>
                  ))}
                </div>
              </div>
            )}
            {diffResult.added.length === 0 && diffResult.removed.length === 0 && (
              <Box textAlign="center" color="text-status-inactive">
                No differences found between the two snapshots.
              </Box>
            )}
          </SpaceBetween>
        )}
      </Modal>
    </ContentLayout>
  );
}
