"use client";

import { useEffect, useState } from "react";
import { apiFetch, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Report { id: string; type: string; title: string; period?: string; aiSummary?: string; generatedAt: string; }

const typeAccents: Record<string, { border: string; bg: string; text: string; icon: string; hoverBg: string; hoverText: string }> = {
  availability: { border: "border-emerald-500/30", bg: "bg-emerald-500/10", text: "text-emerald-500", icon: "text-emerald-500", hoverBg: "hover:bg-emerald-500/10", hoverText: "hover:text-emerald-500" },
  performance: { border: "border-blue-500/30", bg: "bg-blue-500/10", text: "text-blue-500", icon: "text-blue-500", hoverBg: "hover:bg-blue-500/10", hoverText: "hover:text-blue-500" },
  alert_summary: { border: "border-amber-500/30", bg: "bg-amber-500/10", text: "text-amber-500", icon: "text-amber-500", hoverBg: "hover:bg-amber-500/10", hoverText: "hover:text-amber-500" },
  ai_narrative: { border: "border-violet-500/30", bg: "bg-violet-500/10", text: "text-violet-500", icon: "text-violet-500", hoverBg: "hover:bg-violet-500/10", hoverText: "hover:text-violet-500" },
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const toast = useToast();

  const load = async () => { try { setReports(await apiFetch<Report[]>("/api/reports")); } catch {} finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const gen = async (type: string, period: string) => {
    setGenerating(true);
    try { await apiFetch("/api/reports/generate", { method: "POST", body: JSON.stringify({ type, period }) }); toast.success("Report generated"); load(); }
    catch { toast.error("Failed to generate report"); } finally { setGenerating(false); }
  };

  const types = [
    { type: "availability", label: "Availability", desc: "Uptime & SLA" },
    { type: "performance", label: "Performance", desc: "CPU, memory, bandwidth" },
    { type: "alert_summary", label: "Alert Summary", desc: "Incidents & MTTR" },
    { type: "ai_narrative", label: "Narrative", desc: "Health summary" },
  ];

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold tracking-tight">Reports</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {types.map(t => {
          const accent = typeAccents[t.type] || typeAccents.availability;
          return (
            <Card key={t.type} className={cn("border-t-2 hover:shadow-md transition-shadow", accent.border)}>
              <CardContent className="p-3">
                <div className={cn("text-xs font-medium mb-0.5", accent.text)}>{t.label}</div>
                <div className="text-[11px] text-muted-foreground mb-2">{t.desc}</div>
                <div className="flex gap-1.5">
                  {["weekly","monthly"].map(p => (
                    <Button key={p} variant="outline" size="sm" className={cn("text-[11px] h-6 px-2 capitalize hover:border-current", accent.hoverBg, accent.hoverText)} onClick={() => gen(t.type, p)} disabled={generating}>{p}</Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">History</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-2">
          {loading ? (
            <div className="space-y-3 p-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                ))}
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">No reports yet</div>
          ) : (
            <div className="divide-y divide-border/50">
              {reports.map(r => {
                const accent = typeAccents[r.type] || typeAccents.availability;
                return (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-accent/50 transition-colors group">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("rounded-md p-1.5", accent.bg)}>
                        <FileText className={cn("h-3.5 w-3.5", accent.icon)} />
                      </div>
                      <div>
                        <div className="text-xs font-medium">{r.title}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          {r.period && <span className="capitalize">{r.period}</span>}
                          <span>{new Date(r.generatedAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <button className="rounded-md p-1.5 hover:bg-accent text-muted-foreground opacity-0 group-hover:opacity-100 transition-all"><Download className="h-3.5 w-3.5" /></button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
