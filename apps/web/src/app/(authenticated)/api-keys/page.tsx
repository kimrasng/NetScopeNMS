"use client";

import { useState } from "react";
import { Key, Plus, Trash2, Copy, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/shared";
import { useToast } from "@/hooks/use-toast";
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  type ApiKey,
  type ApiKeyWithRaw,
} from "@/hooks/queries/use-api-keys";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString();
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export default function ApiKeysPage() {
  const { data: keys, isLoading } = useApiKeys();
  const [showCreate, setShowCreate] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyWithRaw | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const columns: ColumnDef<ApiKey>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => <span className="text-xs font-medium">{row.name}</span>,
    },
    {
      id: "prefix",
      header: "Key",
      cell: (row) => (
        <span className="text-xs font-mono text-muted-foreground">{row.prefix}••••••••</span>
      ),
    },
    {
      id: "createdAt",
      header: "Created",
      cell: (row) => <span className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</span>,
    },
    {
      id: "expiresAt",
      header: "Expires",
      cell: (row) => {
        if (!row.expiresAt) return <span className="text-xs text-muted-foreground">Never</span>;
        const expired = isExpired(row.expiresAt);
        return (
          <Badge variant={expired ? "destructive" : "outline"} className="text-[11px]">
            {expired ? "Expired" : formatDate(row.expiresAt)}
          </Badge>
        );
      },
    },
    {
      id: "lastUsedAt",
      header: "Last Used",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.lastUsedAt ? formatDate(row.lastUsedAt) : "Never"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "w-16 text-right",
      cell: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); setRevokeTarget(row); }}
          className="p-1 rounded hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Revoke ${row.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Key className="h-5 w-5" /> API Keys
          </h1>
          <p className="text-xs text-muted-foreground">
            {keys?.length ?? 0} keys
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowCreate(true)}
          data-testid="create-api-key-btn"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Key
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={keys ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyMessage="No API keys yet"
      />

      {showCreate && (
        <CreateKeyModal
          onClose={() => setShowCreate(false)}
          onCreated={(key) => { setShowCreate(false); setCreatedKey(key); }}
        />
      )}

      {createdKey && (
        <RawKeyModal
          apiKey={createdKey}
          onClose={() => setCreatedKey(null)}
        />
      )}

      {revokeTarget && (
        <RevokeConfirmModal
          apiKey={revokeTarget}
          onClose={() => setRevokeTarget(null)}
        />
      )}
    </div>
  );
}

function CreateKeyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (key: ApiKeyWithRaw) => void;
}) {
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const createMutation = useCreateApiKey();
  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const result = await createMutation.mutateAsync({
        name,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      toast.success("API key created");
      onCreated(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create key";
      setError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={onClose}>
      <Card className="w-full max-w-sm shadow-2xl shadow-black/20 border-border/50" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-3">Create API Key</h2>
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. CI/CD Pipeline"
                className="h-8 text-sm focus-visible:ring-primary/40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expires At (optional)</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="h-8 text-sm focus-visible:ring-primary/40"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function RawKeyModal({ apiKey, onClose }: { apiKey: ApiKeyWithRaw; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyKey = async () => {
    await navigator.clipboard.writeText(apiKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <Card className="w-full max-w-md shadow-2xl shadow-black/20 border-border/50">
        <CardContent className="p-5 space-y-4">
          <h2 className="text-sm font-semibold">API Key Created</h2>

          <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              This key will not be shown again. Copy it now and store it securely.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Your API Key</Label>
            <div className="flex items-center gap-2">
              <code
                data-testid="api-key-raw"
                className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono break-all select-all"
              >
                {apiKey.key}
              </code>
              <Button variant="outline" size="sm" onClick={copyKey} className="shrink-0">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={onClose}>Done</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RevokeConfirmModal({ apiKey, onClose }: { apiKey: ApiKey; onClose: () => void }) {
  const revokeMutation = useRevokeApiKey();
  const toast = useToast();

  const handleRevoke = async () => {
    try {
      await revokeMutation.mutateAsync(apiKey.id);
      toast.success("API key revoked");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revoke key";
      toast.error("Revoke failed", msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={onClose}>
      <Card className="w-full max-w-sm shadow-2xl shadow-black/20 border-border/50" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-5 space-y-3">
          <h2 className="text-sm font-semibold">Revoke API Key</h2>
          <p className="text-xs text-muted-foreground">
            Are you sure you want to revoke <span className="font-medium text-foreground">{apiKey.name}</span>?
            This action cannot be undone. Any applications using this key will lose access.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRevoke}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? "Revoking..." : "Revoke"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
