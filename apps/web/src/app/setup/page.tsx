"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores";
import { apiFetch } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const STEPS = [
  { label: "Site", title: "Site Configuration", desc: "Set your system name and logo." },
  { label: "Admin", title: "Administrator Account", desc: "Create the first admin account." },
];

export default function SetupPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [name, setName] = useState("");
  const [siteName, setSiteName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }
    setError("");
    if (password !== confirmPw) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ user: any; token: string }>(
        "/api/setup/init",
        {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            name,
            siteName: siteName || undefined,
            logoUrl: logoUrl || undefined,
          }),
        }
      );
      login(data.user, data.token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  const currentStep = STEPS[step - 1];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-72 h-72 rounded-full blur-[120px] opacity-[0.06]"
          style={{
            background: "hsl(var(--primary))",
            top: "10%",
            left: "15%",
            animation: "float-orb 10s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-56 h-56 rounded-full blur-[100px] opacity-[0.04]"
          style={{
            background: "hsl(var(--success))",
            bottom: "20%",
            right: "20%",
            animation: "float-orb 12s ease-in-out infinite reverse",
          }}
        />
      </div>

      <div className="relative w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-6 text-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="mx-auto mb-3 h-10 w-10 rounded-lg object-cover ring-1 ring-border/50"
            />
          ) : (
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25 text-primary font-mono text-sm font-bold">
              {siteName ? siteName.charAt(0).toUpperCase() : "N"}
            </div>
          )}
          <h1 className="text-lg font-semibold tracking-tight">
            {siteName || "NetPulse"} Setup
          </h1>

          <div className="flex items-center justify-center gap-3 mt-3">
            {STEPS.map((s, i) => {
              const stepNum = i + 1;
              const isActive = step === stepNum;
              const isComplete = step > stepNum;
              return (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`
                        flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold transition-all duration-300
                        ${isComplete
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                          : isActive
                            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                            : "bg-muted text-muted-foreground"
                        }
                      `}
                    >
                      {isComplete ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        stepNum
                      )}
                    </div>
                    <span
                      className={`text-xs transition-colors duration-300 ${
                        isActive || isComplete
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="relative h-px w-8">
                      <div className="absolute inset-0 bg-border" />
                      <div
                        className="absolute inset-y-0 left-0 bg-primary transition-all duration-500 ease-out"
                        style={{ width: isComplete ? "100%" : "0%" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Card className="border-border/50 shadow-lg shadow-black/5 dark:shadow-black/20">
          <CardHeader className="pb-3 pt-5 px-5">
            <h2 className="text-sm font-medium">{currentStep.title}</h2>
            <p className="text-xs text-muted-foreground">{currentStep.desc}</p>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {error && (
              <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              {step === 1 ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Site Name</Label>
                    <Input
                      value={siteName}
                      onChange={(e) => setSiteName(e.target.value)}
                      placeholder="My NMS"
                      className="h-8 text-sm transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Displayed in sidebar and login. Leave empty for
                      &quot;NetPulse&quot;.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Logo URL (optional)</Label>
                    <Input
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="h-8 text-sm transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Direct link to an image. You can change this later in
                      Settings.
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-8 text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/25"
                  >
                    Next
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name</Label>
                    <Input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Admin"
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
                      placeholder="admin@company.com"
                      className="h-8 text-sm transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
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
                  <div className="space-y-1.5">
                    <Label className="text-xs">Confirm Password</Label>
                    <Input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      placeholder="Confirm"
                      className="h-8 text-sm transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-8 text-sm"
                      onClick={() => setStep(1)}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="flex-1 h-8 text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/25"
                    >
                      {loading && (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      )}
                      {loading ? "Creating..." : "Create & Start"}
                    </Button>
                  </div>
                </>
              )}
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
