"use client";

import { useEffect, useState, useCallback } from "react";
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType, ConnectionLineType,
} from "reactflow";
import "reactflow/dist/style.css";
import { apiFetch, cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const statusColors: Record<string, string> = { up: "#16A34A", down: "#DC2626", warning: "#CA8A04", unknown: "#6B7280", maintenance: "#7C3AED" };
const statusGlow: Record<string, string> = {
  up: "0 0 12px -2px rgba(22,163,74,0.45), 0 0 4px -1px rgba(22,163,74,0.2)",
  down: "0 0 12px -2px rgba(220,38,38,0.45), 0 0 4px -1px rgba(220,38,38,0.2)",
  warning: "0 0 12px -2px rgba(202,138,4,0.45), 0 0 4px -1px rgba(202,138,4,0.2)",
  maintenance: "0 0 12px -2px rgba(124,58,237,0.45), 0 0 4px -1px rgba(124,58,237,0.2)",
  unknown: "none",
};
const typeLabel: Record<string, string> = { router: "R", switch: "S", server: "SV", firewall: "FW", access_point: "AP", load_balancer: "LB", storage: "ST", other: "?" };

interface Device { id: string; name: string; ip: string; type: string; status: string; location?: string; groupId?: string; }

function DeviceNode({ data }: { data: Device & { selected: boolean } }) {
  return (
    <div
      className={cn(
        "rounded-lg border-2 bg-card px-3 py-2.5 shadow-md min-w-[130px] text-center transition-shadow hover:shadow-lg",
        data.selected && "ring-2 ring-primary ring-offset-1 ring-offset-background"
      )}
      style={{
        borderColor: statusColors[data.status] || statusColors.unknown,
        boxShadow: statusGlow[data.status] || statusGlow.unknown,
      }}
    >
      <div
        className="flex items-center justify-center h-7 w-7 mx-auto mb-1.5 rounded-md text-[10px] font-bold text-white shadow-sm"
        style={{ backgroundColor: statusColors[data.status] || statusColors.unknown }}
      >
        {typeLabel[data.type] || "?"}
      </div>
      <div className="text-xs font-medium truncate">{data.name}</div>
      <div className="text-[10px] text-muted-foreground font-mono">{data.ip}</div>
    </div>
  );
}

const nodeTypes = { device: DeviceNode };

export default function TopologyPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ data: Device[] }>("/api/devices?limit=200");
      const devices = data.data;
      const cols = Math.ceil(Math.sqrt(devices.length));
      const n: Node[] = devices.map((d, i) => ({ id: d.id, type: "device", position: { x: (i % cols) * 200 + 40, y: Math.floor(i / cols) * 140 + 40 }, data: { ...d, selected: false } }));
      const e: Edge[] = [];
      const grouped = new Map<string, Device[]>();
      for (const d of devices) { const k = d.groupId || "default"; if (!grouped.has(k)) grouped.set(k, []); grouped.get(k)!.push(d); }
      for (const [, g] of grouped) { for (let i = 1; i < g.length; i++) { e.push({ id: `e-${g[0].id}-${g[i].id}`, source: g[0].id, target: g[i].id, type: "smoothstep", animated: g[i].status === "up", style: { stroke: g[i].status === "down" ? "#DC2626" : "#64748b", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed } }); } }
      setNodes(n); setEdges(e);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [setNodes, setEdges]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Topology</h1>
          <p className="text-xs text-muted-foreground">Network device topology map</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs">
            {Object.entries(statusColors).map(([status, color]) => (
              <span key={status} className="flex items-center gap-1.5 rounded-full bg-accent/50 px-2 py-0.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="capitalize text-muted-foreground text-[10px]">{status}</span>
              </span>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh</Button>
        </div>
      </div>
      <Card className="overflow-hidden shadow-lg border-border/50" style={{ height: "calc(100vh - 160px)" }}>
        {loading ? (
          <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" /></div>
        ) : (
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={nodeTypes} connectionLineType={ConnectionLineType.SmoothStep} fitView attributionPosition="bottom-left">
            <Background gap={20} size={1} />
            <Controls />
            <MiniMap nodeStrokeWidth={3} nodeColor={n => statusColors[(n.data as Device)?.status] || "#6B7280"} zoomable pannable />
          </ReactFlow>
        )}
      </Card>
    </div>
  );
}
