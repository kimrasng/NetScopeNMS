"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart } from "@/components/charts/pie-chart";
import type { WidgetProps, PieChartConfig } from "../types";
import type { DashboardSummary } from "@/hooks/queries/use-dashboard";

function buildDeviceStatusData(summary: DashboardSummary) {
  return [
    { id: "Up", value: Number(summary.devices.up_count), label: "Up" },
    { id: "Down", value: Number(summary.devices.down_count), label: "Down" },
    { id: "Warning", value: Number(summary.devices.warning_count), label: "Warning" },
    { id: "Unknown", value: Number(summary.devices.unknown_count), label: "Unknown" },
    { id: "Maintenance", value: Number(summary.devices.maintenance_count), label: "Maintenance" },
  ].filter((d) => d.value > 0);
}

function buildIncidentSeverityData(summary: DashboardSummary) {
  return [
    { id: "Problem", value: Number(summary.incidents.problem_count), label: "Problem" },
    { id: "Acknowledged", value: Number(summary.incidents.acknowledged_count), label: "Acknowledged" },
    { id: "Resolved Today", value: Number(summary.incidents.resolved_today), label: "Resolved Today" },
  ].filter((d) => d.value > 0);
}

export function PieChartWidget({ id, config }: WidgetProps) {
  const cfg = config as PieChartConfig;

  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiFetch<DashboardSummary>("/api/dashboard/summary"),
    staleTime: 30_000,
  });

  const title = cfg.title ?? (cfg.dataSource === "incident_severity" ? "Incidents" : "Device Status");

  const chartData = summary
    ? cfg.dataSource === "incident_severity"
      ? buildIncidentSeverityData(summary)
      : buildDeviceStatusData(summary)
    : [];

  return (
    <Card data-testid="widget-pie-chart" data-widget-id={id} className="h-full flex flex-col">
      <CardHeader className="pb-2 px-5 pt-4">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-5 pb-4 pt-0">
        {isLoading ? (
          <div className="h-full w-full animate-pulse rounded bg-muted" />
        ) : chartData.length > 0 ? (
          <PieChart
            data={chartData}
            innerRadius={cfg.innerRadius}
            enableArcLabels={cfg.enableArcLabels}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
