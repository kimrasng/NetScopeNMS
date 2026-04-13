"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType, ConnectionLineType,
  EdgeLabelRenderer, type EdgeProps, getBezierPath, BaseEdge,
  type NodeDragHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, cn, formatBps } from "@/lib/utils";
import { RefreshCw, Image, X, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Constants ───────────────────────────────────────
const statusColors: Record<string, string> = {
  up: "#16A34A", down: "#DC2626", warning: "#CA8A04",
  unknown: "#6B7280", maintenance: "#7C3AED",
};
const statusGlow: Record<string, string> = {
  up: "0 0 12px -2px rgba(22,163,74,0.45), 0 0 4px -1px rgba(22,163,74,0.2)",
  down: "0 0 12px -2px rgba(220,38,38,0.45), 0 0 4px -1px rgba(220,38,38,0.2)",
  warning: "0 0 12px -2px rgba(202,138,4,0.45), 0 0 4px -1px rgba(202,138,4,0.2)",
  maintenance: "0 0 12px -2px rgba(124,58,237,0.45), 0 0 4px -1px rgba(124,58,237,0.2)",
  unknown: "none",
};
const typeLabel: Record<string, string> = {
  router: "R", switch: "S", server: "SV", firewall: "FW",
  access_point: "AP", load_balancer: "LB", storage: "ST", other: "?",
};

function getUtilizationColor(utilization: number | null): string {
  if (utilization === null) return "#6b7280";
  if (utilization >= 90) return "#ef4444";
  if (utilization >= 75) return "#f97316";
  if (utilization >= 50) return "#eab308";
  return "#22c55e";
}

// ─── Types ───────────────────────────────────────────
interface Device {
  id: string; name: string; ip: string; type: string;
  status: string; location?: string; groupId?: string;
}
interface DeviceInterface {
  id: string; deviceId: string; name: string; speed: number | null;
  inBps: number | null; outBps: number | null; status: string | null;
}
interface SavedPosition { deviceId: string; x: number; y: number; }
interface WeathermapEdgeData {
  utilization: number | null;
  bandwidthLabel: string;
}

// ─── Device Node ─────────────────────────────────────
function DeviceNode({ data }: { data: Device & { selected: boolean } }) {
  const isCritical = data.status === "down";
  return (
    <div
      className={cn(
        "rounded-lg border-2 bg-card px-3 py-2.5 shadow-md min-w-[130px] text-center transition-shadow hover:shadow-lg",
        data.selected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
      )}
      style={{
        borderColor: statusColors[data.status] || statusColors.unknown,
        boxShadow: statusGlow[data.status] || statusGlow.unknown,
      }}
    >
      <div
        className={cn(
          "flex items-center justify-center h-7 w-7 mx-auto mb-1.5 rounded-md text-[10px] font-bold text-white shadow-sm",
          isCritical && "animate-pulse",
        )}
        style={{ backgroundColor: statusColors[data.status] || statusColors.unknown }}
      >
        {typeLabel[data.type] || "?"}
      </div>
      <div className="text-xs font-medium truncate">{data.name}</div>
      <div className="text-[10px] text-muted-foreground font-mono">{data.ip}</div>
    </div>
  );
}

// ─── Weathermap Edge ─────────────────────────────────
function WeathermapEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, style,
}: EdgeProps<WeathermapEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });
  const color = getUtilizationColor(data?.utilization ?? null);
  const label = data?.bandwidthLabel || "";

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ ...style, stroke: color, strokeWidth: 2.5 }} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto rounded bg-background/90 px-1.5 py-0.5 text-[9px] font-mono text-foreground shadow-sm border border-border/50"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { device: DeviceNode };
const edgeTypes = { weathermap: WeathermapEdge };

// ─── Hooks ───────────────────────────────────────────
function useTopologyPositions() {
  return useQuery<{ data: SavedPosition[] }>({
    queryKey: ["topology", "positions"],
    queryFn: () => apiFetch("/api/topology/positions"),
    staleTime: 60_000,
  });
}

function useSavePositions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (positions: SavedPosition[]) =>
      apiFetch("/api/topology/positions", {
        method: "PUT",
        body: JSON.stringify(positions),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topology", "positions"] }),
  });
}

// ─── Main Page ───────────────────────────────────────
export default function TopologyPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [bgImageUrl, setBgImageUrl] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [bgInput, setBgInput] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const { data: positionsData } = useTopologyPositions();
  const savePositionsMut = useSavePositions();

  const { data: devicesData, isLoading } = useQuery<{ data: Device[] }>({
    queryKey: ["topology", "devices"],
    queryFn: () => apiFetch("/api/devices?limit=200"),
    refetchInterval: 30_000,
  });

  const { data: interfacesData } = useQuery<DeviceInterface[]>({
    queryKey: ["topology", "interfaces"],
    queryFn: async () => {
      const devices = devicesData?.data;
      if (!devices?.length) return [];
      const results = await Promise.all(
        devices.map((d) =>
          apiFetch<DeviceInterface[]>(`/api/devices/${d.id}/interfaces`).catch(() => [])
        )
      );
      return results.flat();
    },
    enabled: !!devicesData?.data?.length,
    refetchInterval: 30_000,
  });

  const interfaceMap = useMemo(() => {
    const map = new Map<string, { inBps: number; outBps: number; speed: number }>();
    if (!interfacesData) return map;
    for (const iface of interfacesData) {
      const existing = map.get(iface.deviceId);
      const inB = iface.inBps ?? 0;
      const outB = iface.outBps ?? 0;
      const spd = iface.speed ?? 0;
      if (existing) {
        existing.inBps += inB;
        existing.outBps += outB;
        existing.speed += spd;
      } else {
        map.set(iface.deviceId, { inBps: inB, outBps: outB, speed: spd });
      }
    }
    return map;
  }, [interfacesData]);

  useEffect(() => {
    const devices = devicesData?.data;
    if (!devices?.length) return;

    const savedPositions = positionsData?.data;
    const savedMap = new Map<string, { x: number; y: number }>();
    if (savedPositions) {
      for (const p of savedPositions) savedMap.set(p.deviceId, { x: p.x, y: p.y });
    }

    const cols = Math.ceil(Math.sqrt(devices.length));
    const n: Node[] = devices.map((d, i) => {
      const saved = savedMap.get(d.id) || positionsRef.current.get(d.id);
      return {
        id: d.id,
        type: "device",
        position: saved || { x: (i % cols) * 200 + 40, y: Math.floor(i / cols) * 140 + 40 },
        data: { ...d, selected: false },
      };
    });

    const e: Edge[] = [];
    const grouped = new Map<string, Device[]>();
    for (const d of devices) {
      const k = d.groupId || "default";
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(d);
    }

    for (const [, g] of grouped) {
      for (let i = 1; i < g.length; i++) {
        const sourceIface = interfaceMap.get(g[0].id);
        const targetIface = interfaceMap.get(g[i].id);

        let utilization: number | null = null;
        let bandwidthLabel = "";
        const iface = targetIface || sourceIface;
        if (iface && iface.speed > 0) {
          utilization = ((iface.inBps + iface.outBps) / (2 * iface.speed)) * 100;
          utilization = Math.min(100, Math.max(0, utilization));
          bandwidthLabel = `${formatBps(iface.inBps + iface.outBps)} (${utilization.toFixed(0)}%)`;
        } else if (iface) {
          bandwidthLabel = formatBps(iface.inBps + iface.outBps);
        }

        e.push({
          id: `e-${g[0].id}-${g[i].id}`,
          source: g[0].id,
          target: g[i].id,
          type: "weathermap",
          data: { utilization, bandwidthLabel } satisfies WeathermapEdgeData,
          markerEnd: { type: MarkerType.ArrowClosed, color: getUtilizationColor(utilization) },
        });
      }
    }

    setNodes(n);
    setEdges(e);
  }, [devicesData, positionsData, interfaceMap, setNodes, setEdges]);

  const onNodeDragStop: NodeDragHandler = useCallback(
    (_event, node) => {
      positionsRef.current.set(node.id, { x: node.position.x, y: node.position.y });

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const positions: SavedPosition[] = [];
        for (const [deviceId, pos] of positionsRef.current) {
          positions.push({ deviceId, x: pos.x, y: pos.y });
        }
        if (positions.length > 0) savePositionsMut.mutate(positions);
      }, 500);
    },
    [savePositionsMut],
  );

  const applyBgImage = useCallback(() => {
    setBgImageUrl(bgInput.trim());
  }, [bgInput]);

  const clearBgImage = useCallback(() => {
    setBgImageUrl("");
    setBgInput("");
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Topology Weathermap</h1>
          <p className="text-xs text-muted-foreground">Network topology with traffic visualization</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Utilization legend */}
          <div className="hidden md:flex items-center gap-1.5 text-[10px]">
            {[
              { label: "0-50%", color: "#22c55e" },
              { label: "50-75%", color: "#eab308" },
              { label: "75-90%", color: "#f97316" },
              { label: "90-100%", color: "#ef4444" },
              { label: "N/A", color: "#6b7280" },
            ].map((item) => (
              <span key={item.label} className="flex items-center gap-1 rounded-full bg-accent/50 px-1.5 py-0.5">
                <span className="h-2 w-5 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">{item.label}</span>
              </span>
            ))}
          </div>
          {/* Status legend */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            {Object.entries(statusColors).map(([status, color]) => (
              <span key={status} className="flex items-center gap-1.5 rounded-full bg-accent/50 px-2 py-0.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="capitalize text-muted-foreground text-[10px]">{status}</span>
              </span>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowSettings((v) => !v)}>
            <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Settings
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <Card className="p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="bg-url" className="text-xs flex items-center gap-1.5">
                <Image className="h-3.5 w-3.5" /> Background Image URL
              </Label>
              <Input
                id="bg-url"
                placeholder="https://example.com/network-diagram.png"
                value={bgInput}
                onChange={(e) => setBgInput(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <Button size="sm" onClick={applyBgImage} className="h-8">Apply</Button>
            {bgImageUrl && (
              <Button size="sm" variant="ghost" onClick={clearBgImage} className="h-8">
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden shadow-lg border-border/50" style={{ height: "calc(100vh - 160px)" }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div
            className="h-full w-full"
            style={bgImageUrl ? {
              backgroundImage: `url(${bgImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            } : undefined}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={onNodeDragStop}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionLineType={ConnectionLineType.SmoothStep}
              fitView
              attributionPosition="bottom-left"
            >
              {!bgImageUrl && <Background gap={20} size={1} />}
              <Controls />
              <MiniMap
                nodeStrokeWidth={3}
                nodeColor={(n) => statusColors[(n.data as Device)?.status] || "#6B7280"}
                zoomable
                pannable
              />
            </ReactFlow>
          </div>
        )}
      </Card>
    </div>
  );
}
