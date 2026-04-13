"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Server, Wifi } from "lucide-react";
import { apiFetch, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { WidgetProps, StatCardConfig } from "../types";
import type { DashboardSummary } from "@/hooks/queries/use-dashboard";

const ICON_MAP: Record<string, typeof Activity> = {
  activity: Activity,
  server: Server,
  wifi: Wifi,
  alert: AlertTriangle,
};

function resolveMetricValue(
  summary: DashboardSummary,
  metric: string
): number {
  switch (metric) {
    case "device_count":
      return Number(summary.devices.total);
    case "device_up":
      return Number(summary.devices.up_count);
    case "device_down":
      return Number(summary.devices.down_count);
    case "incident_count":
      return Number(summary.incidents.active_count);
    case "incident_problem":
      return Number(summary.incidents.problem_count);
    case "resolved_today":
      return Number(summary.incidents.resolved_today);
    case "uptime": {
      const total = Number(summary.devices.total);
      if (total === 0) return 0;
      return Math.round((Number(summary.devices.up_count) / total) * 100);
    }
    default:
      return 0;
  }
}

function useAnimatedCounter(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const from = value;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

function getThresholdState(
  value: number,
  warning?: number,
  critical?: number
): "normal" | "warning" | "critical" {
  if (critical != null && value >= critical) return "critical";
  if (warning != null && value >= warning) return "warning";
  return "normal";
}

const THRESHOLD_STYLES = {
  normal: "",
  warning: "text-warning glow-warning",
  critical: "text-destructive glow-danger",
} as const;

export function StatCardWidget({ id, config }: WidgetProps) {
  const cfg = config as StatCardConfig;

  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiFetch<DashboardSummary>("/api/dashboard/summary"),
    staleTime: 30_000,
  });

  const rawValue = summary ? resolveMetricValue(summary, cfg.metric) : 0;
  const animatedValue = useAnimatedCounter(rawValue);
  const state = getThresholdState(
    rawValue,
    cfg.thresholdWarning,
    cfg.thresholdCritical
  );

  const IconComp = ICON_MAP[cfg.icon ?? "activity"] ?? Activity;
  const suffix = cfg.metric === "uptime" ? "%" : "";

  return (
    <Card
      data-testid="widget-stat-card"
      data-widget-id={id}
      className={cn(
        "h-full flex flex-col justify-center",
        THRESHOLD_STYLES[state]
      )}
    >
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
            state === "critical"
              ? "bg-destructive/10"
              : state === "warning"
                ? "bg-warning/10"
                : "bg-primary/10"
          )}
        >
          <IconComp
            className={cn(
              "h-5 w-5",
              state === "critical"
                ? "text-destructive"
                : state === "warning"
                  ? "text-warning"
                  : "text-primary"
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground truncate">{cfg.title}</p>
          {isLoading ? (
            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {animatedValue.toLocaleString()}
              {suffix}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
