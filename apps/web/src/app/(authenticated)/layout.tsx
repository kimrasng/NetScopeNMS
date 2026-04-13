"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores";
import AppShell from "@/components/layout/app-shell";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, _hydrated, hydrate } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!_hydrated) return;
    if (!isAuthenticated) {
      router.push("/auth/login");
    } else {
      setReady(true);
    }
  }, [_hydrated, isAuthenticated, router]);

  if (!ready) return null;

  return <AppShell>{children}</AppShell>;
}
