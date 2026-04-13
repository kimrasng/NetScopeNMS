"use client";

import { useEffect, useState } from "react";
import { apiFetch, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Plus, Copy, Trash2, Users, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

interface User {
  id: string; email: string; name: string; role: string;
  scope: string; allowedDeviceIds: string[]; allowedGroupIds: string[];
  enabled: boolean; lastLoginAt?: string; createdAt: string;
}

interface Invitation {
  id: string; email?: string; token: string; role: string;
  scope: string; allowedDeviceIds: string[]; allowedGroupIds: string[];
  usedAt?: string; expiresAt: string; createdAt: string;
}

interface DeviceGroup { id: string; name: string; }
interface Device { id: string; name: string; ip: string; }

const roleColors: Record<string, string> = {
  super_admin: "bg-primary/15 text-primary border-primary/25",
  admin: "bg-primary/15 text-primary border-primary/25",
  operator: "bg-amber-500/15 text-amber-500 border-amber-500/25",
  viewer: "bg-muted text-muted-foreground border-border",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [tab, setTab] = useState<"users" | "invitations">("users");
  const toast = useToast();

  const load = async () => {
    try {
      const [u, inv] = await Promise.all([
        apiFetch<User[]>("/api/setup/users"),
        apiFetch<Invitation[]>("/api/setup/invitations"),
      ]);
      setUsers(u);
      setInvitations(inv);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const deleteUser = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    try { await apiFetch(`/api/setup/users/${id}`, { method: "DELETE" }); toast.success("User deleted"); load(); }
    catch (err: any) { toast.error("Failed to delete user"); console.error(err); }
  };

  const roleBadge = (role: string) => {
    const colors = roleColors[role] || roleColors.viewer;
    return <Badge variant="outline" className={cn("text-[10px] capitalize border", colors)}>{role.replace("_", " ")}</Badge>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Users</h1>
          <p className="text-xs text-muted-foreground">{users.length} users, {invitations.filter(i => !i.usedAt).length} pending invites</p>
        </div>
        <Button size="sm" onClick={() => setShowInvite(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Invite User
        </Button>
      </div>

      <div className="flex gap-1">
        <button onClick={() => setTab("users")} className={cn("px-3 py-1.5 text-xs rounded-md transition-colors",
          tab === "users" ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50")}>
          Users ({users.length})
        </button>
        <button onClick={() => setTab("invitations")} className={cn("px-3 py-1.5 text-xs rounded-md transition-colors",
          tab === "invitations" ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50")}>
          Invitations ({invitations.length})
        </button>
      </div>

      {loading ? (
        <Card>
          <div className="p-1">
            <div className="h-8 bg-muted animate-pulse rounded mb-1" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded mb-1" />
            ))}
          </div>
        </Card>
      ) : tab === "users" ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id} className="hover:bg-accent/50">
                  <TableCell className="text-xs font-medium">{u.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{roleBadge(u.role)}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground capitalize">{u.scope}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell>
                    {u.role !== "super_admin" && (
                      <button onClick={() => deleteUser(u.id)} className="rounded-md p-1.5 hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">No invitations</TableCell></TableRow>
              ) : invitations.map(inv => (
                <TableRow key={inv.id} className="hover:bg-accent/50">
                  <TableCell className="text-xs">{inv.email || "-"}</TableCell>
                  <TableCell>{roleBadge(inv.role)}</TableCell>
                  <TableCell><span className="text-xs text-muted-foreground capitalize">{inv.scope}</span></TableCell>
                  <TableCell>
                    {inv.usedAt ? (
                      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Used</Badge>
                    ) : new Date(inv.expiresAt) < new Date() ? (
                      <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/25">Expired</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-500 border-emerald-500/25">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(inv.expiresAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {!inv.usedAt && new Date(inv.expiresAt) > new Date() && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/auth/invite?token=${inv.token}`); toast.success("Invite link copied"); }}
                        className="rounded-md p-1 hover:bg-primary/15 text-muted-foreground hover:text-primary transition-colors"
                        title="Copy invite link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onSuccess={() => { setShowInvite(false); load(); }} />}
    </div>
  );
}

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [role, setRole] = useState("viewer");
  const [scope, setScope] = useState("all");
  const [email, setEmail] = useState("");
  const [deviceIds, setDeviceIds] = useState("");
  const [groupIds, setGroupIds] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ inviteUrl: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const data = await apiFetch<{ inviteUrl: string }>("/api/setup/invite", {
        method: "POST",
        body: JSON.stringify({
          email: email || undefined,
          role,
          scope,
          allowedDeviceIds: scope === "restricted" ? deviceIds.split(",").map(s => s.trim()).filter(Boolean) : [],
          allowedGroupIds: scope === "restricted" ? groupIds.split(",").map(s => s.trim()).filter(Boolean) : [],
        }),
      });
      setResult({ inviteUrl: `${window.location.origin}${data.inviteUrl}` });
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md" onClick={onClose}>
        <Card className="w-full max-w-md shadow-2xl shadow-black/20" onClick={e => e.stopPropagation()}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="rounded-md p-1.5 bg-primary/15">
                <Link2 className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold">Invite Link Created</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Share this link with the user. It expires in 7 days.</p>
            <div className="flex gap-2">
              <Input value={result.inviteUrl} readOnly className="h-8 text-xs font-mono bg-primary/5 border-primary/20 text-primary" />
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(result.inviteUrl)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button size="sm" className="mt-3 w-full" onClick={onSuccess}>Done</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md" onClick={onClose}>
      <Card className="w-full max-w-md shadow-2xl shadow-black/20" onClick={e => e.stopPropagation()}>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-3">Invite User</h2>
          {error && <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">{error}</div>}
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Email (optional)</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="user@company.com" className="h-8 text-sm focus:ring-primary/40" />
              <p className="text-[10px] text-muted-foreground">If set, only this email can use the invite.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:ring-1 focus:ring-primary/40 focus:border-primary/40">
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Access Scope</Label>
              <select value={scope} onChange={e => setScope(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:ring-1 focus:ring-primary/40 focus:border-primary/40">
                <option value="all">Full Access</option>
                <option value="restricted">Restricted (specific devices/groups)</option>
              </select>
            </div>
            {scope === "restricted" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Allowed Device IDs (comma-separated)</Label>
                  <Input value={deviceIds} onChange={e => setDeviceIds(e.target.value)} placeholder="uuid1, uuid2" className="h-8 text-xs focus:ring-primary/40" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Allowed Group IDs (comma-separated)</Label>
                  <Input value={groupIds} onChange={e => setGroupIds(e.target.value)} placeholder="uuid1, uuid2" className="h-8 text-xs focus:ring-primary/40" />
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="sm" disabled={loading}>{loading ? "Creating..." : "Create Invite"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
