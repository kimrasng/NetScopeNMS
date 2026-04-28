"use client";

import { useState, useCallback } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Button from "@cloudscape-design/components/button";
import Box from "@cloudscape-design/components/box";
import Modal from "@cloudscape-design/components/modal";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import DatePicker from "@cloudscape-design/components/date-picker";
import Form from "@cloudscape-design/components/form";
import Alert from "@cloudscape-design/components/alert";
import Pagination from "@cloudscape-design/components/pagination";
import TextFilter from "@cloudscape-design/components/text-filter";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { useApi } from "@/hooks/use-api";
import { useNotifications } from "@/hooks/use-notifications";
import { useI18n } from "@/lib/i18n";
import { apiPost, apiDelete } from "@/lib/api";
import type { ApiKey } from "@/lib/types";

interface CreateKeyResponse {
  apiKey: ApiKey;
  rawKey: string;
}

export default function ApiKeysPage() {
  const { t } = useI18n();
  const { data, loading, refetch } = useApi<{ data: ApiKey[] }>("/api/api-keys");
  const { addNotification } = useNotifications();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const keys = data?.data ?? [];

  const { items, collectionProps, filterProps, paginationProps } = useCollection(keys, {
    filtering: {
      empty: <Box textAlign="center" color="inherit">No API keys</Box>,
      noMatch: <Box textAlign="center" color="inherit">No matching keys</Box>,
    },
    pagination: { pageSize: 20 },
    sorting: { defaultState: { sortingColumn: { sortingField: "createdAt" }, isDescending: true } },
  });

  const handleCreate = useCallback(async () => {
    if (!keyName.trim()) return;
    setCreateLoading(true);
    try {
      const result = await apiPost<CreateKeyResponse>("/api/api-keys", {
        name: keyName.trim(),
        expiresAt: expiresAt || undefined,
      });
      setRawKey(result.rawKey);
      addNotification({ type: "success", content: t("apiKey.created") });
    } catch (err) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : "Failed to create API key." });
    } finally {
      setCreateLoading(false);
    }
  }, [keyName, expiresAt, addNotification, t]);

  const handleDelete = useCallback(async (id: string) => {
    setDeleteLoading(id);
    try {
      await apiDelete(`/api/api-keys/${id}`);
      addNotification({ type: "success", content: t("apiKey.deleted") });
      refetch();
    } catch (err) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : "Failed to revoke key." });
    } finally {
      setDeleteLoading(null);
    }
  }, [addNotification, refetch, t]);

  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false);
    setKeyName("");
    setExpiresAt("");
    if (rawKey) refetch();
    setRawKey(null);
  }, [rawKey, refetch]);

  return (
    <ContentLayout header={<Header variant="h1">{t("page.apiKeys")}</Header>}>
      <Table
        {...collectionProps}
        items={items}
        loading={loading}
        loadingText="Loading API keys..."
        variant="full-page"
        stickyHeader
        header={
          <Header
            variant="h2"
            counter={keys.length ? `(${keys.length})` : undefined}
            actions={
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                {t("apiKey.createKey")}
              </Button>
            }
          >
            {t("page.apiKeys")}
          </Header>
        }
        filter={<TextFilter {...filterProps} filteringPlaceholder="Find keys" />}
        pagination={<Pagination {...paginationProps} />}
        columnDefinitions={[
          {
            id: "name",
            header: t("apiKey.name"),
            cell: (item) => item.name,
            sortingField: "name",
            width: 200,
          },
          {
            id: "prefix",
            header: t("apiKey.prefix"),
            cell: (item) => <Box variant="code">{item.prefix}...</Box>,
            width: 160,
          },
          {
            id: "lastUsed",
            header: t("apiKey.lastUsed"),
            cell: (item) => item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString() : "Never",
            sortingField: "lastUsedAt",
            width: 180,
          },
          {
            id: "expires",
            header: t("apiKey.expiresAt"),
            cell: (item) => item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : "Never",
            sortingField: "expiresAt",
            width: 140,
          },
          {
            id: "created",
            header: t("common.createdAt"),
            cell: (item) => new Date(item.createdAt).toLocaleDateString(),
            sortingField: "createdAt",
            width: 120,
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
          <Box textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No API keys</b>
              <Box variant="p" color="inherit">Create an API key to get started.</Box>
            </SpaceBetween>
          </Box>
        }
      />

      <Modal
        visible={showCreateModal}
        onDismiss={closeCreateModal}
        header={t("apiKey.createKey")}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={closeCreateModal}>
                {rawKey ? "Done" : t("common.cancel")}
              </Button>
              {!rawKey && (
                <Button
                  variant="primary"
                  loading={createLoading}
                  disabled={!keyName.trim()}
                  onClick={handleCreate}
                >
                  {t("common.create")}
                </Button>
              )}
            </SpaceBetween>
          </Box>
        }
      >
        {rawKey ? (
          <SpaceBetween size="m">
            <Alert type="warning">
              {t("apiKey.copyWarning")}
            </Alert>
            <Box variant="code">{rawKey}</Box>
            <Button
              iconName="copy"
              variant="inline-link"
              onClick={() => {
                navigator.clipboard.writeText(rawKey);
                addNotification({ type: "success", content: "Copied to clipboard." });
              }}
            >
              Copy Key
            </Button>
          </SpaceBetween>
        ) : (
          <Form>
            <SpaceBetween size="m">
              <FormField label={t("apiKey.name")} description="A descriptive name for this API key.">
                <Input
                  value={keyName}
                  onChange={({ detail }) => setKeyName(detail.value)}
                  placeholder="My integration key"
                />
              </FormField>
              <FormField label={t("apiKey.expiresAt")} description="Optional. Leave blank for no expiration.">
                <DatePicker
                  value={expiresAt}
                  onChange={({ detail }) => setExpiresAt(detail.value)}
                  placeholder="YYYY/MM/DD"
                  isDateEnabled={(date) => date.getTime() > Date.now()}
                />
              </FormField>
            </SpaceBetween>
          </Form>
        )}
      </Modal>
    </ContentLayout>
  );
}
