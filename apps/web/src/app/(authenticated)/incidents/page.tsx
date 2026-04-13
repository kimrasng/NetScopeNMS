"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Clock, ChevronRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Incident {
  id: string; title: string; severity: string; status: string;
  metricName?: string; metricValue?: number; startedAt: string;
  resolvedAt?: string; aiSummary?: string; deviceName?: string; deviceIp?: string;
}
interface Pagination { page: number; limit: number; total: number; totalPages: number; }

const sevDot: Record<string, string> = { critical: "bg-red-500", high: "bg-orange-500", medium: "bg-amber-500", low: "bg-blue-500" };
const sevBorder: Record<string, string> = { critical: "border-l-red-500", high: "border-l-orange-500", medium: "border-l-amber-500", low: "border-l-blue-500" };
const sevGlow: Record<string, string> = {
  critical: "shadow-red-500/20",
  high: "shadow-orange-500/20",
  medium: "shadow-amber-500/20",
  low: "shadow-blue-500/20",
};

const statusIcon: Record<string, React.ReactNode> = {
  problem: (
    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-500/15">
      <AlertTriangle className="h-3 w-3 text-red-500" />
    </span>
  ),
  acknowledged: (
    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500/15">
      <Clock className="h-3 w-3 text-amber-500" />
    </span>
  ),
  resolved: (
    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500/15">
      <CheckCircle className="h-3 w-3 text-emerald-500" />
    </span>
  ),
};

const statusLabel: Record<string, string> = {
  problem: "text-red-400",
  acknowledged: "text-amber-400",
  resolved: "text-emerald-400",
};

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: "50" });
      if (statusFilter) p.set("status", statusFilter);
      if (severityFilter) p.set("severity", severityFilter);
      const data = await apiFetch<{ data: Incident[]; pagination: Pagination }>(`/api/incidents?${p}`);
      setIncidents(data.data); setPagination(data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter, severityFilter]);

  const ack = async (id: string) => {
    try {
      await apiFetch(`/api/incidents/${id}/acknowledge`, { method: "POST", body: JSON.stringify({}) });
      toast.success("Incident acknowledged");
      load(pagination.page);
    } catch (err) {
      console.error(err);
      toast.error("Failed to acknowledge incident");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Incidents</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pagination.total} total incident{pagination.total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary cursor-pointer"
        >
          <option value="">All Status</option>
          <option value="problem">Problem</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary cursor-pointer"
        >
          <option value="">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {(statusFilter || severityFilter) && (
          <button
            onClick={() => { setStatusFilter(""); setSeverityFilter(""); }}
            className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="border-l-4 border-l-muted">
                <CardContent className="p-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 bg-muted animate-pulse rounded-full" />
                      <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                      <div className="h-5 w-5 bg-muted animate-pulse rounded-full" />
                      <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                    </div>
                    <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                    <div className="flex gap-3">
                      <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-sm text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
              No incidents found
            </CardContent>
          </Card>
        ) : incidents.map(inc => (
          <Card
            key={inc.id}
            className={cn(
              "border-l-4 hover:bg-accent/40 hover:shadow-md group",
              sevBorder[inc.severity],
              sevGlow[inc.severity],
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5">
                    <span className={cn("h-2 w-2 rounded-full ring-2 ring-offset-1 ring-offset-card", sevDot[inc.severity], {
                      "ring-red-500/30": inc.severity === "critical",
                      "ring-orange-500/30": inc.severity === "high",
                      "ring-amber-500/30": inc.severity === "medium",
                      "ring-blue-500/30": inc.severity === "low",
                    })} />
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">{inc.severity}</span>
                    <span className="flex items-center gap-1.5">
                      {statusIcon[inc.status]}
                      <span className={cn("text-[10px] font-medium capitalize", statusLabel[inc.status])}>{inc.status}</span>
                    </span>
                  </div>

                  <Link href={`/incidents/${inc.id}`} className="text-sm font-medium hover:text-primary block truncate group-hover:text-primary">
                    {inc.title}
                  </Link>

                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    {inc.deviceName && <span className="font-mono text-[10px]">{inc.deviceName} ({inc.deviceIp})</span>}
                    {inc.metricName && (
                      <span className="px-1.5 py-0.5 rounded bg-muted text-[10px]">
                        {inc.metricName}: {inc.metricValue}
                      </span>
                    )}
                    <span>{timeAgo(inc.startedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {inc.status === "problem" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/50"
                      onClick={() => ack(inc.id)}
                    >
                      Ack
                    </Button>
                  )}
                  <Link href={`/incidents/${inc.id}`}>
                    <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
                      View <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="text-xs" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Prev</Button>
            <Button variant="outline" size="sm" className="text-xs" disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
