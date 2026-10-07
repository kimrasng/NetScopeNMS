"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Header from "@cloudscape-design/components/header";
import { DeviceStatusLabel } from "@/components/common/device-status";
import { statusColors } from "./status-colors";
import { useI18n } from "@/lib/i18n";
import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import Link from "@cloudscape-design/components/link";
import { useApi } from "@/hooks/use-api";
import type { Device } from "@/lib/types";
import styles from "./viewers.module.css";
export function GeographicMap() {
  const { t } = useI18n();
  const { data, error } = useApi<{ nodes: Device[] }>("/api/topology/graph");
  const container = useRef<HTMLDivElement>(null); const map = useRef<LeafletMap | null>(null); const markers = useRef<LayerGroup | null>(null);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false); const [tileError, setTileError] = useState(false);
  const located = useMemo(() => (data?.nodes ?? []).filter(device => device.latitude != null && device.longitude != null), [data]);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then(L => {
      if (cancelled || !container.current) return;
      fitted.current = false;
      const instance = L.map(container.current, { zoomControl: false }).setView([20, 0], 2); map.current = instance;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).on("tileerror", () => setTileError(true)).addTo(instance);
      L.control.zoom({ zoomInTitle: t("Zoom in"), zoomOutTitle: t("Zoom out") }).addTo(instance);
      markers.current = L.layerGroup().addTo(instance); setReady(true);
    });
    return () => { cancelled = true; map.current?.remove(); map.current = null; markers.current = null; };
  }, [t]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void import("leaflet").then(L => {
      if (cancelled || !markers.current || !map.current) return;
      markers.current.clearLayers();
      for (const device of located) {
        const label = document.createElement("span"); label.textContent = `${device.name} (${device.ip}) · ${t(`status.${device.status}`)}`;
        L.circleMarker([device.latitude!, device.longitude!], { radius: selected === device.id ? 12 : 8, color: statusColors[device.status], fillOpacity: 0.7 }).bindTooltip(label).on("click", () => setSelected(device.id)).addTo(markers.current);
      }
      if (!fitted.current && located.length) {
        map.current.fitBounds(L.latLngBounds(located.map(device => [device.latitude!, device.longitude!])), { padding: [30, 30], maxZoom: 14 });
        fitted.current = true;
      }
    });
    return () => { cancelled = true; };
  }, [located, ready, selected, t]);
  const fit = async () => { const L = await import("leaflet"); if (located.length) map.current?.fitBounds(L.latLngBounds(located.map(device => [device.latitude!, device.longitude!])), { padding: [30, 30], maxZoom: 14 }); };
  return <SpaceBetween size="m">
    {error && <Alert type="error">{error}</Alert>}
    {tileError && <Alert type="warning">{t("Map tiles are unavailable. Device markers and the location table remain available.")}</Alert>}
    <ColumnLayout columns={3} variant="text-grid">{[{ label: t("Located devices"), value: located.length }, { label: t("Missing coordinates"), value: (data?.nodes.length ?? 0) - located.length }, { label: t("All devices"), value: data?.nodes.length ?? 0 }].map(item => <div key={item.label}><Box variant="awsui-key-label">{t(item.label)}</Box><Box fontSize="heading-l">{item.value}</Box></div>)}</ColumnLayout>
    <SpaceBetween direction="horizontal" size="s"><Button onClick={fit} disabled={!ready || !located.length}>{t("Fit device locations")}</Button><Link href="/devices">{t("Configure device coordinates")}</Link></SpaceBetween>
    <div ref={container} className={styles.canvas} aria-label={t("Device geographic map")} />
    <Table header={<Header counter={`(${located.length})`}>{t("Device locations")}</Header>} items={located} selectionType="single" selectedItems={located.filter(device => device.id === selected)} onSelectionChange={({ detail }) => { const device = detail.selectedItems[0]; setSelected(device?.id ?? null); if (device) map.current?.setView([device.latitude!, device.longitude!], 12); }} columnDefinitions={[
      { id: "name", header: t("Device"), cell: device => <Link href={`/devices/${device.id}`}>{device.name}</Link> },
      { id: "status", header: t("Status"), cell: device => <DeviceStatusLabel status={device.status} /> }, { id: "ip", header: t("IP"), cell: device => device.ip },
      { id: "coordinates", header: t("Latitude / longitude"), cell: device => `${device.latitude}, ${device.longitude}` },
    ]} empty={t("No authorized devices have coordinates. Add latitude and longitude in the device editor.")} />
  </SpaceBetween>;
}
