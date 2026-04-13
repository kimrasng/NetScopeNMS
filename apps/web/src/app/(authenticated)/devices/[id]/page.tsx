"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, cn, formatBps } from "@/lib/utils";
import { ArrowLeft, Cpu, HardDrive, Wifi, RefreshCw, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart } from "@/components/charts/line-chart";

interface Device {
  id: string; name: string; ip: string; type: string; status: string;
  location?: string; vendor?: string; model?: string; osVersion?: string;
  sysDescr?: string; pollingInterval: number; lastPolledAt?: string;
  interfaces?: DeviceInterface[];
}
interface DeviceInterface { id: string; ifIndex: number; name: string; status: string; speed?: number; inBps: number; outBps: number; alias?: string; }
interface MetricPoint { time: string; avg_value: number; max_value: number; min_value: number; }

const dot: Record<string, string> = { up: "bg-emerald-500", down: "bg-red-500", warning: "bg-amber-500", unknown: "bg-gray-400", maintenance: "bg-violet-500" };

const dotGlow: Record<string, string> = {
  up: "shadow-[0_0_6px_1px_rgba(16,185,129,0.4)]", down: "shadow-[0_0_6px_1px_rgba(239,68,68,0.4)]", warning: "shadow-[0_0_6px_1px_rgba(245,158,11,0.4)]", unknown: "", maintenance: "shadow-[0_0_6px_1px_rgba(139,92,246,0.4)]",
};

const metricColors: Record<string, { text: string; bg: string; border: string }> = {
  blue:    { text: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-950/30",     border: "border-blue-200 dark:border-blue-800/40" },
  green:   { text: "text-green-600 dark:text-green-400",   bg: "bg-green-50 dark:bg-green-950/30",   border: "border-green-200 dark:border-green-800/40" },
  amber:   { text: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-950/30",   border: "border-amber-200 dark:border-amber-800/40" },
  emerald: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800/40" },
  red:     { text: "text-red-600 dark:text-red-400",       bg: "bg-red-50 dark:bg-red-950/30",       border: "border-red-200 dark:border-red-800/40" },
  violet:  { text: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800/40" },
};

function DeviceDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-muted animate-pulse rounded" />
        <div className="space-y-1.5 flex-1">
          <div className="h-5 w-48 bg-muted animate-pulse rounded" />
          <div className="h-3 w-32 bg-muted animate-pulse rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-3"><div className="h-16 bg-muted animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-3"><div className="h-40 bg-muted animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
    </div>
  );
}

function MetricSummaryCard({ label, value, unit, color, icon, format }: {
  label: string;
  value: number | string | null | undefined;
  unit?: string;
  color: string;
  icon?: React.ReactNode;
  format?: (v: number) => string;
}) {
  const c = metricColors[color] || metricColors.blue;
  const display = value == null
    ? "—"
    : typeof value === "string"
      ? value
      : format
        ? format(value)
        : `${value.toFixed(1)}${unit || ""}`;

  return (
    <Card className={cn("border overflow-hidden", c.border, c.bg)}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon && <span className={cn(c.text, "opacity-80")}>{icon}</span>}
          <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
        </div>
        <div className={cn("text-xl font-bold tracking-tight", c.text)}>{display}</div>
      </CardContent>
    </Card>
  );
}

export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deviceId = params.id as string;
  const [device, setDevice] = useState<Device | null>(null);
  const [cpuData, setCpuData] = useState<MetricPoint[]>([]);
  const [memData, setMemData] = useState<MetricPoint[]>([]);
  const [bwData, setBwData] = useState<MetricPoint[]>([]);
  const [bwOutData, setBwOutData] = useState<MetricPoint[]>([]);
  const [timeRange, setTimeRange] = useState("1h");
  const [loading, setLoading] = useState(true);

  const ranges: Record<string, { from: string; bucket: string }> = {
    "1h": { from: new Date(Date.now() - 3600000).toISOString(), bucket: "1 minute" },
    "6h": { from: new Date(Date.now() - 21600000).toISOString(), bucket: "5 minutes" },
    "24h": { from: new Date(Date.now() - 86400000).toISOString(), bucket: "15 minutes" },
    "7d": { from: new Date(Date.now() - 604800000).toISOString(), bucket: "1 hour" },
    "30d": { from: new Date(Date.now() - 2592000000).toISOString(), bucket: "6 hours" },
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = ranges[timeRange];
      const [dev, cpu, mem, bw, bwOut] = await Promise.all([
        apiFetch<Device>(`/api/devices/${deviceId}`),
        apiFetch<{ data: MetricPoint[] }>(`/api/metrics?deviceId=${deviceId}&metric=cpu&from=${r.from}&bucket=${r.bucket}`),
        apiFetch<{ data: MetricPoint[] }>(`/api/metrics?deviceId=${deviceId}&metric=memory&from=${r.from}&bucket=${r.bucket}`),
        apiFetch<{ data: MetricPoint[] }>(`/api/metrics?deviceId=${deviceId}&metric=bandwidth_in&from=${r.from}&bucket=${r.bucket}`),
        apiFetch<{ data: MetricPoint[] }>(`/api/metrics?deviceId=${deviceId}&metric=bandwidth_out&from=${r.from}&bucket=${r.bucket}`),
      ]);
      setDevice(dev); setCpuData(cpu.data || []); setMemData(mem.data || []); setBwData(bw.data || []); setBwOutData(bwOut.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [deviceId, timeRange]);

  if (loading && !device) return <DeviceDetailSkeleton />;
  if (!device) return <div className="text-center py-12 text-xs text-muted-foreground">Device not found</div>;

  const latestCpu = cpuData.length > 0 ? cpuData[cpuData.length - 1].avg_value : null;
  const latestMem = memData.length > 0 ? memData[memData.length - 1].avg_value : null;
  const latestBwIn = bwData.length > 0 ? bwData[bwData.length - 1].avg_value : null;
  const latestBwOut = bwOutData.length > 0 ? bwOutData[bwOutData.length - 1].avg_value : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-md p-1.5 hover:bg-accent active:scale-95 transition-all"><ArrowLeft className="h-4 w-4" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", dot[device.status] || dot.unknown, dotGlow[device.status] || "")} />
            <h1 className="text-lg font-semibold tracking-tight">{device.name}</h1>
            <span className="text-xs text-muted-foreground font-mono">{device.ip}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="capitalize">{device.type.replace("_"," ")}</span>
            {device.vendor && <span>{device.vendor} {device.model}</span>}
            {device.location && <span>{device.location}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {Object.keys(ranges).map(r => (
            <Button key={r} variant={timeRange === r ? "default" : "ghost"} size="sm" onClick={() => setTimeRange(r)} className="text-xs h-7 px-2">
              {r}
            </Button>
          ))}
          <button onClick={load} className="rounded-md p-1.5 hover:bg-accent active:scale-95 transition-all ml-1"><RefreshCw className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricSummaryCard label="CPU" value={latestCpu} unit="%" color="blue" icon={<Cpu className="h-3.5 w-3.5" />} />
        <MetricSummaryCard label="Memory" value={latestMem} unit="%" color="green" icon={<HardDrive className="h-3.5 w-3.5" />} />
        <MetricSummaryCard label="Bandwidth In" value={latestBwIn} color="amber" icon={<Wifi className="h-3.5 w-3.5" />} format={formatBps} />
        <MetricSummaryCard label="Status" value={device.status} color={device.status === "up" ? "emerald" : "red"} icon={<Activity className="h-3.5 w-3.5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MiniChart title="CPU" icon={<Cpu className="h-3.5 w-3.5" />} data={cpuData} unit="%" color="#3b82f6" />
        <MiniChart title="Memory" icon={<HardDrive className="h-3.5 w-3.5" />} data={memData} unit="%" color="#22c55e" />
        <MiniChart title="Bandwidth In" icon={<Wifi className="h-3.5 w-3.5" />} data={bwData} unit="bps" color="#f59e0b" />
        <MiniChart title="Bandwidth Out" icon={<Wifi className="h-3.5 w-3.5" />} data={bwOutData} unit="bps" color="#8b5cf6" />
      </div>

      {device.interfaces && device.interfaces.length > 0 && (
        <Card>
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Interfaces ({device.interfaces.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Idx</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">In</TableHead><TableHead className="text-right">Out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {device.interfaces.map(i => (
                  <TableRow key={i.id} className={cn("hover:bg-accent/50 transition-colors", i.status === "down" && "bg-red-500/5 dark:bg-red-950/30")}>
                    <TableCell className="font-mono text-xs">{i.ifIndex}</TableCell>
                    <TableCell className="text-xs font-medium">{i.name}</TableCell>
                    <TableCell><span className={cn("inline-block h-1.5 w-1.5 rounded-full mr-1.5", i.status === "up" ? "bg-emerald-500 shadow-[0_0_4px_1px_rgba(16,185,129,0.35)]" : "bg-red-500 shadow-[0_0_4px_1px_rgba(239,68,68,0.35)]")} /><span className="text-xs">{i.status}</span></TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatBps(i.inBps)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatBps(i.outBps)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MiniChart({ title, icon, data, unit }: { title: string; icon: React.ReactNode; data: MetricPoint[]; unit: string; color: string }) {
  const nivoData = useMemo(() => {
    if (data.length === 0) return [];
    return [
      {
        id: title,
        data: data.map((d) => ({
          x: new Date(d.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          y: d.avg_value,
        })),
      },
    ];
  }, [data, title]);

  return (
    <Card>
      <CardHeader className="p-3 pb-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-2">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">No data</div>
        ) : (
          <LineChart
            data={nivoData}
            yLabel={unit === "%" ? "%" : unit === "bps" ? "bps" : undefined}
            enableArea
            height={160}
          />
        )}
      </CardContent>
    </Card>
  );
}
