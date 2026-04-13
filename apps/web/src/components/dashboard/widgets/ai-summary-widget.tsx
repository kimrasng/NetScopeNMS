"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import type { WidgetProps, AISummaryConfig } from "../types";

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
  aiRca?: string | null;
}

interface IncidentsResponse {
  data: Incident[];
}

export function AISummaryWidget({ id, config }: WidgetProps) {
  const cfg = config as AISummaryConfig;

  const { data, isLoading } = useQuery({
    queryKey: ["incidents", "ai-summary"],
    queryFn: () =>
      apiFetch<IncidentsResponse>("/api/incidents?limit=1&sort=createdAt:desc"),
    staleTime: 60_000,
    refetchInterval: cfg.refreshInterval ? cfg.refreshInterval * 1000 : undefined,
  });

  const incident = data?.data?.[0];
  const title = cfg.title || "AI Summary";
  const maxLen = cfg.maxLength || 500;

  const rcaText = incident?.aiRca
    ? incident.aiRca.length > maxLen
      ? `${incident.aiRca.slice(0, maxLen)}…`
      : incident.aiRca
    : null;

  return (
    <Card data-testid="widget-ai-summary" data-widget-id={id} className="h-full flex flex-col">
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-2 px-5 pt-4">
        <Sparkles className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-5 pb-4 pt-0 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
          </div>
        ) : incident ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium">{incident.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-muted-foreground capitalize">
                  {incident.severity} · {incident.status}
                </span>
                {cfg.showTimestamp !== false && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(incident.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>
            {rcaText ? (
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-xs leading-relaxed whitespace-pre-wrap">{rcaText}</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3">
                <div className="h-3 w-3 animate-pulse rounded-full bg-primary/40" />
                <p className="text-xs text-muted-foreground">AI 분석 대기 중</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No recent incidents
          </div>
        )}
      </CardContent>
    </Card>
  );
}
