"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useMaintenanceWindows,
  useCreateMaintenanceWindow,
  useUpdateMaintenanceWindow,
  useDeleteMaintenanceWindow,
  type MaintenanceWindow,
  type MaintenanceStatus,
} from "@/hooks/queries/use-maintenance-windows";

function getStatus(mw: MaintenanceWindow): MaintenanceStatus {
  const now = Date.now();
  const start = new Date(mw.startAt).getTime();
  const end = new Date(mw.endAt).getTime();
  if (now >= start && now <= end) return "active";
  if (now < start) return "upcoming";
  return "past";
}

const statusBadge: Record<MaintenanceStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  upcoming: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  past: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MaintenancePage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | "">("");
  const [showModal, setShowModal] = useState(false);
  const [editWindow, setEditWindow] = useState<MaintenanceWindow | null>(null);
  const toast = useToast();

  const { data, isLoading } = useMaintenanceWindows({
    status: statusFilter || undefined,
    page,
  });
  const windows = data?.data ?? [];
  const pagination = data?.pagination ?? { page: 1, limit: 50, total: 0, totalPages: 0 };

  const deleteMutation = useDeleteMaintenanceWindow();

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this maintenance window?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Maintenance window deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Maintenance Windows</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pagination.total} window{pagination.total !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setEditWindow(null); setShowModal(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New Window
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as MaintenanceStatus | ""); setPage(1); }}
          className="h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary cursor-pointer"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
        </select>
        {statusFilter && (
          <button
            onClick={() => { setStatusFilter(""); setPage(1); }}
            className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent"
          >
            Clear
          </button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Devices / Groups</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Recurring</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-3 rounded bg-muted animate-pulse" style={{ width: `${40 + Math.random() * 40}%` }} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : windows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                  No maintenance windows found
                </TableCell>
              </TableRow>
            ) : (
              windows.map((mw) => {
                const status = getStatus(mw);
                return (
                  <TableRow key={mw.id} className="hover:bg-accent/50 transition-colors">
                    <TableCell className="text-xs font-medium">{mw.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {mw.deviceIds.length > 0 && <span>{mw.deviceIds.length} device{mw.deviceIds.length !== 1 ? "s" : ""}</span>}
                      {mw.deviceIds.length > 0 && mw.groupIds.length > 0 && <span>, </span>}
                      {mw.groupIds.length > 0 && <span>{mw.groupIds.length} group{mw.groupIds.length !== 1 ? "s" : ""}</span>}
                      {mw.deviceIds.length === 0 && mw.groupIds.length === 0 && <span className="text-muted-foreground/50">-</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(mw.startAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(mw.endAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {mw.recurring ? (
                        <span className="text-primary">{mw.cronExpression || "Yes"}</span>
                      ) : (
                        "No"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] capitalize", statusBadge[status])}>
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditWindow(mw); setShowModal(true); }}
                          className="p-1 rounded hover:bg-muted"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(mw.id)}
                          className="p-1 rounded hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {pagination.page} / {pagination.totalPages}
          </span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(page - 1)}>
              Prev
            </Button>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {showModal && (
        <MaintenanceModal
          window={editWindow}
          onClose={() => { setShowModal(false); setEditWindow(null); }}
        />
      )}
    </div>
  );
}

function MaintenanceModal({ window: mw, onClose }: { window: MaintenanceWindow | null; onClose: () => void }) {
  const isEdit = !!mw;
  const toast = useToast();
  const createMutation = useCreateMaintenanceWindow();
  const updateMutation = useUpdateMaintenanceWindow();

  const [form, setForm] = useState({
    name: mw?.name ?? "",
    description: mw?.description ?? "",
    deviceIds: mw?.deviceIds?.join(", ") ?? "",
    groupIds: mw?.groupIds?.join(", ") ?? "",
    startAt: mw ? toLocalDatetime(mw.startAt) : "",
    endAt: mw ? toLocalDatetime(mw.endAt) : "",
    recurring: mw?.recurring ?? false,
    cronExpression: mw?.cronExpression ?? "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const deviceIds = form.deviceIds.split(",").map((s) => s.trim()).filter(Boolean);
    const groupIds = form.groupIds.split(",").map((s) => s.trim()).filter(Boolean);

    const body = {
      name: form.name,
      description: form.description || undefined,
      deviceIds,
      groupIds,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      recurring: form.recurring,
      cronExpression: form.cronExpression || undefined,
    };

    try {
      if (isEdit && mw) {
        await updateMutation.mutateAsync({ id: mw.id, ...body });
        toast.success("Maintenance window updated");
      } else {
        await createMutation.mutateAsync(body);
        toast.success("Maintenance window created");
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      toast.error(isEdit ? "Failed to update" : "Failed to create", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={onClose}>
      <Card className="w-full max-w-lg shadow-2xl shadow-black/20 border-border/50" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">{isEdit ? "Edit" : "New"} Maintenance Window</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          {error && (
            <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Name *</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-8 text-sm focus-visible:ring-primary/40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="h-8 text-sm focus-visible:ring-primary/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Device IDs (comma-separated)</Label>
                <Input
                  value={form.deviceIds}
                  onChange={(e) => setForm({ ...form, deviceIds: e.target.value })}
                  placeholder="uuid1, uuid2"
                  className="h-8 text-sm focus-visible:ring-primary/40"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Group IDs (comma-separated)</Label>
                <Input
                  value={form.groupIds}
                  onChange={(e) => setForm({ ...form, groupIds: e.target.value })}
                  placeholder="uuid1, uuid2"
                  className="h-8 text-sm focus-visible:ring-primary/40"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Start *</Label>
                <Input
                  type="datetime-local"
                  required
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                  className="h-8 text-sm focus-visible:ring-primary/40"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End *</Label>
                <Input
                  type="datetime-local"
                  required
                  value={form.endAt}
                  onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                  className="h-8 text-sm focus-visible:ring-primary/40"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.recurring}
                  onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
                  className="rounded border-input"
                />
                Recurring
              </label>
              {form.recurring && (
                <Input
                  value={form.cronExpression}
                  onChange={(e) => setForm({ ...form, cronExpression: e.target.value })}
                  placeholder="Cron expression"
                  className="h-8 text-sm focus-visible:ring-primary/40 flex-1"
                />
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Saving..." : isEdit ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
