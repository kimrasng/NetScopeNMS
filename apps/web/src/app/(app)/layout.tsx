"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@cloudscape-design/components/app-layout";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Flashbar from "@cloudscape-design/components/flashbar";
import { I18nProvider as CloudscapeI18nProvider } from "@cloudscape-design/components/i18n";
import enMessages from "@cloudscape-design/components/i18n/messages/all.en";
import koMessages from "@cloudscape-design/components/i18n/messages/all.ko";
import { AuthProvider, useAuth } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { SiteProvider, useSite } from "@/lib/site";
import { NotificationProvider, useNotifications } from "@/hooks/use-notifications";
import { TopNav } from "@/components/top-nav";
import { Navigation } from "@/components/navigation";
import { connectSocket, disconnectSocket } from "@/lib/socket";

const CLOUDSCAPE_MESSAGES = { ko: [koMessages], en: [enMessages] } as const;

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [setupChecked, setSetupChecked] = useState(false);

  useEffect(() => {
    apiGet<{ needsSetup: boolean }>("/api/setup/status")
      .then((res) => {
        if (res.needsSetup) {
          router.replace("/setup");
        } else {
          setSetupChecked(true);
        }
      })
      .catch(() => setSetupChecked(true));
  }, [router]);

  useEffect(() => {
    if (setupChecked && !loading && !user) {
      router.replace("/login");
    }
  }, [setupChecked, loading, user, router]);

  useEffect(() => {
    if (user) {
      connectSocket();
      return () => disconnectSocket();
    }
  }, [user]);

  if (loading || !setupChecked) return null;
  if (!user) return null;

  return <>{children}</>;
}

function CloudscapeLocaleWrapper({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n();
  return (
    <CloudscapeI18nProvider locale={locale} messages={CLOUDSCAPE_MESSAGES[locale]}>
      {children}
    </CloudscapeI18nProvider>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { items } = useNotifications();
  const { siteName } = useSite();
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
            items={[{ text: siteName, href: "/dashboard" }]}
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
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <AuthGate>
              <SiteProvider>
                <CloudscapeLocaleWrapper>
                  <AppShell>{children}</AppShell>
                </CloudscapeLocaleWrapper>
              </SiteProvider>
            </AuthGate>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
