"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart } from "@/components/charts/line-chart";
import { useDashboardContextStore } from "@/stores/dashboard-context";
import type { WidgetProps, TimeSeriesConfig, TimeRange } from "../types";

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: "1H", value: "1h" },
  { label: "6H", value: "6h" },
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
];

function rangeToParams(range: TimeRange): { from: string; bucket: string } {
  const now = Date.now();
  const ms: Record<TimeRange, number> = {
    "1h": 3_600_000,
    "6h": 21_600_000,
    "24h": 86_400_000,
    "7d": 604_800_000,
    "30d": 2_592_000_000,
  };
  const buckets: Record<TimeRange, string> = {
    "1h": "1 minute",
    "6h": "5 minutes",
    "24h": "15 minutes",
    "7d": "1 hour",
    "30d": "6 hours",
  };
  return {
    from: new Date(now - ms[range]).toISOString(),
    bucket: buckets[range],
  };
}

interface MetricPoint {
  time: string;
  avg_value: number;
  max_value: number;
  min_value: number;
}

interface MetricsResponse {
  data: MetricPoint[];
  meta: { deviceId: string; metric: string; from: string; to: string; bucket: string };
}

export function TimeSeriesWidget({ id, config, selectedHost }: WidgetProps) {
  const cfg = config as TimeSeriesConfig;
  const [range, setRange] = useState<TimeRange>((cfg.timeRange as TimeRange) || "1h");
  const contextHostId = useDashboardContextStore((s) => s.selectedHostId);

  const { from, bucket } = rangeToParams(range);
  const deviceId = contextHostId ?? selectedHost ?? cfg.deviceId ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["metrics", deviceId, cfg.metricName, range],
    queryFn: () => {
      const params = new URLSearchParams({
        deviceId,
        metric: cfg.metricName,
        from,
        bucket,
      });
      return apiFetch<MetricsResponse>(`/api/metrics?${params}`);
    },
    staleTime: 30_000,
    enabled: !!deviceId,
  });

  const chartData = data?.data
    ? [
        {
          id: cfg.metricName,
          data: data.data.map((p) => ({
            x: new Date(p.time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            y: Number(p.avg_value),
          })),
        },
      ]
    : [];

  return (
    <Card data-testid="widget-time-series" data-widget-id={id} className="h-full flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 px-5 pt-4">
        <CardTitle className="text-sm font-medium">{cfg.metricName}</CardTitle>
        <div className="flex gap-0.5">
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.value}
              type="button"
              onClick={() => setRange(tr.value)}
              className={cn(
                "px-2 py-0.5 text-xs rounded-md transition-colors",
                range === tr.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-5 pb-4 pt-0">
        {isLoading ? (
          <div className="h-full w-full animate-pulse rounded bg-muted" />
        ) : chartData.length > 0 && chartData[0].data.length > 0 ? (
          <LineChart
            data={chartData}
            enableArea={cfg.showArea}
            height={undefined as unknown as number}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {!deviceId ? "No device selected" : "No data available"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
