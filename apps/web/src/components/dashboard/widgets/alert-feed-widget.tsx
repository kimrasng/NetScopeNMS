"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiFetch, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import type { WidgetProps, AlertFeedConfig } from "../types";

interface AlertItem {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
  deviceName?: string;
}

interface RecentAlertsResponse {
  data: AlertItem[];
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-l-red-500 bg-red-50/50 dark:bg-red-950/30",
  high: "border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/30",
  warning: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/30",
  medium: "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/30",
  low: "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/30",
  info: "border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/30",
};

const SEVERITY_ICON: Record<string, typeof AlertTriangle> = {
  critical: AlertCircle,
  high: AlertTriangle,
  warning: AlertTriangle,
  medium: Info,
  low: Info,
  info: Info,
};

const SEVERITY_TEXT: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400",
  high: "text-orange-600 dark:text-orange-400",
  warning: "text-amber-600 dark:text-amber-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-blue-600 dark:text-blue-400",
  info: "text-blue-500 dark:text-blue-400",
};

export function AlertFeedWidget({ id, config }: WidgetProps) {
  const cfg = config as AlertFeedConfig;
  const router = useRouter();
  const maxItems = cfg.maxItems || 20;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "recent-alerts", maxItems],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(maxItems) });
      if (cfg.severityFilter?.length) {
        params.set("severity", cfg.severityFilter.join(","));
      }
      return apiFetch<RecentAlertsResponse>(`/api/dashboard/recent-alerts?${params}`);
    },
    staleTime: 15_000,
  });

  const alerts = data?.data ?? [];
  const title = cfg.title || "Recent Alerts";

  return (
    <Card data-testid="widget-alert-feed" data-widget-id={id} className="h-full flex flex-col">
      <CardHeader className="pb-2 px-5 pt-4">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto px-5 pb-4 pt-0 space-y-1.5">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : alerts.length > 0 ? (
          alerts.map((alert) => {
            const Icon = SEVERITY_ICON[alert.severity] ?? Info;
            return (
              <button
                key={alert.id}
                type="button"
                onClick={() => router.push(`/incidents/${alert.id}`)}
                className={cn(
                  "w-full text-left rounded-md border-l-[3px] px-3 py-2 transition-colors hover:bg-accent/50",
                  SEVERITY_STYLES[alert.severity] ?? "border-l-gray-300"
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", SEVERITY_TEXT[alert.severity])} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{alert.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {alert.deviceName && (
                        <span className="text-[10px] text-muted-foreground font-mono truncate">
                          {alert.deviceName}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                        {new Date(alert.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No recent alerts
          </div>
        )}
      </CardContent>
    </Card>
  );
}
