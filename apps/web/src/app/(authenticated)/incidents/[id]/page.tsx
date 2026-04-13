"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, cn } from "@/lib/utils";
import { ArrowLeft, Send, Clock, MessageSquare, Sparkles, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

interface IncidentDetail {
  id: string; title: string; severity: string; status: string;
  metricName?: string; metricValue?: number; aiRca?: string; aiSummary?: string;
  startedAt: string; resolvedAt?: string; acknowledgedAt?: string;
  device?: { id: string; name: string; ip: string; type: string };
  rule?: { name: string; threshold: number; operator: string };
  events?: IncidentEvent[];
}
interface IncidentEvent { id: string; type: string; message: string; createdAt: string; metadata?: Record<string, unknown>; }

const sevDot: Record<string, string> = { critical: "bg-red-500", high: "bg-orange-500", medium: "bg-amber-500", low: "bg-blue-500" };
const sevGlow: Record<string, string> = {
  critical: "shadow-[0_0_10px_-2px_rgba(239,68,68,0.5)]",
  high: "shadow-[0_0_10px_-2px_rgba(249,115,22,0.5)]",
  medium: "shadow-[0_0_10px_-2px_rgba(245,158,11,0.5)]",
  low: "shadow-[0_0_10px_-2px_rgba(59,130,246,0.5)]",
};
const eventDot: Record<string, string> = { comment: "bg-blue-500", acknowledged: "bg-amber-500", resolved: "bg-emerald-500", ai_analysis: "bg-purple-500", created: "bg-red-500" };
const eventGlow: Record<string, string> = {
  comment: "shadow-[0_0_8px_-1px_rgba(59,130,246,0.5)]",
  acknowledged: "shadow-[0_0_8px_-1px_rgba(245,158,11,0.5)]",
  resolved: "shadow-[0_0_8px_-1px_rgba(16,185,129,0.5)]",
  ai_analysis: "shadow-[0_0_8px_-1px_rgba(168,85,247,0.5)]",
  created: "shadow-[0_0_8px_-1px_rgba(239,68,68,0.5)]",
};

const statusBadge: Record<string, string> = {
  problem: "bg-red-500/15 text-red-400 ring-1 ring-red-500/20",
  acknowledged: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20",
  resolved: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20",
};

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function RCADisplay({ rca }: { rca: string }) {
  try {
    const parsed = JSON.parse(rca);
    return (
      <div className="space-y-4">
        {parsed.summary && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-1.5">Summary</div>
            <p className="text-xs leading-relaxed text-muted-foreground">{parsed.summary}</p>
          </div>
        )}
        {parsed.rootCause && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-red-400 mb-1.5">Root Cause</div>
            <p className="text-xs leading-relaxed text-muted-foreground">{parsed.rootCause}</p>
          </div>
        )}
        {parsed.recommendations && Array.isArray(parsed.recommendations) && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 mb-1.5">Recommendations</div>
            <ul className="space-y-1.5">
              {parsed.recommendations.map((r: string, i: number) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-2">
                  <span className="text-emerald-500 mt-0.5 shrink-0">›</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {parsed.timeline && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-1.5">Timeline</div>
            <p className="text-xs leading-relaxed text-muted-foreground">{typeof parsed.timeline === "string" ? parsed.timeline : JSON.stringify(parsed.timeline, null, 2)}</p>
          </div>
        )}
        {parsed.confidence != null && (
          <div className="flex items-center gap-2 pt-1">
            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(parsed.confidence * 100)}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">{Math.round(parsed.confidence * 100)}% confidence</span>
          </div>
        )}
      </div>
    );
  } catch {
    return <div className="text-xs whitespace-pre-wrap leading-relaxed text-muted-foreground">{rca}</div>;
  }
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 bg-muted animate-pulse rounded-md" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 bg-muted animate-pulse rounded-full" />
            <div className="h-3 w-16 bg-muted animate-pulse rounded" />
            <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
          </div>
          <div className="h-5 w-2/3 bg-muted animate-pulse rounded" />
          <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card><CardContent className="p-4"><div className="space-y-3"><div className="h-3 w-40 bg-muted animate-pulse rounded" /><div className="h-24 w-full bg-muted animate-pulse rounded" /></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="space-y-3"><div className="h-3 w-24 bg-muted animate-pulse rounded" /><div className="h-36 w-full bg-muted animate-pulse rounded" /></div></CardContent></Card>
        </div>
        <div className="space-y-4">
          <Card><CardContent className="p-4"><div className="space-y-3"><div className="h-3 w-20 bg-muted animate-pulse rounded" /><div className="h-4 w-full bg-muted animate-pulse rounded" /><div className="h-4 w-3/4 bg-muted animate-pulse rounded" /><div className="h-4 w-1/2 bg-muted animate-pulse rounded" /></div></CardContent></Card>
        </div>
      </div>
    </div>
  );
}

export default function IncidentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [inc, setInc] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatMsgs, setChatMsgs] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [rcaLoading, setRcaLoading] = useState(false);
  const toast = useToast();

  const load = async () => {
    try { setInc(await apiFetch<IncidentDetail>(`/api/incidents/${id}`)); }
    catch (err) {
      console.error(err);
      toast.error("Failed to load incident");
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const ack = async () => {
    try {
      await apiFetch(`/api/incidents/${id}/acknowledge`, { method: "POST", body: JSON.stringify({}) });
      toast.success("Incident acknowledged");
      load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to acknowledge incident");
    }
  };

  const resolve = async () => {
    try {
      await apiFetch(`/api/incidents/${id}/resolve`, { method: "POST" });
      toast.success("Incident resolved");
      load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to resolve incident");
    }
  };

  const genRca = async () => {
    setRcaLoading(true);
    try {
      await apiFetch(`/api/ai/rca/${id}`, { method: "POST" });
      toast.success("RCA generated");
      load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate RCA");
    } finally { setRcaLoading(false); }
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput; setChatInput("");
    setChatMsgs(p => [...p, { role: "user", content: msg }]);
    setChatLoading(true);
    try {
      const d = await apiFetch<{ response: string }>("/api/ai/chat", { method: "POST", body: JSON.stringify({ message: msg, incidentId: id }) });
      setChatMsgs(p => [...p, { role: "assistant", content: d.response }]);
    } catch (e: any) { setChatMsgs(p => [...p, { role: "assistant", content: `Error: ${e.message}` }]); }
    finally { setChatLoading(false); }
  };

  if (loading) return <DetailSkeleton />;
  if (!inc) return <div className="text-center py-12 text-xs text-muted-foreground">Not found</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Link href="/incidents" className="rounded-md p-1.5 hover:bg-accent mt-0.5">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <span className={cn("h-3 w-3 rounded-full", sevDot[inc.severity], sevGlow[inc.severity])} />
            <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">{inc.severity}</span>
            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full capitalize", statusBadge[inc.status])}>
              {inc.status}
            </span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight truncate">{inc.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {inc.device && (
              <Link href={`/devices/${inc.device.id}`} className="hover:underline text-primary font-medium">
                {inc.device.name} ({inc.device.ip})
              </Link>
            )}
            <span>{timeAgo(inc.startedAt)}</span>
            {inc.resolvedAt && <span className="text-emerald-400">Resolved {timeAgo(inc.resolvedAt)}</span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {inc.status === "problem" && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/50"
              onClick={ack}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Acknowledge
            </Button>
          )}
          {inc.status !== "resolved" && (
            <Button
              size="sm"
              className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={resolve}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Resolve
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                Root Cause Analysis
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 gap-1.5"
                onClick={genRca}
                disabled={rcaLoading}
              >
                {rcaLoading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Analyzing...
                  </span>
                ) : inc.aiRca ? "Regenerate" : "Generate"}
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-3">
              {inc.aiRca ? (
                <div className="rounded-lg border border-purple-500/10 bg-purple-500/[0.03] p-4">
                  <RCADisplay rca={inc.aiRca} />
                </div>
              ) : (
                <div className="text-center py-6">
                  <Sparkles className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">No analysis yet. Click Generate to start.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-primary" /> Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-3">
              <ScrollArea className="h-52 mb-3">
                <div className="space-y-3">
                  {chatMsgs.length === 0 && (
                    <div className="text-center py-8">
                      <MessageSquare className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground">Ask about this incident...</p>
                    </div>
                  )}
                  {chatMsgs.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg p-3 text-xs max-w-[85%]",
                        m.role === "user"
                          ? "bg-primary/10 border border-primary/10 ml-auto"
                          : "bg-muted border border-border mr-auto"
                      )}
                    >
                      <div className={cn(
                        "text-[10px] font-semibold mb-1",
                        m.role === "user" ? "text-primary" : "text-muted-foreground"
                      )}>
                        {m.role === "user" ? "You" : "Assistant"}
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="bg-muted border border-border rounded-lg p-3 mr-auto max-w-[85%]">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="flex gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                        </span>
                        Thinking...
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendChat()}
                  placeholder="Ask a question..."
                  className="h-9 text-sm"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={sendChat}
                  disabled={chatLoading || !chatInput.trim()}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-400" /> Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-3">
              {inc.events && inc.events.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-border rounded-full" />
                  {inc.events.map((ev, idx) => (
                    <div key={ev.id} className="flex gap-3.5 text-xs relative">
                      <div className="flex flex-col items-center z-10">
                        <div className={cn(
                          "h-3 w-3 rounded-full mt-1 ring-2 ring-card",
                          eventDot[ev.type] || "bg-gray-400",
                          eventGlow[ev.type],
                        )} />
                      </div>
                      <div className={cn("pb-4 flex-1", idx === inc.events!.length - 1 && "pb-0")}>
                        <div className="font-medium capitalize">{ev.type.replace("_", " ")}</div>
                        <div className="text-muted-foreground mt-0.5 leading-relaxed">{ev.message}</div>
                        <div className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(ev.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-6">No events</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-t-2 border-t-primary/30">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-3">
              <dl className="space-y-3 text-xs">
                <div>
                  <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Metric</dt>
                  <dd className="font-medium mt-0.5">{inc.metricName || "-"}</dd>
                </div>
                <Separator />
                <div>
                  <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Value</dt>
                  <dd className="font-medium font-mono mt-0.5">{inc.metricValue ?? "-"}</dd>
                </div>
                {inc.rule && (
                  <>
                    <Separator />
                    <div>
                      <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Rule</dt>
                      <dd className="font-medium mt-0.5">{inc.rule.name} ({inc.rule.operator} {inc.rule.threshold})</dd>
                    </div>
                  </>
                )}
                <Separator />
                <div>
                  <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Duration</dt>
                  <dd className="font-medium mt-0.5">
                    {inc.resolvedAt
                      ? `${Math.round((new Date(inc.resolvedAt).getTime() - new Date(inc.startedAt).getTime()) / 60000)} min`
                      : `${Math.round((Date.now() - new Date(inc.startedAt).getTime()) / 60000)} min (ongoing)`}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {inc.device && (
            <Card className="border-t-2 border-t-primary/30">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Device</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-3">
                <dl className="space-y-3 text-xs">
                  <div>
                    <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Name</dt>
                    <dd className="mt-0.5">
                      <Link href={`/devices/${inc.device.id}`} className="font-medium text-primary hover:underline">{inc.device.name}</Link>
                    </dd>
                  </div>
                  <Separator />
                  <div>
                    <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">IP Address</dt>
                    <dd className="font-mono mt-0.5">{inc.device.ip}</dd>
                  </div>
                  <Separator />
                  <div>
                    <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Type</dt>
                    <dd className="capitalize mt-0.5">{inc.device.type}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
