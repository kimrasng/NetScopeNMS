"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((m) => m.CircleMarker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

interface Device {
  id: string; name: string; ip: string; type: string; status: string;
  latitude?: number; longitude?: number; location?: string;
}

const statusColors: Record<string, string> = {
  up: "#16A34A", down: "#DC2626", warning: "#CA8A04", unknown: "#6B7280", maintenance: "#7C3AED",
};

export default function GeoMapPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    setMapReady(true);
    return () => { document.head.removeChild(link); };
  }, []);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ data: Device[] }>("/api/devices?limit=200");
      setDevices(data.data.filter((d) => d.latitude && d.longitude));
    } catch (err) {
      console.error("Failed to load devices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDevices(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Geo Map</h1>
          <p className="text-xs text-muted-foreground">Geographic device locations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs">
            {Object.entries(statusColors).map(([status, color]) => (
              <span key={status} className="flex items-center gap-1.5 rounded-full bg-accent/50 px-2 py-0.5">
                <span className="h-2 w-2 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                <span className="capitalize text-muted-foreground text-[10px]">{status}</span>
              </span>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={loadDevices}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden relative shadow-lg border-border/50" style={{ height: "calc(100vh - 180px)" }}>
        {!mapReady || loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <MapContainer
            center={[37.5665, 126.978]}
            zoom={6}
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
                radius={10}
                pathOptions={{
                  color: statusColors[device.status] || statusColors.unknown,
                  fillColor: statusColors[device.status] || statusColors.unknown,
                  fillOpacity: 0.7,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">{device.name}</div>
                    <div className="text-gray-500 font-mono text-xs">{device.ip}</div>
                    <div className="capitalize">{device.type} - <span style={{ color: statusColors[device.status] }}>{device.status}</span></div>
                    {device.location && <div className="text-gray-500">{device.location}</div>}
                    <a href={`/devices/${device.id}`} className="text-blue-600 hover:underline text-xs mt-1 block">View Details</a>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        )}
        {!loading && devices.length === 0 && mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-[1000]">
            <Card className="p-6 text-center shadow-2xl shadow-black/20">
              <p className="text-muted-foreground">No devices with coordinates found.</p>
              <p className="text-sm text-muted-foreground mt-1">Add latitude/longitude to devices to see them on the map.</p>
            </Card>
          </div>
        )}
      </Card>
    </div>
  );
}
