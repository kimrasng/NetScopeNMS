"use client";
import { formatDateTime, formatDate } from "@/lib/date-format";

import { useState, useCallback } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Alert from "@cloudscape-design/components/alert";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Button from "@cloudscape-design/components/button";
import Box from "@cloudscape-design/components/box";
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
import { apiPost, apiDelete, apiPut } from "@/lib/api";
import { ResourceScopeFields } from "@/components/common/resource-scope-fields";
import Toggle from "@cloudscape-design/components/toggle";
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
      loadingText={t("Loading invitations...")}
      header={
        <Header variant="h2" counter={invitations ? `(${invitations.length})` : undefined}>
          {t("users.invitations")}
        </Header>
      }
      columnDefinitions={[
        {
          id: "email",
          header: t("users.email"),
          cell: (item) => item.email ?? t("Any email address"),
          sortingField: "email",
          width: 200,
          minWidth: 200,
        },
        {
          id: "role",
          header: t("users.role"),
          cell: (item) => t(`role.${item.role}`),
          sortingField: "role",
          width: 160,
          minWidth: 140,
        },
        {
          id: "scope",
          header: t("users.scope"),
          cell: (item) => t(`scope.${item.scope}`),
          width: 170,
          minWidth: 170,
        },
        {
          id: "token",
          header: t("Token"),
          cell: (item) => item.token.slice(0, 8) + "…",
          width: 120,
          minWidth: 120,
        },
        {
          id: "expiresAt",
          header: t("Expires At"),
          cell: (item) => formatDateTime(new Date(item.expiresAt)),
          sortingField: "expiresAt",
          width: 180,
          minWidth: 180,
        },
        {
          id: "usedAt",
          header: t("Used At"),
          cell: (item) => item.usedAt ? formatDateTime(new Date(item.usedAt)) : "—",
          width: 180,
          minWidth: 180,
        },
      ]}
      empty={
        <Box textAlign="center" color="inherit">
          <SpaceBetween size="m">
            <b>{t("No invitations")}</b>
            <Box variant="p" color="inherit">{t("No pending invitations.")}</Box>
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
  const [allowedDevices, setAllowedDevices] = useState<string[]>([]);
  const [allowedGroups, setAllowedGroups] = useState<string[]>([]);
  const [editing, setEditing] = useState<User | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const { items, collectionProps, filterProps, paginationProps } = useCollection(users ?? [], {
    filtering: {
      empty: <Box textAlign="center" color="inherit">{t("No users")}</Box>,
      noMatch: <Box textAlign="center" color="inherit">{t("No matching users")}</Box>,
    },
    pagination: { pageSize: 20 },
    sorting: { defaultState: { sortingColumn: { sortingField: "name" } } },
  });

  const handleInvite = useCallback(async () => {
    setFormError("");
    if (inviteEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) { setFormError(t("Enter a valid email address.")); return; }
    setInviteLoading(true);
    try {
      const result = await apiPost<{ invitation: Invitation; inviteUrl: string }>("/api/setup/invite", {
        email: inviteEmail || undefined,
        role: inviteRole.value,
        scope: inviteScope.value,
        allowedDeviceIds: allowedDevices,
        allowedGroupIds: allowedGroups,
      });
      const url = new URL(result.inviteUrl, window.location.origin).href;
      setInviteUrl(url);
      addNotification({ type: "success", content: t("users.invited") });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("Failed to create invitation."));
    } finally {
      setInviteLoading(false);
    }
  }, [inviteEmail, inviteRole, inviteScope, allowedDevices, allowedGroups, addNotification, t]);

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
    setAllowedDevices([]); setAllowedGroups([]);
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
                loadingText={t("Loading users...")}
                stickyHeader
                resizableColumns
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
                filter={<TextFilter {...filterProps} filteringPlaceholder={t("Find users")} />}
                pagination={<Pagination {...paginationProps} />}
                columnDefinitions={[
                  {
                    id: "name",
                    header: t("users.name"),
                    cell: (item) => item.name,
                    sortingField: "name",
                    width: 180,
                    minWidth: 180,
                  },
                  {
                    id: "email",
                    header: t("users.email"),
                    cell: (item) => item.email,
                    sortingField: "email",
                    width: 220,
                    minWidth: 220,
                  },
                  {
                    id: "role",
                    header: t("users.role"),
                    cell: (item) => t(`role.${item.role}`),
                    sortingField: "role",
                    width: 160,
                    minWidth: 140,
                  },
                  {
                    id: "scope",
                    header: t("users.scope"),
                    cell: (item) => t(`scope.${item.scope}`),
                    width: 170,
                    minWidth: 170,
                  },
                  {
                    id: "enabled",
                    header: t("users.enabled"),
                    cell: (item) => (
                      <StatusIndicator type={item.enabled ? "success" : "stopped"}>
                        {t(item.enabled ? "common.enabled" : "common.disabled")}
                      </StatusIndicator>
                    ),
                    width: 100,
                    minWidth: 100,
                  },
                  {
                    id: "lastLogin",
                    header: t("users.lastLogin"),
                    cell: (item) => item.lastLoginAt ? formatDateTime(new Date(item.lastLoginAt)) : "—",
                    sortingField: "lastLoginAt",
                    width: 180,
                    minWidth: 180,
                  },
                  {
                    id: "created",
                    header: t("common.createdAt"),
                    cell: (item) => formatDate(new Date(item.createdAt)),
                    sortingField: "createdAt",
                    width: 120,
                    minWidth: 120,
                  },
                  {
                    id: "actions",
                    header: t("common.actions"),
                    cell: (item) =>
                      currentUser?.role === "super_admin" && item.id !== currentUser.id ? (
                        <SpaceBetween direction="horizontal" size="xs"><Button variant="inline-link" onClick={() => { setFormError(""); setEditing(item); }}>{t("Edit")}</Button>
                        <Button
                          variant="inline-link"
                          loading={deleteLoading === item.id}
                          onClick={() => handleDelete(item.id)}
                        >
                          {t("common.delete")}
                        </Button></SpaceBetween>
                      ) : null,
                    width: 100,
                    minWidth: 100,
                  },
                ]}
                empty={
                  <Box textAlign="center" color="inherit">
                    <SpaceBetween size="m">
                      <b>{t("No users")}</b>
                      <Box variant="p" color="inherit">{t("Invite users to get started.")}</Box>
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
                addNotification({ type: "success", content: t("Copied to clipboard.") });
              }}
            >
              {t("Copy Link")}</Button>
          </SpaceBetween>
        ) : (
          <Form errorText={formError}>
            <SpaceBetween size="m">
              <FormField label={t("users.email")} description={t("Optional. Leave blank for a generic invite link.")}>
                <Input
                  value={inviteEmail}
                  onChange={({ detail }) => setInviteEmail(detail.value)}
                  placeholder={t("user@example.com")}
                  type="email"
                />
              </FormField>
              <FormField label={t("users.role")}>
                <Select
                  selectedOption={{ ...inviteRole, label: t(`role.${inviteRole.value}`) }}
                  onChange={({ detail }) => setInviteRole(detail.selectedOption as typeof inviteRole)}
                  options={ROLE_OPTIONS.map(option => ({ ...option, label: t(`role.${option.value}`) }))}
                  placeholder={t("users.selectRole")}
                />
              </FormField>
              <FormField label={t("users.scope")}>
                <Select
                  selectedOption={{ ...inviteScope, label: t(`scope.${inviteScope.value}`) }}
                  onChange={({ detail }) => setInviteScope(detail.selectedOption as typeof inviteScope)}
                  options={SCOPE_OPTIONS.map(option => ({ ...option, label: t(`scope.${option.value}`) }))}
                  placeholder={t("users.selectScope")}
                />
              </FormField>
              {inviteScope.value === "restricted" && <ResourceScopeFields deviceIds={allowedDevices} groupIds={allowedGroups} onChange={(devices, groups) => { setAllowedDevices(devices); setAllowedGroups(groups); }} />}
            </SpaceBetween>
          </Form>
        )}
      </Modal>
      <Modal visible={!!editing} onDismiss={() => setEditing(null)} header={t("Edit user access")} footer={<Button variant="primary" loading={editLoading} onClick={async () => {
        if (!editing) return;
        setEditLoading(true);
        try { await apiPut(`/api/setup/users/${editing.id}`, { role: editing.role, enabled: editing.enabled, scope: editing.scope, allowedDeviceIds: editing.allowedDeviceIds ?? [], allowedGroupIds: editing.allowedGroupIds ?? [] }); setEditing(null); await refetch(); addNotification({ type: "success", content: t("User access updated. Existing sessions were revoked.") }); }
        catch (error) { setFormError(error instanceof Error ? error.message : t("Update failed")); }
        finally { setEditLoading(false); }
      }}>{t("Save access")}</Button>}>
        {editing && <SpaceBetween size="m">{formError && <Alert type="error">{formError}</Alert>}
          <FormField label={t("Role")}><Select options={[{ value: "super_admin", label: t("Super administrator") }, ...ROLE_OPTIONS.map(option => ({ ...option, label: t(`role.${option.value}`) }))]} selectedOption={{ value: editing.role, label: t(`role.${editing.role}`) }} onChange={({ detail }) => { const role = detail.selectedOption.value; if (role === "super_admin" || role === "admin" || role === "operator" || role === "viewer") setEditing({ ...editing, role }); }} /></FormField>
          <FormField label={t("Scope")}><Select options={SCOPE_OPTIONS.map(option => ({ ...option, label: t(`scope.${option.value}`) }))} selectedOption={{ value: editing.scope, label: t(`scope.${editing.scope}`) }} onChange={({ detail }) => setEditing({ ...editing, scope: detail.selectedOption.value ?? "all" })} /></FormField>
          <Toggle checked={editing.enabled} onChange={({ detail }) => setEditing({ ...editing, enabled: detail.checked })}>{t("Account enabled")}</Toggle>
          {editing.scope === "restricted" && <ResourceScopeFields deviceIds={editing.allowedDeviceIds ?? []} groupIds={editing.allowedGroupIds ?? []} onChange={(devices, groups) => setEditing({ ...editing, allowedDeviceIds: devices, allowedGroupIds: groups })} />}
        </SpaceBetween>}
      </Modal>
    </ContentLayout>
  );
}
