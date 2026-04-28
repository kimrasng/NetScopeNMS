"use client";

import { useState, useCallback } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Button from "@cloudscape-design/components/button";
import Box from "@cloudscape-design/components/box";
import Badge from "@cloudscape-design/components/badge";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Modal from "@cloudscape-design/components/modal";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import Form from "@cloudscape-design/components/form";
import Pagination from "@cloudscape-design/components/pagination";
import TextFilter from "@cloudscape-design/components/text-filter";
import Tabs from "@cloudscape-design/components/tabs";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/hooks/use-notifications";
import { useI18n } from "@/lib/i18n";
import { apiPost, apiDelete } from "@/lib/api";
import type { User, Invitation } from "@/lib/types";

// ─── Constants ────────────────────────────────────────

const ROLE_OPTIONS = [
  { label: "Admin", value: "admin" },
  { label: "Operator", value: "operator" },
  { label: "Viewer", value: "viewer" },
];

const SCOPE_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Restricted", value: "restricted" },
];

const ROLE_COLORS: Record<string, "red" | "blue" | "grey" | "green"> = {
  super_admin: "red",
  admin: "blue",
  operator: "green",
  viewer: "grey",
};

function formatRole(role: string): string {
  return role.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Invitations Tab ──────────────────────────────────

function InvitationsTab() {
  const { t } = useI18n();
  const { data: invitations, loading } = useApi<Invitation[]>("/api/setup/invitations");

  const { items, collectionProps } = useCollection(invitations ?? [], {
    sorting: { defaultState: { sortingColumn: { sortingField: "createdAt" }, isDescending: true } },
  });

  return (
    <Table
      {...collectionProps}
      items={items}
      loading={loading}
      loadingText="Loading invitations..."
      header={
        <Header variant="h2" counter={invitations ? `(${invitations.length})` : undefined}>
          {t("users.invitations")}
        </Header>
      }
      columnDefinitions={[
        {
          id: "email",
          header: t("users.email"),
          cell: (item) => item.email ?? "Any",
          sortingField: "email",
          width: 200,
        },
        {
          id: "role",
          header: t("users.role"),
          cell: (item) => (
            <Badge color={ROLE_COLORS[item.role] ?? "grey"}>
              {formatRole(item.role)}
            </Badge>
          ),
          sortingField: "role",
          width: 130,
        },
        {
          id: "scope",
          header: t("users.scope"),
          cell: (item) => item.scope,
          width: 100,
        },
        {
          id: "token",
          header: "Token",
          cell: (item) => item.token.slice(0, 8) + "…",
          width: 120,
        },
        {
          id: "expiresAt",
          header: "Expires At",
          cell: (item) => new Date(item.expiresAt).toLocaleString(),
          sortingField: "expiresAt",
          width: 180,
        },
        {
          id: "usedAt",
          header: "Used At",
          cell: (item) => item.usedAt ? new Date(item.usedAt).toLocaleString() : "—",
          width: 180,
        },
      ]}
      empty={
        <Box textAlign="center" color="inherit">
          <SpaceBetween size="m">
            <b>No invitations</b>
            <Box variant="p" color="inherit">No pending invitations.</Box>
          </SpaceBetween>
        </Box>
      }
    />
  );
}

// ─── Users Page ───────────────────────────────────────

export default function UsersPage() {
  const { t } = useI18n();
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const { data: users, loading, refetch } = useApi<User[]>("/api/setup/users");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(ROLE_OPTIONS[2]);
  const [inviteScope, setInviteScope] = useState(SCOPE_OPTIONS[0]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const { items, collectionProps, filterProps, paginationProps } = useCollection(users ?? [], {
    filtering: {
      empty: <Box textAlign="center" color="inherit">No users</Box>,
      noMatch: <Box textAlign="center" color="inherit">No matching users</Box>,
    },
    pagination: { pageSize: 20 },
    sorting: { defaultState: { sortingColumn: { sortingField: "name" } } },
  });

  const handleInvite = useCallback(async () => {
    setInviteLoading(true);
    try {
      const result = await apiPost<Invitation>("/api/setup/invite", {
        email: inviteEmail || undefined,
        role: inviteRole.value,
        scope: inviteScope.value,
      });
      const url = `${window.location.origin}/invite/${result.token}`;
      setInviteUrl(url);
      addNotification({ type: "success", content: t("users.invited") });
    } catch (err) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : "Failed to create invitation." });
    } finally {
      setInviteLoading(false);
    }
  }, [inviteEmail, inviteRole, inviteScope, addNotification, t]);

  const handleDelete = useCallback(async (userId: string) => {
    setDeleteLoading(userId);
    try {
      await apiDelete(`/api/setup/users/${userId}`);
      addNotification({ type: "success", content: t("users.deleted") });
      refetch();
    } catch (err) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : "Failed to delete user." });
    } finally {
      setDeleteLoading(null);
    }
  }, [addNotification, refetch, t]);

  const closeInviteModal = useCallback(() => {
    setShowInviteModal(false);
    setInviteEmail("");
    setInviteRole(ROLE_OPTIONS[2]);
    setInviteScope(SCOPE_OPTIONS[0]);
    setInviteUrl(null);
    if (inviteUrl) refetch();
  }, [inviteUrl, refetch]);

  return (
    <ContentLayout header={<Header variant="h1">{t("page.users")}</Header>}>
      <Tabs
        tabs={[
          {
            label: t("page.users"),
            id: "users",
            content: (
              <Table
                {...collectionProps}
                items={items}
                loading={loading}
                loadingText="Loading users..."
                stickyHeader
                header={
                  <Header
                    variant="h2"
                    counter={users ? `(${users.length})` : undefined}
                    actions={
                      <Button variant="primary" onClick={() => setShowInviteModal(true)}>
                        {t("users.inviteUser")}
                      </Button>
                    }
                  >
                    {t("page.users")}
                  </Header>
                }
                filter={<TextFilter {...filterProps} filteringPlaceholder="Find users" />}
                pagination={<Pagination {...paginationProps} />}
                columnDefinitions={[
                  {
                    id: "name",
                    header: t("users.name"),
                    cell: (item) => item.name,
                    sortingField: "name",
                    width: 180,
                  },
                  {
                    id: "email",
                    header: t("users.email"),
                    cell: (item) => item.email,
                    sortingField: "email",
                    width: 220,
                  },
                  {
                    id: "role",
                    header: t("users.role"),
                    cell: (item) => (
                      <Badge color={ROLE_COLORS[item.role] ?? "grey"}>
                        {formatRole(item.role)}
                      </Badge>
                    ),
                    sortingField: "role",
                    width: 130,
                  },
                  {
                    id: "scope",
                    header: t("users.scope"),
                    cell: (item) => item.scope,
                    width: 100,
                  },
                  {
                    id: "enabled",
                    header: t("users.enabled"),
                    cell: (item) => (
                      <StatusIndicator type={item.enabled ? "success" : "stopped"}>
                        {item.enabled ? "Yes" : "No"}
                      </StatusIndicator>
                    ),
                    width: 100,
                  },
                  {
                    id: "lastLogin",
                    header: t("users.lastLogin"),
                    cell: (item) => item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : "—",
                    sortingField: "lastLoginAt",
                    width: 180,
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
                    cell: (item) =>
                      currentUser?.role === "super_admin" && item.id !== currentUser.id ? (
                        <Button
                          variant="inline-link"
                          loading={deleteLoading === item.id}
                          onClick={() => handleDelete(item.id)}
                        >
                          {t("common.delete")}
                        </Button>
                      ) : null,
                    width: 100,
                  },
                ]}
                empty={
                  <Box textAlign="center" color="inherit">
                    <SpaceBetween size="m">
                      <b>No users</b>
                      <Box variant="p" color="inherit">Invite users to get started.</Box>
                    </SpaceBetween>
                  </Box>
                }
              />
            ),
          },
          {
            label: t("users.invitations"),
            id: "invitations",
            content: <InvitationsTab />,
          },
        ]}
      />

      <Modal
        visible={showInviteModal}
        onDismiss={closeInviteModal}
        header={t("users.inviteUser")}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={closeInviteModal}>{t("common.cancel")}</Button>
              {!inviteUrl && (
                <Button variant="primary" loading={inviteLoading} onClick={handleInvite}>
                  {t("common.create")}
                </Button>
              )}
            </SpaceBetween>
          </Box>
        }
      >
        {inviteUrl ? (
          <SpaceBetween size="m">
            <Box variant="p">{t("users.inviteUrl")}</Box>
            <Box variant="code">{inviteUrl}</Box>
            <Button
              iconName="copy"
              variant="inline-link"
              onClick={() => {
                navigator.clipboard.writeText(inviteUrl);
                addNotification({ type: "success", content: "Copied to clipboard." });
              }}
            >
              Copy Link
            </Button>
          </SpaceBetween>
        ) : (
          <Form>
            <SpaceBetween size="m">
              <FormField label={t("users.email")} description="Optional. Leave blank for a generic invite link.">
                <Input
                  value={inviteEmail}
                  onChange={({ detail }) => setInviteEmail(detail.value)}
                  placeholder="user@example.com"
                  type="email"
                />
              </FormField>
              <FormField label={t("users.role")}>
                <Select
                  selectedOption={inviteRole}
                  onChange={({ detail }) => setInviteRole(detail.selectedOption as typeof inviteRole)}
                  options={ROLE_OPTIONS}
                  placeholder={t("users.selectRole")}
                />
              </FormField>
              <FormField label={t("users.scope")}>
                <Select
                  selectedOption={inviteScope}
                  onChange={({ detail }) => setInviteScope(detail.selectedOption as typeof inviteScope)}
                  options={SCOPE_OPTIONS}
                  placeholder={t("users.selectScope")}
                />
              </FormField>
            </SpaceBetween>
          </Form>
        )}
      </Modal>
    </ContentLayout>
  );
}
