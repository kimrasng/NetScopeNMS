"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch, cn, formatBps } from "@/lib/utils";
import { CheckCircle, XCircle, AlertTriangle, Activity, Cpu, HardDrive, RefreshCw, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import Link from "next/link";

/* ─── Types ─── */

interface DashboardSummary {
  devices: { up_count: number; down_count: number; warning_count: number; unknown_count: number; total: number };
  incidents: { problem_count: number; acknowledged_count: number; resolved_today: number; active_count: number };
}

interface RecentAlert {
  incident: { id: string; title: string; severity: string; status: string; startedAt: string };
  deviceName: string;
  deviceIp: string;
}

interface TopDevice {
  device_id: string; name: string; ip: string; type: string; value: number; metric_name: string;
}

/* ─── Helpers ─── */

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const DEVICE_COLORS: Record<string, string> = {
  up: "#10b981",
  down: "#ef4444",
  warning: "#f59e0b",
  unknown: "#9ca3af",
};

const SEVERITY_BORDER: Record<string, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-amber-500",
  low: "border-l-blue-500",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500 shadow-[0_0_6px_1px_rgba(239,68,68,0.4)]",
  high: "bg-orange-500 shadow-[0_0_6px_1px_rgba(249,115,22,0.4)]",
  medium: "bg-amber-500 shadow-[0_0_6px_1px_rgba(245,158,11,0.4)]",
  low: "bg-blue-500 shadow-[0_0_6px_1px_rgba(59,130,246,0.4)]",
};

/** Color a usage bar by threshold */
function usageBarColor(pct: number): string {
  if (pct >= 80) return "bg-red-500";
  if (pct >= 60) return "bg-amber-500";
  return "bg-emerald-500";
}

function usageTextColor(pct: number): string {
  if (pct >= 80) return "text-red-400";
  if (pct >= 60) return "text-amber-400";
  return "text-emerald-400";
}

/* ─── Stat card themes ─── */

const STAT_THEMES: Record<string, { border: string; iconBg: string; iconColor: string; valueColor: string }> = {
  Up: {
    border: "border-l-emerald-500",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    valueColor: "text-emerald-400",
  },
  Down: {
    border: "border-l-red-500",
    iconBg: "bg-red-500/10",
    iconColor: "text-red-500",
    valueColor: "text-red-400",
  },
  Incidents: {
    border: "border-l-amber-500",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    valueColor: "text-amber-400",
  },
  Resolved: {
    border: "border-l-blue-500",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    valueColor: "text-blue-400",
  },
};

/* ─── Animated Counter ─── */

function AnimatedCount({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const start = prev.current;
    const diff = value - start;
    if (diff === 0) return;
    const duration = 600;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(tick);
      else prev.current = value;
    }
    requestAnimationFrame(tick);
  }, [value]);

  return <span className={className}>{display}</span>;
}

/* ─── Skeleton ─── */

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded bg-muted relative overflow-hidden",
        className
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <style jsx global>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <ShimmerBlock className="h-6 w-32" />
          <ShimmerBlock className="h-3.5 w-24" />
        </div>
        <ShimmerBlock className="h-4 w-28" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-l-4 border-l-muted">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2.5">
                  <ShimmerBlock className="h-3 w-14" />
                  <ShimmerBlock className="h-8 w-16" />
                </div>
                <ShimmerBlock className="h-9 w-9 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-4 space-y-3">
            <ShimmerBlock className="h-3 w-24" />
            <ShimmerBlock className="h-52" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <ShimmerBlock className="h-3 w-20" />
            <ShimmerBlock className="h-44 w-44 rounded-full mx-auto" />
          </CardContent>
        </Card>
      </div>
      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <ShimmerBlock className="h-3 w-20" />
              {[...Array(4)].map((_, j) => (
                <div key={j} className="space-y-1.5">
                  <ShimmerBlock className="h-3.5 w-full" />
                  <ShimmerBlock className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardContent className="p-4 space-y-3">
            <ShimmerBlock className="h-3 w-24" />
            {[...Array(4)].map((_, i) => (
              <ShimmerBlock key={i} className="h-12" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─── Custom Tooltip ─── */

function ThroughputTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-popover/95 backdrop-blur-sm px-3 py-2.5 shadow-xl shadow-black/20">
      <p className="text-[11px] text-muted-foreground mb-2 font-medium">
        {new Date(label).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs py-0.5">
          <span className="h-2 w-2 rounded-full ring-1 ring-white/10" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold tabular-nums text-foreground">{formatBps(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ─── */

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [topCpu, setTopCpu] = useState<TopDevice[]>([]);
  const [topMemory, setTopMemory] = useState<TopDevice[]>([]);
  const [throughput, setThroughput] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, alerts, cpu, mem, tp] = await Promise.all([
        apiFetch<DashboardSummary>("/api/dashboard/summary"),
        apiFetch<RecentAlert[]>("/api/dashboard/recent-alerts?limit=10"),
        apiFetch<TopDevice[]>("/api/dashboard/top-devices?metric=cpu&limit=5"),
        apiFetch<TopDevice[]>("/api/dashboard/top-devices?metric=memory&limit=5"),
        apiFetch<any[]>("/api/dashboard/throughput?hours=6"),
      ]);
      setSummary(s);
      setRecentAlerts(alerts);
      setTopCpu(cpu);
      setTopMemory(mem);
      setThroughput(tp);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return <DashboardSkeleton />;

  const stats = [
    { label: "Up", value: summary?.devices.up_count ?? 0, icon: CheckCircle },
    { label: "Down", value: summary?.devices.down_count ?? 0, icon: XCircle },
    { label: "Incidents", value: summary?.incidents.active_count ?? 0, icon: AlertTriangle },
    { label: "Resolved", value: summary?.incidents.resolved_today ?? 0, icon: Activity },
  ];

  const deviceStatusData = [
    { name: "Up", value: summary?.devices.up_count ?? 0, key: "up" },
    { name: "Down", value: summary?.devices.down_count ?? 0, key: "down" },
    { name: "Warning", value: summary?.devices.warning_count ?? 0, key: "warning" },
    { name: "Unknown", value: summary?.devices.unknown_count ?? 0, key: "unknown" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <span className="text-xs text-muted-foreground">{summary?.devices.total ?? 0} devices monitored</span>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-[spin_3s_linear_infinite] opacity-40" />
            <span>Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          </div>
        )}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => {
          const theme = STAT_THEMES[s.label];
          return (
            <Card
              key={s.label}
              className={cn(
                "border-l-4 transition-shadow hover:shadow-md hover:shadow-black/5",
                theme.border
              )}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{s.label}</div>
                  <AnimatedCount
                    value={s.value}
                    className={cn("text-2xl font-bold tabular-nums", theme.valueColor)}
                  />
                </div>
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", theme.iconBg, theme.iconColor)}>
                  <s.icon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Throughput Chart */}
        <Card className="lg:col-span-2 transition-shadow hover:shadow-md hover:shadow-black/5">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Throughput (6h)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-2">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={throughput}>
                  <defs>
                    <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => formatBps(v)}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                    className="fill-muted-foreground"
                  />
                  <Tooltip content={<ThroughputTooltip />} />
                  <Area type="monotone" dataKey="total_in" name="In" stroke="hsl(217, 91%, 60%)" fill="url(#gradIn)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="total_out" name="Out" stroke="#10b981" fill="url(#gradOut)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Device Status Donut */}
        <Card className="transition-shadow hover:shadow-md hover:shadow-black/5">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Device Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 flex flex-col items-center justify-center">
            <div className="relative">
              <PieChart width={180} height={180}>
                <Pie
                  data={deviceStatusData}
                  cx={90}
                  cy={90}
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {deviceStatusData.map((entry) => (
                    <Cell key={entry.key} fill={DEVICE_COLORS[entry.key]} />
                  ))}
                </Pie>
              </PieChart>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold tabular-nums">{summary?.devices.total ?? 0}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</span>
              </div>
            </div>
            {/* Legend */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
              {[
                { label: "Up", key: "up", value: summary?.devices.up_count ?? 0 },
                { label: "Down", key: "down", value: summary?.devices.down_count ?? 0 },
                { label: "Warning", key: "warning", value: summary?.devices.warning_count ?? 0 },
                { label: "Unknown", key: "unknown", value: summary?.devices.unknown_count ?? 0 },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: DEVICE_COLORS[item.key] }} />
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium tabular-nums ml-auto">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: CPU/Memory + Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Top CPU */}
        <UsageCard title="CPU" icon={<Cpu className="h-3.5 w-3.5" />} data={topCpu} />

        {/* Top Memory */}
        <UsageCard title="Memory" icon={<HardDrive className="h-3.5 w-3.5" />} data={topMemory} />

        {/* Recent Alerts */}
        <Card className="md:col-span-2 lg:col-span-1 transition-shadow hover:shadow-md hover:shadow-black/5">
          <CardHeader className="p-3 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Recent Alerts
              </CardTitle>
              {recentAlerts.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {recentAlerts.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-60">
              <div className="px-3 pb-3 pt-2 space-y-1">
                {recentAlerts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No alerts</p>
                ) : (
                  recentAlerts.map((a) => (
                    <Link
                      key={a.incident.id}
                      href={`/incidents/${a.incident.id}`}
                      className={cn(
                        "block rounded-md border-l-[3px] pl-2.5 pr-2 py-2 hover:bg-accent/50 transition-colors",
                        SEVERITY_BORDER[a.incident.severity] ?? "border-l-border"
                      )}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            SEVERITY_DOT[a.incident.severity] ?? "bg-muted-foreground"
                          )} />
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">{a.incident.severity}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{timeAgo(a.incident.startedAt)}</span>
                      </div>
                      <div className="text-xs font-medium truncate">{a.incident.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{a.deviceName} · {a.deviceIp}</div>
                    </Link>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─── Usage Card (CPU / Memory) ─── */

function UsageCard({ title, icon, data }: { title: string; icon: React.ReactNode; data: TopDevice[] }) {
  return (
    <Card className="transition-shadow hover:shadow-md hover:shadow-black/5">
      <CardHeader className="p-3 pb-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          {icon} Top {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-2">
        <div className="space-y-3">
          {data.map((d) => {
            const pct = Math.min(d.value, 100);
            return (
              <div key={d.device_id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{d.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{d.ip}</div>
                  </div>
                  <span className={cn("text-sm font-bold tabular-nums ml-2", usageTextColor(pct))}>
                    {d.value.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700 ease-out", usageBarColor(pct))}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {data.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No data</p>}
        </div>
      </CardContent>
    </Card>
  );
}
