"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WidgetProps, MapConfig } from "../types";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((m) => m.CircleMarker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

interface Device {
  id: string;
  name: string;
  ip: string;
  status: string;
  type: string;
  latitude?: number;
  longitude?: number;
  location?: string;
}

const STATUS_COLORS: Record<string, string> = {
  up: "#16A34A",
  down: "#DC2626",
  warning: "#CA8A04",
  unknown: "#6B7280",
  maintenance: "#7C3AED",
};

export function MapWidget({ id, config }: WidgetProps) {
  const cfg = config as MapConfig;
  const [cssLoaded, setCssLoaded] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    setCssLoaded(true);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["devices", "map", cfg.groupFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "200" });
      if (cfg.groupFilter) params.set("groupId", cfg.groupFilter);
      return apiFetch<{ data: Device[] }>(`/api/devices?${params}`);
    },
    staleTime: 30_000,
  });

  const devices = (data?.data ?? []).filter((d) => d.latitude && d.longitude);
  const title = cfg.title || "Device Map";
  const center: [number, number] = [cfg.centerLat ?? 37.5665, cfg.centerLng ?? 126.978];
  const zoom = cfg.zoom ?? 6;

  return (
    <Card data-testid="widget-map" data-widget-id={id} className="h-full flex flex-col">
      <CardHeader className="pb-2 px-5 pt-4">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-0 pb-0 pt-0 overflow-hidden rounded-b-lg">
        {!cssLoaded || isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {devices.map((device) => (
              <CircleMarker
                key={device.id}
                center={[device.latitude!, device.longitude!]}
                radius={8}
                pathOptions={{
                  color: STATUS_COLORS[device.status] || STATUS_COLORS.unknown,
                  fillColor: STATUS_COLORS[device.status] || STATUS_COLORS.unknown,
                  fillOpacity: 0.7,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">{device.name}</div>
                    <div className="text-gray-500 font-mono text-xs">{device.ip}</div>
                    <div className="capitalize">
                      {device.type} —{" "}
                      <span style={{ color: STATUS_COLORS[device.status] }}>{device.status}</span>
                    </div>
                    {device.location && <div className="text-gray-500">{device.location}</div>}
                    <a href={`/devices/${device.id}`} className="text-blue-600 hover:underline text-xs mt-1 block">
                      View Details
                    </a>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        )}
      </CardContent>
    </Card>
  );
}
