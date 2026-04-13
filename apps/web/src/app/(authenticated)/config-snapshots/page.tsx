"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, GitCompare, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  useConfigSnapshots,
  useConfigSnapshot,
  useConfigSnapshotDiff,
  type ConfigSnapshot,
} from "@/hooks/queries/use-config-snapshots";

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function ConfigSnapshotsPage() {
  const [page, setPage] = useState(1);
  const [deviceFilter, setDeviceFilter] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [diffIds, setDiffIds] = useState<[string | null, string | null]>([null, null]);
  const [showDiff, setShowDiff] = useState(false);
  const [selecting, setSelecting] = useState<"first" | "second" | null>(null);

  const { data, isLoading } = useConfigSnapshots({
    deviceId: deviceFilter || undefined,
    page,
  });
  const snapshots = data?.data ?? [];
  const pagination = data?.pagination ?? { page: 1, limit: 50, total: 0, totalPages: 0 };

  const startDiffSelection = () => {
    setDiffIds([null, null]);
    setSelecting("first");
    setShowDiff(false);
  };

  const selectForDiff = (id: string) => {
    if (selecting === "first") {
      setDiffIds([id, null]);
      setSelecting("second");
    } else if (selecting === "second") {
      setDiffIds((prev) => {
        const newIds: [string | null, string | null] = [prev[0], id];
        return newIds;
      });
      setSelecting(null);
      setShowDiff(true);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Config Snapshots</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pagination.total} snapshot{pagination.total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selecting ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Select {selecting === "first" ? "base" : "compare"} snapshot
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSelecting(null); setDiffIds([null, null]); }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={startDiffSelection}>
              <GitCompare className="h-3.5 w-3.5 mr-1.5" /> Compare
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Filter by Device ID..."
          value={deviceFilter}
          onChange={(e) => { setDeviceFilter(e.target.value); setPage(1); }}
          className="h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary min-w-[220px]"
        />
        {deviceFilter && (
          <button
            onClick={() => { setDeviceFilter(""); setPage(1); }}
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
              <TableHead>Device ID</TableHead>
              <TableHead>Captured</TableHead>
              <TableHead>Hash</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-3 rounded bg-muted animate-pulse" style={{ width: `${50 + Math.random() * 30}%` }} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : snapshots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                  No config snapshots found
                </TableCell>
              </TableRow>
            ) : (
              snapshots.map((snap) => (
                <TableRow
                  key={snap.id}
                  className={cn(
                    "hover:bg-accent/50 transition-colors",
                    selecting && "cursor-pointer",
                    (diffIds[0] === snap.id || diffIds[1] === snap.id) && "bg-primary/5 border-l-2 border-l-primary",
                  )}
                  onClick={() => selecting && selectForDiff(snap.id)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {snap.deviceId.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(snap.capturedAt).toLocaleString()} ({timeAgo(snap.capturedAt)})
                  </TableCell>
                  <TableCell>
                    <code className="text-[11px] px-1.5 py-0.5 rounded bg-muted font-mono">
                      {snap.hash.slice(0, 8)}
                    </code>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => { e.stopPropagation(); setViewId(snap.id); }}
                      >
                        <Eye className="h-3 w-3" /> View
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
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

      {viewId && <SnapshotDetailModal id={viewId} onClose={() => setViewId(null)} />}
      {showDiff && diffIds[0] && diffIds[1] && (
        <DiffModal id1={diffIds[0]} id2={diffIds[1]} onClose={() => { setShowDiff(false); setDiffIds([null, null]); }} />
      )}
    </div>
  );
}

function SnapshotDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: snapshot, isLoading } = useConfigSnapshot(id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={onClose}>
      <Card className="w-full max-w-3xl max-h-[80vh] shadow-2xl shadow-black/20 border-border/50" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Snapshot Detail</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
              <div className="h-40 bg-muted animate-pulse rounded" />
            </div>
          ) : snapshot ? (
            <div className="space-y-3">
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Device: <code className="font-mono">{snapshot.deviceId.slice(0, 8)}...</code></span>
                <span>Hash: <code className="font-mono">{snapshot.hash.slice(0, 8)}</code></span>
                <span>Captured: {new Date(snapshot.capturedAt).toLocaleString()}</span>
              </div>
              <pre className="bg-muted/50 border rounded-md p-4 text-xs font-mono overflow-auto max-h-[55vh] whitespace-pre-wrap">
                {snapshot.configText}
              </pre>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Snapshot not found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DiffModal({ id1, id2, onClose }: { id1: string; id2: string; onClose: () => void }) {
  const { data: diff, isLoading } = useConfigSnapshotDiff(id1, id2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={onClose}>
      <Card className="w-full max-w-3xl max-h-[80vh] shadow-2xl shadow-black/20 border-border/50" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Config Diff</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-40 bg-muted animate-pulse rounded" />
            </div>
          ) : diff ? (
            <div className="space-y-3">
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Base: <code className="font-mono">{id1.slice(0, 8)}</code></span>
                <span>Compare: <code className="font-mono">{id2.slice(0, 8)}</code></span>
                <span>{diff.unchanged} unchanged line{diff.unchanged !== 1 ? "s" : ""}</span>
              </div>
              <div data-testid="diff-view" className="bg-muted/30 border rounded-md overflow-auto max-h-[55vh] font-mono text-xs">
                {diff.removed.length === 0 && diff.added.length === 0 ? (
                  <div className="p-4 text-muted-foreground text-center">No differences found</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {diff.removed.map((line, i) => (
                      <div key={`r-${i}`} className="px-4 py-1 bg-red-500/10 text-red-400">
                        <span className="select-none mr-2">-</span>{line}
                      </div>
                    ))}
                    {diff.added.map((line, i) => (
                      <div key={`a-${i}`} className="px-4 py-1 bg-green-500/10 text-green-400">
                        <span className="select-none mr-2">+</span>{line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Failed to load diff</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
