"use client";

import { useEffect, useState } from "react";
import { apiFetch, cn } from "@/lib/utils";
import { useAuthStore, useSiteStore } from "@/stores";
import { Bell, Shield, User, Webhook, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface NotificationChannel { id: string; name: string; type: string; enabled: boolean; config: Record<string, unknown>; createdAt: string; }

const tabs = [
  { id: "site", label: "Site", icon: Globe },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Shield },
];

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const { siteName, logoUrl, load: loadSite } = useSiteStore();
  const toast = useToast();
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [activeTab, setActiveTab] = useState("site");
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  // Site settings form
  const [editSiteName, setEditSiteName] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteSaved, setSiteSaved] = useState(false);

  useEffect(() => {
    setEditSiteName(siteName);
    setEditLogoUrl(logoUrl);
  }, [siteName, logoUrl]);

  useEffect(() => {
    if (user?.name) setProfileName(user.name);
  }, [user?.name]);

  useEffect(() => {
    (async () => { try { setChannels(await apiFetch<NotificationChannel[]>("/api/notifications/channels")); } catch {} finally { setLoading(false); } })();
  }, []);

  const saveSiteSettings = async () => {
    setSiteSaving(true); setSiteSaved(false);
    try {
      await apiFetch("/api/setup/site", { method: "PUT", body: JSON.stringify({ siteName: editSiteName, logoUrl: editLogoUrl }) });
      await loadSite();
      setSiteSaved(true);
      setTimeout(() => setSiteSaved(false), 2000);
    } catch (err) { console.error(err); }
    finally { setSiteSaving(false); }
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      const updated = await apiFetch<{ id: string; name: string; email: string; role: string }>("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ name: profileName }),
      });
      setUser({ ...user!, name: updated.name });
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async () => {
    setPwError("");
    if (newPw.length < 8) { setPwError("Password must be at least 8 characters"); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match"); return; }
    setPwSaving(true);
    try {
      await apiFetch("/api/auth/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      toast.success("Password changed");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to change password");
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold tracking-tight">Settings</h1>

        <div className="flex gap-4">
        <nav className="w-40 space-y-0.5">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                activeTab === t.id
                  ? "bg-primary/15 text-primary font-medium border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-accent/50 border-l-2 border-transparent")}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1">
          {activeTab === "site" && (
            <Card className="max-w-sm border-border/50">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Site Name</Label>
                  <Input value={editSiteName} onChange={e => setEditSiteName(e.target.value)} className="h-8 text-sm focus:ring-primary/40" placeholder="NetPulse" />
                  <p className="text-[10px] text-muted-foreground">Displayed in sidebar, login, and browser tab.</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Logo URL</Label>
                  <Input value={editLogoUrl} onChange={e => setEditLogoUrl(e.target.value)} className="h-8 text-sm focus:ring-primary/40" placeholder="https://example.com/logo.png" />
                  <p className="text-[10px] text-muted-foreground">Direct link to an image. Leave empty for text logo.</p>
                </div>
                {editLogoUrl && (
                  <div className="flex items-center gap-3 p-2 rounded-md bg-muted/50 border border-border/50">
                    <img src={editLogoUrl} alt="Preview" className="h-8 w-8 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <span className="text-xs text-muted-foreground">Preview</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={saveSiteSettings} disabled={siteSaving}>
                    {siteSaving ? "Saving..." : "Save"}
                  </Button>
                  {siteSaved && <span className="text-xs text-emerald-500 font-medium">Saved</span>}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Channels</span>
                <Button size="sm">Add Channel</Button>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" /></div>
              ) : channels.length === 0 ? (
                <Card className="border-border/50"><CardContent className="p-6 text-center">
                  <Webhook className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">No channels configured</p>
                </CardContent></Card>
              ) : channels.map(ch => (
                <Card key={ch.id} className="border-border/50 hover:shadow-md transition-shadow">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium">{ch.name}</div>
                      <div className="text-[10px] text-muted-foreground capitalize">{ch.type}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[10px] border",
                        ch.enabled
                          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/25"
                          : "bg-muted text-muted-foreground border-border"
                      )}>{ch.enabled ? "Active" : "Off"}</Badge>
                      <Button variant="outline" size="sm" className="text-xs h-7">Test</Button>
                      <Button variant="outline" size="sm" className="text-xs h-7">Edit</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeTab === "profile" && (
            <Card className="max-w-sm border-border/50">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={profileName} onChange={e => setProfileName(e.target.value)} className="h-8 text-sm focus:ring-primary/40" /></div>
                <div className="space-y-1"><Label className="text-xs">Email</Label><Input defaultValue={user?.email} disabled className="h-8 text-sm bg-muted" /></div>
                <div className="space-y-1"><Label className="text-xs">Role</Label><Input defaultValue={user?.role} disabled className="h-8 text-sm bg-muted capitalize" /></div>
                <Button size="sm" onClick={saveProfile} disabled={profileSaving}>
                  {profileSaving ? "Saving..." : "Save"}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeTab === "security" && (
            <Card className="max-w-sm border-border/50">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1"><Label className="text-xs">Current Password</Label><Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="h-8 text-sm focus:ring-primary/40" /></div>
                <div className="space-y-1"><Label className="text-xs">New Password</Label><Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="h-8 text-sm focus:ring-primary/40" /></div>
                <div className="space-y-1"><Label className="text-xs">Confirm</Label><Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="h-8 text-sm focus:ring-primary/40" /></div>
                {pwError && <p className="text-xs text-destructive">{pwError}</p>}
                <Button size="sm" onClick={changePassword} disabled={pwSaving || !currentPw || !newPw || !confirmPw}>
                  {pwSaving ? "Updating..." : "Update"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
