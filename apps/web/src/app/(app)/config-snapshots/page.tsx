"use client";
import { formatDateTime } from "@/lib/date-format";

import { useState, useCallback } from "react";
import Link from "@cloudscape-design/components/link";
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
import Select from "@cloudscape-design/components/select";
import { useAuth } from "@/lib/auth";
import { canOperate } from "@/lib/permissions";
import type { Device } from "@/lib/types";
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
  const { user } = useAuth();
  const { data: devices } = useApi<{ nodes: Device[] }>("/api/topology/graph");
  const deviceOptions = devices?.nodes.map(device => ({ value: device.id, label: `${device.name} (${device.ip})` })) ?? [];
  const [captureMode, setCaptureMode] = useState(false);
  const [captureCommand, setCaptureCommand] = useState("show running-config");
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
  const [formError, setFormError] = useState("");
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
    setFormError("");
    if (!createDeviceId) { setFormError(t("Select a device.")); return; }
    if (captureMode ? !captureCommand.trim() : !createConfigText.trim()) { setFormError(t("Enter configuration text or a capture command.")); return; }
    setSaving(true);
    try {
      await apiPost(captureMode ? "/api/config-snapshots/capture" : "/api/config-snapshots", captureMode ? { deviceId: createDeviceId, command: captureCommand } : { deviceId: createDeviceId, configText: createConfigText });
      addNotification({ type: "success", content: t("configSnapshot.created") });
      setShowCreateModal(false);
      setCreateDeviceId("");
      setCreateConfigText("");
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("Failed to create snapshot."));
    } finally {
      setSaving(false);
    }
  }, [createDeviceId, createConfigText, captureMode, captureCommand, addNotification, refetch, t]);

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
    <>
      <Table
        {...collectionProps}
        items={items}
        loading={loading}
        loadingText={t("Loading config snapshots...")}
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
          <Header variant="awsui-h1-sticky"
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
                <Button disabled={!canOperate(user)} onClick={() => { setCaptureMode(true); setFormError(""); setShowCreateModal(true); }}>{t("Capture via SSH")}</Button>
                <Button disabled={!canOperate(user)} variant="primary" onClick={() => { setCaptureMode(false); setFormError(""); setShowCreateModal(true); }}>
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
            cell: (item) => <Link href={`/devices/${item.deviceId}`}>{devices?.nodes.find(device => device.id === item.deviceId)?.name ?? t("Device")}</Link>,
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
            header: t("Diff Preview"),
            cell: (item) => item.diff === "Initial snapshot" ? t("Initial snapshot") : item.diff ? item.diff.slice(0, 80) + (item.diff.length > 80 ? "…" : "") : "—",
            width: 300,
          },
          {
            id: "capturedAt",
            header: t("configSnapshot.capturedAt"),
            cell: (item) => formatDateTime(new Date(item.capturedAt)),
            sortingField: "capturedAt",
            width: 200,
          },
          {
            id: "actions",
            header: t("common.actions"),
            cell: (item) => (
              <Button
                variant="inline-link"
                disabled={!canOperate(user)} loading={deleteLoading === item.id}
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
              <Box variant="strong">{t("No config snapshots")}</Box>
              <Box variant="p" color="inherit">{t("Create a snapshot to track device configuration changes.")}</Box>


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
        <Form errorText={formError}>
          <SpaceBetween size="m">
            <FormField label={t("configSnapshot.device")}>
              <Select filteringType="auto" options={deviceOptions} selectedOption={deviceOptions.find(option => option.value === createDeviceId) ?? null} onChange={({ detail }) => setCreateDeviceId(detail.selectedOption.value ?? "")} />
            </FormField>
            {captureMode ? <FormField label={t("Configuration command")}><Input value={captureCommand} onChange={({ detail }) => setCaptureCommand(detail.value)} /></FormField> : <FormField label={t("configSnapshot.configText")}>
              <Textarea
                value={createConfigText}
                onChange={({ detail }) => setCreateConfigText(detail.value)}
                rows={12}
                placeholder={t("Paste device configuration here")}
              />
            </FormField>}
          </SpaceBetween>
        </Form>
      </Modal>

      <Modal
        visible={showDetailModal}
        onDismiss={() => setShowDetailModal(false)}
        header={t("Snapshot details")}
        size="large"
        footer={
          <Box float="right">
            <Button variant="link" onClick={() => setShowDetailModal(false)}>{t("Close")}</Button>
          </Box>
        }
      >
        {selectedSnapshot && (
          <SpaceBetween size="m">
            <Box variant="awsui-key-label">{t("configSnapshot.device")}</Box>
            <Link href={`/devices/${selectedSnapshot.deviceId}`}>{devices?.nodes.find(device => device.id === selectedSnapshot.deviceId)?.name ?? t("Device")}</Link>
            <Box variant="awsui-key-label">{t("configSnapshot.hash")}</Box>
            <Box variant="p">{selectedSnapshot.hash}</Box>
            <Box variant="awsui-key-label">{t("configSnapshot.capturedAt")}</Box>
            <Box variant="p">{formatDateTime(new Date(selectedSnapshot.capturedAt))}</Box>
            <Box variant="awsui-key-label">{t("configSnapshot.configText")}</Box>
            <Textarea readOnly rows={14} value={selectedSnapshot.configText} />
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
            <Button variant="link" onClick={() => setShowDiffModal(false)}>{t("Close")}</Button>
          </Box>
        }
      >
        {diffResult && (
          <SpaceBetween size="m">
            <Box variant="p">{t("configSnapshot.unchanged")}: {diffResult.unchanged}</Box>
            {diffResult.added.length > 0 && (
              <div>
                <Box variant="awsui-key-label">{t("configSnapshot.added")}</Box>
                <Textarea readOnly rows={6} value={diffResult.added.map(line => "+ " + line).join("\n")} />
              </div>
            )}
            {diffResult.removed.length > 0 && (
              <div>
                <Box variant="awsui-key-label">{t("configSnapshot.removed")}</Box>
                <Textarea readOnly rows={6} value={diffResult.removed.map(line => "- " + line).join("\n")} />
              </div>
            )}
            {diffResult.added.length === 0 && diffResult.removed.length === 0 && (
              <Box textAlign="center" color="text-status-inactive">
                {t("No differences found between the two snapshots.")}</Box>
            )}
          </SpaceBetween>
        )}
      </Modal>
    </>
  );
}
