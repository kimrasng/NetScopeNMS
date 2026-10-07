"use client";
import { useState } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Input from "@cloudscape-design/components/input";
import Textarea from "@cloudscape-design/components/textarea";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Button from "@cloudscape-design/components/button";
import Alert from "@cloudscape-design/components/alert";
import Table from "@cloudscape-design/components/table";
import Modal from "@cloudscape-design/components/modal";
import Box from "@cloudscape-design/components/box";
import { useApi } from "@/hooks/use-api";
import { useI18n } from "@/lib/i18n";
import { apiPost, apiPut, apiDelete } from "@/lib/api";
import type { DeviceGroup, PaginatedResponse } from "@/lib/types";

export default function DeviceGroupsPage() {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useApi<PaginatedResponse<DeviceGroup>>("/api/device-groups", { limit: 200 });
  const [editing, setEditing] = useState<Partial<DeviceGroup> | null>(null);
  const [deleting, setDeleting] = useState<DeviceGroup | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [nameError, setNameError] = useState("");
  const open = (group: Partial<DeviceGroup>) => { setFormError(""); setNameError(""); setEditing(group); };
  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) { setNameError(t("Name is required.")); return; }
    setBusy(true); setFormError(""); setNameError("");
    try { const body = { name: editing.name.trim(), description: editing.description }; if (editing.id) await apiPut(`/api/device-groups/${editing.id}`, body); else await apiPost("/api/device-groups", body); setEditing(null); await refetch(); }
    catch (err) { setFormError(err instanceof Error ? err.message : t("Save failed")); }
    finally { setBusy(false); }
  };
  return <ContentLayout header={<Header variant="h1" description={t("Group devices to manage access and monitoring scope.")} actions={<Button variant="primary" onClick={() => open({ name: "", description: "" })}>{t("Create group")}</Button>}>{t("Device groups")}</Header>}><SpaceBetween size="m">
    {error && <Alert type="error">{error}</Alert>}
    <Table loading={loading} items={data?.data ?? []} columnDefinitions={[
      { id: "name", header: t("common.name"), cell: group => group.name }, { id: "description", header: t("common.description"), cell: group => group.description ?? "—" },
      { id: "actions", header: t("common.actions"), cell: group => <SpaceBetween direction="horizontal" size="s"><Button variant="inline-link" onClick={() => open(group)}>{t("common.edit")}</Button><Button variant="inline-link" onClick={() => { setFormError(""); setDeleting(group); }}>{t("common.delete")}</Button></SpaceBetween> },
    ]} empty={<Box textAlign="center" padding="l">{t("No device groups")}</Box>} />
    <Modal visible={!!editing} onDismiss={() => setEditing(null)} header={t(editing?.id ? "Edit group" : "Create group")} footer={<SpaceBetween direction="horizontal" size="xs"><Button variant="link" disabled={busy} onClick={() => setEditing(null)}>{t("common.cancel")}</Button><Button loading={busy} variant="primary" onClick={save}>{t("Save group")}</Button></SpaceBetween>}>
      {editing && <Form errorText={formError}><SpaceBetween size="m"><FormField label={t("common.name")} errorText={nameError}><Input value={editing.name ?? ""} onChange={({ detail }) => { setNameError(""); setEditing({ ...editing, name: detail.value }); }} /></FormField><FormField label={t("common.description")} constraintText={t("Optional")}><Textarea value={editing.description ?? ""} onChange={({ detail }) => setEditing({ ...editing, description: detail.value })} /></FormField></SpaceBetween></Form>}
    </Modal>
    <Modal visible={!!deleting} header={t("Delete group")} onDismiss={() => setDeleting(null)} footer={<SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={() => setDeleting(null)}>{t("common.cancel")}</Button><Button loading={busy} variant="primary" onClick={async () => { if (!deleting) return; setBusy(true); try { await apiDelete(`/api/device-groups/${deleting.id}`); setDeleting(null); await refetch(); } catch (err) { setFormError(err instanceof Error ? err.message : t("Deletion failed")); } finally { setBusy(false); } }}>{t("common.delete")}</Button></SpaceBetween>}><SpaceBetween size="m">{formError && <Alert type="error">{formError}</Alert>}<Box variant="strong">{deleting?.name}</Box><Box>{t("Delete this group? Devices will remain available.")}</Box></SpaceBetween></Modal>
  </SpaceBetween></ContentLayout>;
}
