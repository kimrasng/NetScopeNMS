"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { ReactFlow, Background, Controls, useNodesState, type Node, type ReactFlowInstance } from "@xyflow/react";
import Box from "@cloudscape-design/components/box";
import Header from "@cloudscape-design/components/header";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import { colorBackgroundContainerContent, colorBackgroundLayoutMain, colorBorderDividerDefault, colorTextBodyDefault, fontFamilyBase } from "@cloudscape-design/design-tokens";
import { DeviceStatusLabel } from "@/components/common/device-status";
import { statusColors } from "./status-colors";
import { useI18n } from "@/lib/i18n";
import Button from "@cloudscape-design/components/button";
import Select from "@cloudscape-design/components/select";
import FormField from "@cloudscape-design/components/form-field";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Alert from "@cloudscape-design/components/alert";
import Table from "@cloudscape-design/components/table";
import Link from "@cloudscape-design/components/link";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { canOperate } from "@/lib/permissions";
import { apiPut, apiPost, apiDelete } from "@/lib/api";
import type { Device, DeviceGroup, PaginatedResponse, TopologyPosition } from "@/lib/types";
import styles from "./viewers.module.css";
interface Edge { id: string; sourceDeviceId: string; targetDeviceId: string; sourcePort: string; discoveryMethod: string }
interface Graph { nodes: Device[]; edges: Edge[]; positions: TopologyPosition[] }
export function TopologyViewer() {
  const { t } = useI18n();
  const { data: groups } = useApi<PaginatedResponse<DeviceGroup>>("/api/device-groups", { limit: 200 });
  const [groupId, setGroupId] = useState("");
  const [focusId, setFocusId] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const { data, error, refetch } = useApi<Graph>("/api/topology/graph");
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const dirty = useRef(false);
  const flow = useRef<Pick<ReactFlowInstance, "fitView"> | null>(null);
  const fitAfterLayout = useRef(false);
  const [source, setSource] = useState(""); const [target, setTarget] = useState("");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const autoLayout = useCallback(() => {
    if (!data) return;
    const levels = new Map<string, number>();
    const positions = new Map<string, { x: number; y: number }>();
    let offset = 0;
    const adjacency = new Map(data.nodes.map(device => [device.id, [] as string[]]));
    for (const edge of data.edges) { adjacency.get(edge.sourceDeviceId)?.push(edge.targetDeviceId); adjacency.get(edge.targetDeviceId)?.push(edge.sourceDeviceId); }
    for (const device of data.nodes) {
      if (levels.has(device.id) || !adjacency.get(device.id)?.length) continue;
      levels.set(device.id, 0); const queue = [device.id];
      for (let i = 0; i < queue.length; i++) for (const next of adjacency.get(queue[i]) ?? []) if (!levels.has(next)) { levels.set(next, (levels.get(queue[i]) ?? 0) + 1); queue.push(next); }
      const counts = new Map<number, number>();
      for (const id of queue) { const level = levels.get(id) ?? 0; const row = counts.get(level) ?? 0; counts.set(level, row + 1); positions.set(id, { x: level * 280, y: offset + row * 110 }); }
      offset += Math.max(...counts.values()) * 110 + 80;
    }
    setNodes(previous => {
      let isolated = 0;
      return data.nodes.map(device => { let position = positions.get(device.id); if (!position) { position = { x: (isolated % 4) * 280, y: offset + Math.floor(isolated / 4) * 110 }; isolated++; } return { ...previous.find(node => node.id === device.id), id: device.id, position, data: { label: `${device.name} · ${t(`status.${device.status}`)}\n${device.ip}` }, className: styles.node, style: { borderColor: statusColors[device.status], background: colorBackgroundContainerContent, color: colorTextBodyDefault, fontFamily: fontFamilyBase } }; });
    });
    fitAfterLayout.current = true;
    dirty.current = true;
  }, [data, setNodes, t]);
  useEffect(() => { if (fitAfterLayout.current) { fitAfterLayout.current = false; const frame = requestAnimationFrame(() => { void flow.current?.fitView({ minZoom: 0.1, maxZoom: 1 }); }); return () => cancelAnimationFrame(frame); } }, [nodes]);
  useEffect(() => {
    if (!data) return;
    setNodes(previous => data.nodes.map((device, index) => {
      const existing = previous.find(node => node.id === device.id); const saved = data.positions.find(position => position.deviceId === device.id);
      return { ...existing, id: device.id, position: dirty.current && existing ? existing.position : saved ? { x: saved.x, y: saved.y } : { x: (index % 4) * 260, y: Math.floor(index / 4) * 110 }, data: { label: `${device.name} · ${t(`status.${device.status}`)}\n${device.ip}` }, className: styles.node, style: { borderColor: statusColors[device.status], background: colorBackgroundContainerContent, color: colorTextBodyDefault, fontFamily: fontFamilyBase } };
    }));
  }, [data, setNodes, t]);
  const perform = async (operation: () => Promise<unknown>, success: string) => { setBusy(true); setMessage(""); try { await operation(); setMessageType("success"); setMessage(t(success)); await refetch(); } catch (err) { setMessageType("error"); setMessage(err instanceof Error ? err.message : "Operation failed"); } finally { setBusy(false); } };
  const options = data?.nodes.map(device => ({ label: `${device.name} (${device.ip})`, value: device.id })) ?? [];
  const groupOptions = [{ value: "", label: t("All groups") }, ...(groups?.data ?? []).map(group => ({ value: group.id, label: group.name }))];
  const visibleIds = new Set((data?.nodes ?? []).filter(device => !groupId || device.groupId === groupId).map(device => device.id));
  return <SpaceBetween size="m">
    {error && <Alert type="error">{error}</Alert>}{message && <Alert type={messageType} dismissible onDismiss={() => setMessage("")}>{message}</Alert>}
    <SpaceBetween direction="horizontal" size="m">
      <FormField label={t("Focus device")}><Select filteringType="auto" options={options} selectedOption={options.find(option => option.value === focusId) ?? null} placeholder={t("Find a device by name or IP")} onChange={({ detail }) => { const id = detail.selectedOption.value ?? ""; setFocusId(id); setGroupId(""); requestAnimationFrame(() => { void flow.current?.fitView({ nodes: [{ id }], minZoom: 0.6, maxZoom: 1.1, padding: 0.5 }); }); }} /></FormField>
      <FormField label={t("Device groups")}><Select options={groupOptions} selectedOption={groupOptions.find(option => option.value === groupId) ?? groupOptions[0]} onChange={({ detail }) => { setGroupId(detail.selectedOption.value ?? ""); setFocusId(""); requestAnimationFrame(() => { void flow.current?.fitView({ minZoom: 0.25, maxZoom: 1 }); }); }} /></FormField>
    </SpaceBetween>
    <SpaceBetween direction="horizontal" size="s"><Button onClick={() => { setFocusId(""); void flow.current?.fitView({ minZoom: 0.1, maxZoom: 1 }); }}>{t("Fit all devices")}</Button><Button onClick={autoLayout}>{t("Auto layout")}</Button>{canOperate(user) && <Button loading={busy} disabled={!nodes.length} onClick={() => perform(async () => { await apiPut("/api/topology/positions", nodes.map(node => ({ deviceId: node.id, ...node.position }))); dirty.current = false; }, "Layout saved")}>{t("Save layout")}</Button>}<Box>{visibleIds.size} / {data?.nodes.length ?? 0} {t("devices")}</Box></SpaceBetween>
    <SpaceBetween direction="horizontal" size="m">{(["up", "down", "warning", "unknown", "maintenance"] as const).map(status => <DeviceStatusLabel key={status} status={status} />)}</SpaceBetween>
    <div className={styles.canvas}><ReactFlow<Node> style={{ background: colorBackgroundLayoutMain }} colorMode={resolvedTheme} minZoom={0.1} fitViewOptions={{ minZoom: 0.1, maxZoom: 1 }} ariaLabelConfig={{ "controls.ariaLabel": t("Graph controls"), "controls.zoomIn.ariaLabel": t("Zoom in"), "controls.zoomOut.ariaLabel": t("Zoom out"), "controls.fitView.ariaLabel": t("Fit all devices"), "controls.interactive.ariaLabel": t("Toggle graph interaction") }} onInit={instance => { flow.current = instance; }} nodes={nodes.map(node => ({ ...node, hidden: !visibleIds.has(node.id) }))} onNodeDoubleClick={(_event, node) => { window.location.assign(`/devices/${node.id}`); }} edges={(data?.edges ?? []).filter(edge => visibleIds.has(edge.sourceDeviceId) && visibleIds.has(edge.targetDeviceId)).map(edge => ({ id: edge.id, source: edge.sourceDeviceId, target: edge.targetDeviceId, ariaLabel: `${data?.nodes.find(device => device.id === edge.sourceDeviceId)?.name} → ${data?.nodes.find(device => device.id === edge.targetDeviceId)?.name}`, label: edge.sourcePort || (edge.discoveryMethod === "manual" ? t("Manual") : edge.discoveryMethod.toUpperCase()) }))} onNodesChange={onNodesChange} onNodeDragStart={() => { dirty.current = true; }} nodesConnectable={false} fitView><Background bgColor={colorBackgroundLayoutMain} color={colorBorderDividerDefault} /><Controls /></ReactFlow></div>
    {canOperate(user) && <ExpandableSection headerText={t("Manage connections")}><SpaceBetween direction="horizontal" size="s">
      <FormField label={t("Source device")}><Select filteringType="auto" options={options} selectedOption={options.find(option => option.value === source) ?? null} onChange={({ detail }) => setSource(detail.selectedOption.value ?? "")} /></FormField>
      <FormField label={t("Target device")}><Select filteringType="auto" options={options} selectedOption={options.find(option => option.value === target) ?? null} onChange={({ detail }) => setTarget(detail.selectedOption.value ?? "")} /></FormField>
      <Button disabled={!source || !target || source === target} loading={busy} onClick={() => perform(() => apiPost("/api/topology/edges", { sourceDeviceId: source, targetDeviceId: target }), "Connection saved")}>{t("Add connection")}</Button>
    </SpaceBetween></ExpandableSection>}
    <Table header={<Header counter={`(${data?.edges.length ?? 0})`}>{t("Network connections")}</Header>} items={(data?.edges ?? []).filter(edge => visibleIds.has(edge.sourceDeviceId) && visibleIds.has(edge.targetDeviceId))} columnDefinitions={[
      { id: "source", header: t("Source"), cell: edge => <Link href={`/devices/${edge.sourceDeviceId}`}>{data?.nodes.find(device => device.id === edge.sourceDeviceId)?.name}</Link> },
      { id: "target", header: t("Target"), cell: edge => <Link href={`/devices/${edge.targetDeviceId}`}>{data?.nodes.find(device => device.id === edge.targetDeviceId)?.name}</Link> },
      { id: "method", header: t("Method / port"), cell: edge => `${edge.discoveryMethod === "manual" ? t("Manual") : edge.discoveryMethod.toUpperCase()} ${edge.sourcePort}` },
      ...(canOperate(user) ? [{ id: "action", header: t("Actions"), cell: (edge: Edge) => <Button variant="inline-link" onClick={() => perform(() => apiDelete(`/api/topology/edges/${edge.id}`), "Connection removed")}>{t("Remove")}</Button> }] : []),
    ]} empty={t(canOperate(user) ? "No connections. Run discovery or add a connection." : "No connections are available within your device scope.")} />
  </SpaceBetween>;
}
