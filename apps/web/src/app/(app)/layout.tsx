"use client";

import { useEffect, useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import { canVisit } from "@/lib/permissions";
import { useRouter, usePathname } from "next/navigation";
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
import { consoleRoute } from "@/lib/console-routes";

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

  const userId = user?.id;
  useEffect(() => {
    if (userId) {
      connectSocket();
      return () => disconnectSocket();
    }
  }, [userId]);

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
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { items, addNotification } = useNotifications();
  useEffect(() => {
    const onError = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail: unknown = event.detail;
      if (!detail || typeof detail !== "object" || !("message" in detail)) return;
      addNotification({ type: "error", content: String(detail.message), action: <Button onClick={() => window.dispatchEvent(new Event("focus"))}>{t("Retry")}</Button> });
    };
    window.addEventListener("netpulse:api-error", onError);
    return () => window.removeEventListener("netpulse:api-error", onError);
  }, [addNotification, t]);
  const { siteName } = useSite();
  const route = consoleRoute(pathname, siteName, t);
  const [navOpen, setNavOpen] = useState(!route.form);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 769px)");
    const update = () => setNavOpen(!route.form && desktop.matches);
    update();
    desktop.addEventListener("change", update);
    return () => desktop.removeEventListener("change", update);
  }, [route.form]);

  return (
    <>
      <TopNav />
      <AppLayout
        contentType={route.contentType}
        maxContentWidth={route.form ? 960 : undefined}
        navigation={<Navigation />}
        navigationOpen={navOpen}
        onNavigationChange={({ detail }) => setNavOpen(detail.open)}
        notifications={<Flashbar items={items} />}
        breadcrumbs={
          <BreadcrumbGroup
            items={route.breadcrumbs}
            onFollow={(event) => { event.preventDefault(); router.push(event.detail.href); }}
          />
        }
        toolsHide={true}
        content={canVisit(pathname, user) ? children : <Alert type="error" header={t("Access denied")} action={<Button onClick={() => router.push("/dashboard")}>{t("Return to dashboard")}</Button>}>{t("Your current role or resource scope does not allow this page.")}</Alert>}
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
