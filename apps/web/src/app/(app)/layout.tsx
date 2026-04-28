"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@cloudscape-design/components/app-layout";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Flashbar from "@cloudscape-design/components/flashbar";
import { AuthProvider, useAuth } from "@/lib/auth";
import { NotificationProvider, useNotifications } from "@/hooks/use-notifications";
import { TopNav } from "@/components/top-nav";
import { Navigation } from "@/components/navigation";
import { connectSocket, disconnectSocket } from "@/lib/socket";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      connectSocket();
      return () => disconnectSocket();
    }
  }, [user]);

  if (loading) return null;
  if (!user) return null;

  return <>{children}</>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { items } = useNotifications();
  const [navOpen, setNavOpen] = useState(true);

  return (
    <>
      <TopNav />
      <AppLayout
        navigation={<Navigation />}
        navigationOpen={navOpen}
        onNavigationChange={({ detail }) => setNavOpen(detail.open)}
        notifications={<Flashbar items={items} />}
        breadcrumbs={
          <BreadcrumbGroup
            items={[{ text: "NetPulse", href: "/dashboard" }]}
            onFollow={(e) => e.preventDefault()}
          />
        }
        toolsHide={true}
        content={children}
      />
    </>
  );
}

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </NotificationProvider>
    </AuthProvider>
  );
}
