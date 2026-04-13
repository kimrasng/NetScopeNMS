"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WidgetProps, SystemInfoConfig } from "../types";
import type { DashboardSummary } from "@/hooks/queries/use-dashboard";

interface HealthResponse {
  status: string;
  uptime?: number;
  version?: string;
  timestamp?: string;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function SystemInfoWidget({ id, config }: WidgetProps) {
  const cfg = config as SystemInfoConfig;

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiFetch<DashboardSummary>("/api/dashboard/summary"),
    staleTime: 30_000,
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<HealthResponse>("/api/health"),
    staleTime: 60_000,
  });

  const isLoading = summaryLoading || healthLoading;
  const title = cfg.title || "System Info";

  const entries: { label: string; value: string }[] = [];

  if (cfg.showUptime !== false && health?.uptime != null) {
    entries.push({ label: "Uptime", value: formatUptime(health.uptime) });
  }
  if (cfg.showVersion !== false && health?.version) {
    entries.push({ label: "Version", value: health.version });
  }
  if (health?.status) {
    entries.push({ label: "Status", value: health.status });
  }
  if (cfg.showDeviceCount !== false && summary) {
    entries.push({ label: "Total Devices", value: String(summary.devices.total) });
    entries.push({ label: "Devices Up", value: String(summary.devices.up_count) });
    entries.push({ label: "Devices Down", value: String(summary.devices.down_count) });
  }
  if (cfg.showPollingStatus !== false && summary) {
    entries.push({ label: "Active Incidents", value: String(summary.incidents.active_count) });
    entries.push({ label: "Resolved Today", value: String(summary.incidents.resolved_today) });
  }

  return (
    <Card data-testid="widget-system-info" data-widget-id={id} className="h-full flex flex-col">
      <CardHeader className="pb-2 px-5 pt-4">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-5 pb-4 pt-0">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-5 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : entries.length > 0 ? (
          <dl className="space-y-1.5">
            {entries.map((entry) => (
              <div key={entry.label} className="flex items-center justify-between text-xs">
                <dt className="text-muted-foreground">{entry.label}</dt>
                <dd className="font-medium tabular-nums">{entry.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
