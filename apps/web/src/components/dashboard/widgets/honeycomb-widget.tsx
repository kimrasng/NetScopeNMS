"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Group } from "@visx/group";
import { scaleOrdinal } from "@visx/scale";
import { useTooltip } from "@visx/tooltip";
import { apiFetch, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WidgetProps, HoneycombConfig } from "../types";

interface Device {
  id: string;
  name: string;
  ip: string;
  status: string;
  type: string;
}

const STATUS_COLORS: Record<string, string> = {
  up: "#16A34A",
  down: "#DC2626",
  warning: "#CA8A04",
  unknown: "#6B7280",
  maintenance: "#7C3AED",
};

const colorScale = scaleOrdinal<string, string>({
  domain: Object.keys(STATUS_COLORS),
  range: Object.values(STATUS_COLORS),
});

/** Generate flat-top hexagon path */
function hexPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return `M${pts.join("L")}Z`;
}

export function HoneycombWidget({ id, config }: WidgetProps) {
  const cfg = config as HoneycombConfig;
  const router = useRouter();
  const cellSize = cfg.cellSize || 28;
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["devices", "honeycomb", cfg.groupFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "200" });
      if (cfg.groupFilter) params.set("groupId", cfg.groupFilter);
      return apiFetch<{ data: Device[] }>(`/api/devices?${params}`);
    },
    staleTime: 30_000,
  });

  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    showTooltip,
    hideTooltip,
  } = useTooltip<Device>();

  const devices = data?.data ?? [];

  const layout = useMemo(() => {
    if (!containerRef || devices.length === 0) return { positions: [] as { x: number; y: number; device: Device }[], width: 0, height: 0 };

    const w = containerRef.clientWidth;
    const r = cellSize;
    const hexW = r * 2;
    const hexH = r * Math.sqrt(3);
    const cols = Math.max(1, Math.floor((w - r) / (hexW * 0.75)));

    const positions = devices.map((device, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = r + col * hexW * 0.75;
      const y = r + row * hexH + (col % 2 === 1 ? hexH / 2 : 0);
      return { x, y, device };
    });

    const maxY = Math.max(...positions.map((p) => p.y)) + r + 4;
    return { positions, width: w, height: Math.max(maxY, 100) };
  }, [containerRef, devices, cellSize]);

  const title = cfg.title || "Device Honeycomb";

  return (
    <Card data-testid="widget-honeycomb" data-widget-id={id} className="h-full flex flex-col">
      <CardHeader className="pb-2 px-5 pt-4">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-5 pb-4 pt-0 relative" ref={setContainerRef}>
        {isLoading ? (
          <div className="h-full w-full animate-pulse rounded bg-muted" />
        ) : devices.length > 0 && layout.width > 0 ? (
          <svg width={layout.width} height={layout.height} className="overflow-visible">
            <Group>
              {layout.positions.map(({ x, y, device }) => (
                <path
                  key={device.id}
                  d={hexPath(x, y, cellSize - 2)}
                  fill={colorScale(device.status) ?? STATUS_COLORS.unknown}
                  stroke="var(--border)"
                  strokeWidth={1}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onClick={() => router.push(`/devices/${device.id}`)}
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGElement).ownerSVGElement?.getBoundingClientRect();
                    if (rect) {
                      showTooltip({
                        tooltipData: device,
                        tooltipLeft: e.clientX - rect.left,
                        tooltipTop: e.clientY - rect.top - 10,
                      });
                    }
                  }}
                  onMouseLeave={hideTooltip}
                />
              ))}
              {cfg.showLabels &&
                layout.positions.map(({ x, y, device }) => (
                  <text
                    key={`label-${device.id}`}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="pointer-events-none fill-white text-[8px] font-medium"
                  >
                    {device.name.slice(0, 3)}
                  </text>
                ))}
            </Group>
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No devices found
          </div>
        )}
        {tooltipOpen && tooltipData && (
          <div
            className="pointer-events-none absolute z-50 rounded-md border bg-popover px-2.5 py-1.5 text-popover-foreground shadow-md"
            style={{ left: tooltipLeft ?? 0, top: tooltipTop ?? 0 }}
          >
            <div className="font-medium text-xs">{tooltipData.name}</div>
            <div className="text-[10px] opacity-70 font-mono">{tooltipData.ip}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[tooltipData.status] }}
              />
              <span className="capitalize text-[10px]">{tooltipData.status}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
