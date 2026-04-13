"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores";
import { apiFetch } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface InviteInfo {
  email?: string;
  role: string;
  scope: string;
  expiresAt: string;
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <InvitePageInner />
    </Suspense>
  );
}

function InvitePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { login } = useAuthStore();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!token) {
      setExpired(true);
      setPageLoading(false);
      return;
    }
    apiFetch<InviteInfo>(`/api/setup/invite/${token}`)
      .then((data) => {
        setInvite(data);
        if (data.email) setEmail(data.email);
      })
      .catch(() => setExpired(true))
      .finally(() => setPageLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<{ user: any; token: string }>(
        "/api/setup/invite/accept",
        {
          method: "POST",
          body: JSON.stringify({ token, email, password, name }),
        }
      );
      login(data.user, data.token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (expired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="w-full max-w-[360px] border-border/50 shadow-lg shadow-black/5 dark:shadow-black/20">
            <CardContent className="p-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <p className="text-sm font-medium">Invalid or expired invitation</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contact your administrator for a new invite link.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-72 h-72 rounded-full blur-[120px] opacity-[0.06]"
          style={{
            background: "hsl(var(--primary))",
            top: "10%",
            right: "20%",
            animation: "float-orb 10s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-56 h-56 rounded-full blur-[100px] opacity-[0.04]"
          style={{
            background: "hsl(var(--success))",
            bottom: "15%",
            left: "25%",
            animation: "float-orb 12s ease-in-out infinite reverse",
          }}
        />
      </div>

      <div className="relative w-full max-w-[380px] animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25 text-primary font-mono text-sm font-bold">
            NP
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            Join NetPulse
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            You&apos;ve been invited as{" "}
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium ring-1 ring-primary/20 capitalize">
              {invite?.role}
            </span>
          </p>
        </div>

        <Card className="border-border/50 shadow-lg shadow-black/5 dark:shadow-black/20">
          <CardHeader className="pb-3 pt-5 px-5">
            <h2 className="text-sm font-medium">Create your account</h2>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {error && (
              <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="h-8 text-sm transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-8 text-sm transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
                  disabled={!!invite?.email}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Password</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="h-8 text-sm transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
                />
              </div>
              {invite?.scope === "restricted" && (
                <div className="rounded-md bg-muted/50 border border-border/50 p-2.5 text-xs text-muted-foreground">
                  Access restricted to specific devices/groups assigned by
                  admin.
                </div>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-8 text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/25"
              >
                {loading && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                {loading ? "Creating..." : "Create Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <style jsx global>{`
        @keyframes float-orb {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(15px, -20px) scale(1.05);
          }
          66% {
            transform: translate(-10px, 15px) scale(0.95);
          }
        }
      `}</style>
    </div>
  );
}
