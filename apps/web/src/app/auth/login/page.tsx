"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useSiteStore } from "@/stores";
import { apiFetch } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const { siteName, logoUrl, load: loadSite } = useSiteStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    loadSite();
    apiFetch<{ needsSetup: boolean }>("/api/setup/status")
      .then((data) => {
        if (data.needsSetup) {
          router.replace("/setup");
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        setChecking(false);
      });
  }, [router, loadSite]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<{ user: any; token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      login(data.user, data.token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center bg-[hsl(222,47%,5%)]">
        {/* Animated mesh grid */}
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--primary) / 0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.4) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          {/* Radial fade so grid dissolves at edges */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 50%, transparent 30%, hsl(222 47% 5%) 75%)",
            }}
          />
        </div>

        {/* Floating glow orbs — CSS keyframe animated */}
        <div
          className="absolute w-72 h-72 rounded-full blur-[100px] opacity-30"
          style={{
            background: "hsl(var(--primary))",
            top: "15%",
            left: "20%",
            animation: "float-orb 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-56 h-56 rounded-full blur-[100px] opacity-20"
          style={{
            background: "hsl(var(--success))",
            bottom: "20%",
            right: "15%",
            animation: "float-orb 10s ease-in-out infinite reverse",
          }}
        />
        <div
          className="absolute w-40 h-40 rounded-full blur-[80px] opacity-15"
          style={{
            background: "hsl(var(--info))",
            top: "55%",
            left: "55%",
            animation: "float-orb 12s ease-in-out infinite 2s",
          }}
        />

        {/* Scanline sweep */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--primary) / 0.15) 2px, hsl(var(--primary) / 0.15) 4px)",
            animation: "scanline 4s linear infinite",
          }}
        />

        {/* Brand content */}
        <div className="relative z-10 text-center px-8 animate-in fade-in duration-700">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={siteName}
              className="mx-auto mb-6 h-16 w-16 rounded-2xl object-cover ring-1 ring-white/10 shadow-lg shadow-primary/20"
            />
          ) : (
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 backdrop-blur-sm ring-1 ring-primary/25 text-primary font-mono text-2xl font-bold shadow-lg shadow-primary/20">
              {siteName.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {siteName}
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
            AI-Powered Network Management System
          </p>
          <div className="flex items-center justify-center gap-5 mt-8 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))] shadow-sm shadow-[hsl(var(--success)/0.5)]" />
              Real-time Monitoring
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-sm shadow-primary/50" />
              AI Analysis
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning))] shadow-sm shadow-[hsl(var(--warning)/0.5)]" />
              Smart Alerts
            </span>
          </div>
        </div>

        {/* Bottom gradient line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 bg-background">
        {/* Mobile brand header */}
        <div className="lg:hidden mb-8 text-center animate-in fade-in duration-500">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={siteName}
              className="mx-auto mb-3 h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-mono text-sm font-bold">
              {siteName.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-lg font-semibold tracking-tight">{siteName}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Network Management System
          </p>
        </div>

        {/* Form card */}
        <div className="w-full max-w-[360px] animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="hidden lg:block mb-6 text-center">
            <h2 className="text-lg font-semibold tracking-tight">
              Welcome back
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sign in to your account
            </p>
          </div>

          <Card className="border-border/50 shadow-lg shadow-black/5 dark:shadow-black/20">
            <CardHeader className="pb-3 pt-5 px-5">
              <h2 className="text-sm font-medium">Sign in</h2>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {error && (
                <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="h-8 text-sm transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="h-8 text-sm transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-8 text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/25"
                >
                  {loading && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
              <p className="text-[10px] text-muted-foreground text-center mt-3">
                Contact your administrator if you need an account.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Keyframe animations */}
      <style jsx global>{`
        @keyframes float-orb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(15px, -20px) scale(1.05); }
          66% { transform: translate(-10px, 15px) scale(0.95); }
        }
        @keyframes scanline {
          0% { transform: translateY(0); }
          100% { transform: translateY(4px); }
        }
      `}</style>
    </div>
  );
}
