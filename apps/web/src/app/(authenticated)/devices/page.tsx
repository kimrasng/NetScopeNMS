"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, cn } from "@/lib/utils";
import { Plus, Search, Pencil, Trash2, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface Device {
  id: string; name: string; ip: string; type: string; status: string;
  location?: string; tags?: string[]; lastPolledAt?: string;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }

const dot: Record<string, string> = {
  up: "bg-emerald-500", down: "bg-red-500", warning: "bg-amber-500", unknown: "bg-gray-400", maintenance: "bg-violet-500",
};

const dotGlow: Record<string, string> = {
  up: "shadow-[0_0_6px_1px_rgba(16,185,129,0.4)]", down: "shadow-[0_0_6px_1px_rgba(239,68,68,0.4)]", warning: "shadow-[0_0_6px_1px_rgba(245,158,11,0.4)]", unknown: "", maintenance: "shadow-[0_0_6px_1px_rgba(139,92,246,0.4)]",
};

const statusBorder: Record<string, string> = {
  up: "border-t-emerald-500", down: "border-t-red-500", warning: "border-t-amber-500", unknown: "border-t-gray-400", maintenance: "border-t-violet-500",
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function SkeletonRow() {
  return (
    <TableRow>
      {Array.from({ length: 7 }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-3 rounded bg-muted animate-pulse" style={{ width: i === 0 ? 16 : `${50 + Math.random() * 40}%` }} />
        </TableCell>
      ))}
    </TableRow>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const toast = useToast();

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) p.set("search", search);
      if (typeFilter) p.set("type", typeFilter);
      if (statusFilter) p.set("status", statusFilter);
      const data = await apiFetch<{ data: Device[]; pagination: Pagination }>(`/api/devices?${p}`);
      setDevices(data.data);
      setPagination(data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, typeFilter, statusFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this device?")) return;
    try {
      await apiFetch(`/api/devices/${id}`, { method: "DELETE" });
      toast.success("Device deleted");
      load();
    } catch (err: any) {
      toast.error("Failed to delete device", err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Devices</h1>
          <p className="text-xs text-muted-foreground">{pagination.total} registered</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-input bg-background p-0.5">
            <button
              onClick={() => setViewMode("table")}
              className={cn("rounded px-2 py-1 transition-colors", viewMode === "table" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("card")}
              className={cn("rounded px-2 py-1 transition-colors", viewMode === "card" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Device
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm focus-visible:ring-primary/40 focus-visible:ring-2" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 cursor-pointer">
          <option value="">All Types</option>
          {["router","switch","server","firewall","access_point","load_balancer","storage","other"].map(t => (
            <option key={t} value={t}>{t.replace("_"," ")}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 cursor-pointer">
          <option value="">All Status</option>
          {["up","down","warning","unknown","maintenance"].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {viewMode === "card" ? (
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-2.5 w-2.5 rounded-full bg-muted animate-pulse" />
                    <div className="flex gap-1">
                      <div className="h-5 w-5 rounded bg-muted animate-pulse" />
                      <div className="h-5 w-5 rounded bg-muted animate-pulse" />
                    </div>
                  </div>
                  <div className="h-3.5 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                  <div className="flex justify-between">
                    <div className="h-2.5 w-1/4 rounded bg-muted animate-pulse" />
                    <div className="h-2.5 w-1/4 rounded bg-muted animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : devices.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-xs text-muted-foreground">No devices found</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {devices.map(d => (
              <Card key={d.id} className={cn("hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 transition-all duration-200 border-t-2", statusBorder[d.status] || statusBorder.unknown)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", dot[d.status] || dot.unknown, dotGlow[d.status] || "")} />
                    <div className="flex gap-1">
                      <button onClick={() => setEditDevice(d)} className="p-1 rounded hover:bg-muted"><Pencil className="h-3 w-3" /></button>
                      <button onClick={() => handleDelete(d.id)} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <Link href={`/devices/${d.id}`} className="text-sm font-medium text-primary hover:underline">{d.name}</Link>
                  <div className="text-xs text-muted-foreground font-mono">{d.ip}</div>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                    <span className="capitalize">{d.type.replace("_"," ")}</span>
                    <span>{d.lastPolledAt ? timeAgo(d.lastPolledAt) : "Never"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Last Polled</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : devices.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">No devices found</TableCell></TableRow>
              ) : devices.map(d => (
                <TableRow key={d.id} className="hover:bg-accent/50 transition-colors">
                  <TableCell>
                    <span className={cn("inline-block h-2 w-2 rounded-full", dot[d.status] || dot.unknown, dotGlow[d.status] || "")} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/devices/${d.id}`} className="text-xs font-medium text-primary hover:underline">{d.name}</Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{d.ip}</TableCell>
                  <TableCell><span className="text-xs capitalize text-muted-foreground">{d.type.replace("_"," ")}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.location || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.lastPolledAt ? timeAgo(d.lastPolledAt) : "Never"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditDevice(d)} className="p-1 rounded hover:bg-muted"><Pencil className="h-3 w-3 text-muted-foreground" /></button>
                      <button onClick={() => handleDelete(d.id)} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Page {pagination.page} / {pagination.totalPages}</span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Prev</Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>Next</Button>
          </div>
        </div>
      )}

      {showAdd && <AddDeviceModal onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); load(); }} />}
      {editDevice && <EditDeviceModal device={editDevice} onClose={() => setEditDevice(null)} onSuccess={() => { setEditDevice(null); load(); }} />}
    </div>
  );
}

function AddDeviceModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", ip: "", type: "server", snmpVersion: "", snmpCommunity: "", location: "", pollingInterval: 60 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await apiFetch("/api/devices", { method: "POST", body: JSON.stringify({ ...form, snmpVersion: form.snmpVersion || undefined, snmpCommunity: form.snmpCommunity || undefined, location: form.location || undefined }) });
      toast.success("Device added");
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      toast.error("Failed to add device", err.message);
    }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={onClose}>
      <Card className="w-full max-w-md shadow-2xl shadow-black/20 border-border/50" onClick={e => e.stopPropagation()}>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-3">Add Device</h2>
          {error && <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">{error}</div>}
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Name *</Label><Input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-8 text-sm focus-visible:ring-primary/40" /></div>
              <div className="space-y-1"><Label className="text-xs">IP *</Label><Input required value={form.ip} onChange={e => setForm({...form, ip: e.target.value})} className="h-8 text-sm focus-visible:ring-primary/40" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Type</Label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40">
                  {["router","switch","server","firewall","access_point","load_balancer","storage","other"].map(t => <option key={t} value={t}>{t.replace("_"," ")}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Interval (s)</Label><Input type="number" min={30} value={form.pollingInterval} onChange={e => setForm({...form, pollingInterval: parseInt(e.target.value)})} className="h-8 text-sm focus-visible:ring-primary/40" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">SNMP Ver</Label>
                <select value={form.snmpVersion} onChange={e => setForm({...form, snmpVersion: e.target.value})} className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">None</option><option value="v1">v1</option><option value="v2c">v2c</option><option value="v3">v3</option>
                </select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Community</Label><Input value={form.snmpCommunity} onChange={e => setForm({...form, snmpCommunity: e.target.value})} placeholder="public" className="h-8 text-sm focus-visible:ring-primary/40" /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Location</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="h-8 text-sm focus-visible:ring-primary/40" /></div>
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

function EditDeviceModal({ device, onClose, onSuccess }: { device: Device; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: device.name, ip: device.ip, type: device.type, location: device.location || "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await apiFetch(`/api/devices/${device.id}`, { method: "PUT", body: JSON.stringify({ ...form, location: form.location || undefined }) });
      toast.success("Device updated");
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      toast.error("Failed to update device", err.message);
    }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={onClose}>
      <Card className="w-full max-w-md shadow-2xl shadow-black/20 border-border/50" onClick={e => e.stopPropagation()}>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-3">Edit Device</h2>
          {error && <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">{error}</div>}
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Name *</Label><Input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-8 text-sm focus-visible:ring-primary/40" /></div>
              <div className="space-y-1"><Label className="text-xs">IP *</Label><Input required value={form.ip} onChange={e => setForm({...form, ip: e.target.value})} className="h-8 text-sm focus-visible:ring-primary/40" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Type</Label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40">
                  {["router","switch","server","firewall","access_point","load_balancer","storage","other"].map(t => <option key={t} value={t}>{t.replace("_"," ")}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Location</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="h-8 text-sm focus-visible:ring-primary/40" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="sm" disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
