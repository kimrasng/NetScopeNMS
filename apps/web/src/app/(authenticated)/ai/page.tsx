"use client";

import { useEffect, useState } from "react";
import { apiFetch, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Zap, Check, X, Brain, MessageSquare, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AIProvider {
  id: string; name: string; type: string; model?: string;
  baseUrl?: string; enabled: boolean; isDefault: boolean; createdAt: string;
}

const providerLabels: Record<string, string> = {
  openai: "OpenAI (GPT)", gemini: "Google Gemini", claude: "Anthropic Claude", custom: "Custom API",
};

const defaultModels: Record<string, string> = {
  openai: "gpt-4o", gemini: "gemini-2.0-flash", claude: "claude-sonnet-4-20250514", custom: "",
};

const featureCards = [
  { title: "Incident RCA", desc: "When an incident occurs, AI analyzes metrics, device history, and similar past incidents to identify root cause and suggest remediation steps.", icon: Brain, accent: "border-t-blue-500", iconBg: "bg-blue-500/15", iconColor: "text-blue-500" },
  { title: "Incident Chat", desc: "Chat with AI about any active incident. It has full context of the device, metrics, and event timeline.", icon: MessageSquare, accent: "border-t-emerald-500", iconBg: "bg-emerald-500/15", iconColor: "text-emerald-500" },
  { title: "NL Query", desc: "Ask questions in natural language like \"show devices with CPU above 80%\" and get results from the database.", icon: Search, accent: "border-t-violet-500", iconBg: "bg-violet-500/15", iconColor: "text-violet-500" },
];

export default function AIPage() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; error?: string }>>({});
  const toast = useToast();

  const load = async () => {
    try { setProviders(await apiFetch<AIProvider[]>("/api/ai/providers")); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const deleteProvider = async (id: string) => {
    if (!confirm("Delete this AI provider?")) return;
    try { await apiFetch(`/api/ai/providers/${id}`, { method: "DELETE" }); toast.success("Provider deleted"); load(); }
    catch (err: any) { toast.error("Failed to delete provider"); console.error(err); }
  };

  const testProvider = async (id: string) => {
    setTesting(id);
    try {
      const result = await apiFetch<{ ok: boolean; error?: string }>(`/api/ai/providers/${id}/test`, { method: "POST" });
      setTestResult((prev) => ({ ...prev, [id]: result }));
      if (result.ok) toast.success("Connection successful");
      else toast.error("Connection failed", result.error);
    } catch (err: any) {
      setTestResult((prev) => ({ ...prev, [id]: { ok: false, error: err.message } }));
      toast.error("Connection failed", err.message);
    } finally { setTesting(null); }
  };

  const setDefault = async (id: string) => {
    try { await apiFetch(`/api/ai/providers/${id}`, { method: "PUT", body: JSON.stringify({ isDefault: true }) }); toast.success("Default provider updated"); load(); }
    catch (err: any) { toast.error("Failed to update default provider"); console.error(err); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">AI Analysis</h1>
          <p className="text-xs text-muted-foreground">Configure AI providers for incident analysis and RCA</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Provider
        </Button>
      </div>

      {loading ? (
        <Card>
          <div className="p-1">
            <div className="h-8 bg-muted animate-pulse rounded mb-1" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded mb-1" />
            ))}
          </div>
        </Card>
      ) : providers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm font-medium">No AI providers configured</p>
            <p className="text-xs text-muted-foreground mt-1">Add an AI provider to enable incident analysis, RCA generation, and natural language queries.</p>
            <Button size="sm" className="mt-3" onClick={() => setShowAdd(true)}>Add Provider</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <TableRow key={p.id} className="hover:bg-accent/50">
                  <TableCell className="text-xs font-medium">
                    {p.name}
                    {p.isDefault && <Badge variant="outline" className="ml-2 text-[9px] bg-primary/15 text-primary border-primary/25">Default</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{providerLabels[p.type] || p.type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{p.model || defaultModels[p.type] || "-"}</TableCell>
                  <TableCell>
                    {testResult[p.id] ? (
                      testResult[p.id].ok ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-500"><Check className="h-3 w-3" /> Connected</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-destructive"><X className="h-3 w-3" /> {testResult[p.id].error?.slice(0, 30)}</span>
                      )
                    ) : (
                      <Badge variant="outline" className={cn("text-[9px] border",
                        p.enabled ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/25" : "bg-muted text-muted-foreground border-border"
                      )}>{p.enabled ? "Enabled" : "Disabled"}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button onClick={() => testProvider(p.id)} disabled={testing === p.id}
                        className="rounded p-1.5 hover:bg-primary/15 text-muted-foreground hover:text-primary transition-colors" title="Test connection">
                        <Zap className={cn("h-3.5 w-3.5", testing === p.id && "animate-pulse")} />
                      </button>
                      {!p.isDefault && (
                        <button onClick={() => setDefault(p.id)}
                          className="rounded px-1.5 py-0.5 text-[10px] hover:bg-primary/15 text-muted-foreground hover:text-primary transition-colors">
                          Set Default
                        </button>
                      )}
                      <button onClick={() => deleteProvider(p.id)}
                        className="rounded p-1.5 hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card>
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">How it works</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {featureCards.map((card) => (
              <div key={card.title} className={cn("rounded-lg border border-border/50 border-t-2 p-3 hover:shadow-md transition-shadow", card.accent)}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={cn("rounded-md p-1.5", card.iconBg)}>
                    <card.icon className={cn("h-3.5 w-3.5", card.iconColor)} />
                  </div>
                  <div className="font-medium">{card.title}</div>
                </div>
                <div className="text-muted-foreground">{card.desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {showAdd && <AddProviderModal onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddProviderModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [type, setType] = useState("openai");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { setModel(defaultModels[type] || ""); }, [type]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await apiFetch("/api/ai/providers", {
        method: "POST",
        body: JSON.stringify({ name: name || providerLabels[type], type, apiKey, model: model || undefined, baseUrl: baseUrl || undefined, isDefault }),
      });
      onSuccess();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md" onClick={onClose}>
      <Card className="w-full max-w-md shadow-2xl shadow-black/20" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-3">Add AI Provider</h2>
          {error && <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">{error}</div>}
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Provider</Label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:ring-1 focus:ring-primary/40 focus:border-primary/40">
                <option value="openai">OpenAI (GPT)</option>
                <option value="gemini">Google Gemini</option>
                <option value="claude">Anthropic Claude</option>
                <option value="custom">Custom API (OpenAI-compatible)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name (optional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={providerLabels[type]} className="h-8 text-sm focus:ring-primary/40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">API Key</Label>
              <Input type="password" required value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." className="h-8 text-sm focus:ring-primary/40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Model</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={defaultModels[type]} className="h-8 text-sm focus:ring-primary/40" />
            </div>
            {type === "custom" && (
              <div className="space-y-1">
                <Label className="text-xs">Base URL</Label>
                <Input required value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://your-server.com/v1/chat/completions" className="h-8 text-sm focus:ring-primary/40" />
              </div>
            )}
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded" />
              Set as default provider
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="sm" disabled={loading}>{loading ? "Adding..." : "Add"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
