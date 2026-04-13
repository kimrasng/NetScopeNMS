"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart } from "@/components/charts/bar-chart";
import type { WidgetProps, TopNBarConfig } from "../types";

interface TopDevice {
  deviceId: string;
  deviceName: string;
  value: number;
}

interface TopDevicesResponse {
  data: TopDevice[];
}

export function TopNBarWidget({ id, config }: WidgetProps) {
  const cfg = config as TopNBarConfig;
  const metric = cfg.metric || "cpu";
  const count = cfg.count || 10;
  const sortOrder = cfg.sortOrder || "desc";
  const layout = cfg.layout || "horizontal";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "top-devices", metric, count, sortOrder],
    queryFn: () => {
      const params = new URLSearchParams({
        metric,
        limit: String(count),
        sort: sortOrder,
      });
      return apiFetch<TopDevicesResponse>(`/api/dashboard/top-devices?${params}`);
    },
    staleTime: 30_000,
  });

  const chartData = data?.data
    ? data.data.map((d) => ({
        device: d.deviceName.length > 14 ? `${d.deviceName.slice(0, 12)}…` : d.deviceName,
        [metric]: Number(d.value),
      }))
    : [];

  const title = cfg.title || `Top ${count} — ${metric.toUpperCase()}`;

  return (
    <Card data-testid="widget-top-n-bar" data-widget-id={id} className="h-full flex flex-col">
      <CardHeader className="pb-2 px-5 pt-4">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-5 pb-4 pt-0">
        {isLoading ? (
          <div className="h-full w-full animate-pulse rounded bg-muted" />
        ) : chartData.length > 0 ? (
          <BarChart
            data={chartData}
            keys={[metric]}
            indexBy="device"
            layout={layout}
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
