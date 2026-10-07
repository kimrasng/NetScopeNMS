"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import Link from "@cloudscape-design/components/link";
import Modal from "@cloudscape-design/components/modal";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Textarea from "@cloudscape-design/components/textarea";
import Select from "@cloudscape-design/components/select";
import Toggle from "@cloudscape-design/components/toggle";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Spinner from "@cloudscape-design/components/spinner";
import Board, { type BoardProps } from "@cloudscape-design/board-components/board";
import BoardItem from "@cloudscape-design/board-components/board-item";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { apiPut } from "@/lib/api";
import { Widget, widgetNames } from "@/components/dashboards/widget";
import type { Dashboard, DashboardWidget, Device } from "@/lib/types";

function boardItem(widget: DashboardWidget): BoardProps.Item<DashboardWidget> {
  const columns = Number(widget.gridPosition.boardColumnSpan ?? Math.ceil(Number(widget.gridPosition.colSpan ?? 6) / 3));
  const offsets = widget.gridPosition.columnOffset;
  const defaultRows = widget.widgetType === "text" || widget.widgetType === "summary" ? 2 : 4;
  return { id: widget.id, data: widget, definition: { minRowSpan: defaultRows === 2 ? 2 : 3, minColumnSpan: 1, defaultRowSpan: defaultRows, defaultColumnSpan: 2 }, columnSpan: columns, rowSpan: Number(widget.gridPosition.rowSpan ?? defaultRows), columnOffset: offsets && typeof offsets === "object" && !Array.isArray(offsets) ? offsets as Record<number, number> : undefined };
}

export default function DashboardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useI18n();
  const { data, loading, error, refetch } = useApi<Dashboard & { widgets: DashboardWidget[] }>(`/api/dashboards/${id}`);
  const { data: devices } = useApi<{ nodes: Device[] }>("/api/topology/graph");
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const initialized = useRef("");
  const [editing, setEditing] = useState<DashboardWidget | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [isDefault, setDefault] = useState(false);
  useEffect(() => { if (data && initialized.current !== data.id) { initialized.current = data.id; setWidgets(data.widgets); setName(data.name); setShared(data.isShared); setDefault(data.isDefault); } }, [data]);
  const owned = data?.userId === user?.id;
  const reset = () => { if (data) { setWidgets(data.widgets); setName(data.name); setShared(data.isShared); setDefault(data.isDefault); } setFormError(""); setEditMode(false); };
  const save = async () => {
    if (!name.trim()) { setFormError(t("Name is required.")); return; }
    setBusy(true); setFormError("");
    try {
      await apiPut(`/api/dashboards/${id}`, { name: name.trim(), isShared: shared, isDefault, widgets: widgets.map((widget, order) => ({ widgetType: widget.widgetType, config: widget.config, gridPosition: { ...widget.gridPosition, order } })) });
      initialized.current = "";
      await refetch(); setEditMode(false); setMessage(t("Dashboard saved"));
    } catch (err) { setFormError(err instanceof Error ? err.message : t("Save failed")); } finally { setBusy(false); }
  };
  if (error) return <Alert type="error">{error}</Alert>;
  if (loading && !data) return <Spinner />;
  if (!data) return <Alert type="error">{t("Dashboard not found")}</Alert>;
  const options = devices?.nodes.map(device => ({ value: device.id, label: `${device.name} (${device.ip})` })) ?? [];
  const change = (key: string, value: unknown) => { if (editing) setEditing({ ...editing, config: { ...editing.config, [key]: value } }); };
  return <ContentLayout header={<Header variant="h1" description={t("Updates automatically every 30 seconds.")} actions={<SpaceBetween direction="horizontal" size="xs"><Link href="/dashboards">{t("All dashboards")}</Link>{owned && (editMode ? <><Button disabled={busy} onClick={reset}>{t("common.cancel")}</Button><Button loading={busy} variant="primary" onClick={save}>{t("Save dashboard")}</Button></> : <Button onClick={() => { setMessage(""); setEditMode(true); }}>{t("Edit dashboard")}</Button>)}</SpaceBetween>}>{data.name}</Header>}>
    <SpaceBetween size="l">
      {message && <Alert type="success" dismissible onDismiss={() => setMessage("")}>{message}</Alert>}
      {owned && editMode && <Container header={<Header variant="h2" actions={<Button onClick={() => { setFormError(""); setEditing({ id: crypto.randomUUID(), dashboardId: id, widgetType: "summary", config: {}, gridPosition: { colSpan: 6 }, createdAt: "" }); }}>{t("Add widget")}</Button>}>{t("Dashboard settings")}</Header>}><Form errorText={formError}><SpaceBetween size="m">
        <FormField label={t("Dashboard name")}><Input value={name} onChange={({ detail }) => setName(detail.value)} /></FormField>
        <SpaceBetween direction="horizontal" size="m"><Toggle checked={shared} onChange={({ detail }) => setShared(detail.checked)}>{t("Shared dashboard")}</Toggle><Toggle checked={isDefault} onChange={({ detail }) => setDefault(detail.checked)}>{t("My default dashboard")}</Toggle></SpaceBetween>
      </SpaceBetween></Form></Container>}
      <Board<DashboardWidget>
        items={widgets.map(boardItem)}
        onItemsChange={({ detail }) => owned && editMode && setWidgets(detail.items.map(item => ({ ...item.data, gridPosition: { ...item.data.gridPosition, boardColumnSpan: item.columnSpan, colSpan: (item.columnSpan ?? 2) * 3, rowSpan: item.rowSpan, columnOffset: item.columnOffset } })))}
        renderItem={(item, actions) => owned && editMode ? <BoardItem header={<Header>{String(item.data.config.title || t(item.data.widgetType === "metric" ? `metric.${item.data.config.metric ?? "cpu"}` : widgetNames[item.data.widgetType] ?? item.data.widgetType))}</Header>} settings={<ButtonDropdown ariaLabel={t("common.actions")} variant="icon" items={[{ id: "edit", text: t("common.edit") }, { id: "remove", text: t("Remove") }]} onItemClick={({ detail }) => { if (detail.id === "edit") { setFormError(""); setEditing(item.data); } else actions.removeItem(); }} />} i18nStrings={{ dragHandleAriaLabel: t("Move widget"), resizeHandleAriaLabel: t("Resize widget"), dragHandleAriaDescription: t("Use arrow keys to move or resize, Enter to apply, and Escape to cancel."), resizeHandleAriaDescription: t("Use arrow keys to move or resize, Enter to apply, and Escape to cancel.") }}><Widget widget={item.data} framed={false} /></BoardItem> : <Widget widget={item.data} fitHeight />}
        empty={<Box textAlign="center" padding="l">{t("Add widgets to monitor network health, incidents, and metrics.")}</Box>}
        i18nStrings={{ liveAnnouncementDndStarted: () => t("Layout change started"), liveAnnouncementDndItemReordered: () => t("Layout updated"), liveAnnouncementDndItemResized: () => t("Layout updated"), liveAnnouncementDndItemInserted: () => t("Layout updated"), liveAnnouncementDndCommitted: () => t("Layout updated"), liveAnnouncementDndDiscarded: () => t("Layout change cancelled"), liveAnnouncementItemRemoved: () => t("Widget removed"), navigationAriaLabel: t("page.dashboards"), navigationItemAriaLabel: item => String(item?.data.config.title || t(widgetNames[item?.data.widgetType ?? "summary"])) }}
      />
      {!editMode && !widgets.length && <Box textAlign="center" padding="l">{t("Add widgets to monitor network health, incidents, and metrics.")}</Box>}
    </SpaceBetween>
    <Modal visible={!!editing} onDismiss={() => setEditing(null)} header={t("Configure widget")} footer={<SpaceBetween direction="horizontal" size="xs"><Button variant="link" onClick={() => setEditing(null)}>{t("common.cancel")}</Button><Button variant="primary" onClick={() => { if (!editing) return; if (editing.widgetType === "metric" && !editing.config.deviceId) { setFormError(t("Select a device.")); return; } setWidgets(previous => previous.some(widget => widget.id === editing.id) ? previous.map(widget => widget.id === editing.id ? editing : widget) : [...previous, editing]); setFormError(""); setEditing(null); }}>{t("Apply widget")}</Button></SpaceBetween>}>
      {editing && <Form errorText={formError}><SpaceBetween size="m">
        <FormField label={t("Widget type")}><Select options={Object.entries(widgetNames).map(([value, label]) => ({ value, label: t(label) }))} selectedOption={{ value: editing.widgetType, label: t(widgetNames[editing.widgetType]) }} onChange={({ detail }) => setEditing({ ...editing, widgetType: detail.selectedOption.value ?? "summary", config: detail.selectedOption.value === "metric" ? { metric: "cpu" } : {} })} /></FormField>
        <FormField label={t("Title")}><Input value={String(editing.config.title ?? "")} onChange={({ detail }) => change("title", detail.value)} /></FormField>
        {editing.widgetType === "metric" && <><FormField label={t("Device")}><Select filteringType="auto" options={options} selectedOption={options.find(option => option.value === editing.config.deviceId) ?? null} onChange={({ detail }) => change("deviceId", detail.selectedOption.value)} /></FormField><FormField label={t("Metric")}><Select options={["cpu", "memory", "bandwidth_in", "bandwidth_out", "latency", "ping"].map(value => ({ value, label: t(`metric.${value}`) }))} selectedOption={{ value: String(editing.config.metric ?? "cpu"), label: t(`metric.${editing.config.metric ?? "cpu"}`) }} onChange={({ detail }) => change("metric", detail.selectedOption.value)} /></FormField></>}
        {editing.widgetType === "text" && <FormField label={t("Text")}><Textarea value={String(editing.config.text ?? "")} onChange={({ detail }) => change("text", detail.value)} /></FormField>}
      </SpaceBetween></Form>}
    </Modal>
  </ContentLayout>;
}
