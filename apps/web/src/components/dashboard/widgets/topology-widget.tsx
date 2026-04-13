"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { apiFetch, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WidgetProps, TopologyConfig } from "../types";

const ReactFlow = dynamic(() => import("reactflow").then((m) => m.default), { ssr: false });
const Background = dynamic(() => import("reactflow").then((m) => m.Background), { ssr: false });
const Controls = dynamic(() => import("reactflow").then((m) => m.Controls), { ssr: false });
const MiniMap = dynamic(() => import("reactflow").then((m) => m.MiniMap), { ssr: false });

interface Device {
  id: string;
  name: string;
  ip: string;
  type: string;
  status: string;
  groupId?: string;
}

interface RFNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface RFEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  style?: Record<string, unknown>;
}

const STATUS_COLORS: Record<string, string> = {
  up: "#16A34A",
  down: "#DC2626",
  warning: "#CA8A04",
  unknown: "#6B7280",
  maintenance: "#7C3AED",
};

function buildGraph(devices: Device[]): { nodes: RFNode[]; edges: RFEdge[] } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(devices.length)));
  const nodes: RFNode[] = devices.map((d, i) => ({
    id: d.id,
    position: { x: (i % cols) * 200 + 40, y: Math.floor(i / cols) * 140 + 40 },
    data: { label: d.name, status: d.status },
    style: {
      border: `2px solid ${STATUS_COLORS[d.status] || STATUS_COLORS.unknown}`,
      borderRadius: 8,
      padding: "6px 12px",
      fontSize: 11,
      background: "var(--card)",
    },
  }));

  const edges: RFEdge[] = [];
  const grouped = new Map<string, Device[]>();
  for (const d of devices) {
    const k = d.groupId || "default";
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(d);
  }
  for (const [, g] of grouped) {
    for (let i = 1; i < g.length; i++) {
      edges.push({
        id: `e-${g[0].id}-${g[i].id}`,
        source: g[0].id,
        target: g[i].id,
        type: "smoothstep",
        animated: g[i].status === "up",
        style: { stroke: g[i].status === "down" ? "#DC2626" : "#64748b", strokeWidth: 1.5 },
      });
    }
  }

  return { nodes, edges };
}

export function TopologyWidget({ id, config }: WidgetProps) {
  const cfg = config as TopologyConfig;

  const { data, isLoading } = useQuery({
    queryKey: ["devices", "topology", cfg.groupFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "200" });
      if (cfg.groupFilter) params.set("groupId", cfg.groupFilter);
      return apiFetch<{ data: Device[] }>(`/api/devices?${params}`);
    },
    staleTime: 30_000,
  });

  const devices = data?.data ?? [];
  const { nodes, edges } = buildGraph(devices);
  const title = cfg.title || "Network Topology";

  const nodeColor = useCallback(
    (n: { data?: Record<string, unknown> }) =>
      STATUS_COLORS[(n.data?.status as string) ?? "unknown"] || STATUS_COLORS.unknown,
    []
  );

  return (
    <Card data-testid="widget-topology" data-widget-id={id} className="h-full flex flex-col">
      <CardHeader className="pb-2 px-5 pt-4">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-0 pb-0 pt-0 overflow-hidden rounded-b-lg">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
          </div>
        ) : nodes.length > 0 ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView={cfg.fitView !== false}
            nodesDraggable={cfg.interactable !== false}
            nodesConnectable={false}
            elementsSelectable={false}
            attributionPosition="bottom-left"
          >
            <Background gap={20} size={1} />
            <Controls showInteractive={false} />
            {cfg.showMinimap && <MiniMap nodeColor={nodeColor} zoomable pannable />}
          </ReactFlow>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No devices found
          </div>
        )}
      </CardContent>
    </Card>
  );
}
