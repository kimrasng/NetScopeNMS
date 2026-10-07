"use client";
import type { ReactNode } from "react";
import AppLayout from "@cloudscape-design/components/app-layout";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import { I18nProvider as CloudscapeI18nProvider } from "@cloudscape-design/components/i18n";
import enMessages from "@cloudscape-design/components/i18n/messages/all.en";
import koMessages from "@cloudscape-design/components/i18n/messages/all.ko";
import { useI18n } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

export function PublicShell({ children, wizard = false, title }: { children: ReactNode; wizard?: boolean; title?: string }) {
  const { locale } = useI18n();
  return <ThemeProvider><CloudscapeI18nProvider locale={locale} messages={locale === "ko" ? [koMessages] : [enMessages]}>
    <TopNavigation identity={{ href: "/login", title: "NetPulse" }} />
    <AppLayout navigationHide toolsHide maxContentWidth={wizard ? 1180 : 640} contentType={wizard ? "wizard" : "form"} content={title ? <ContentLayout header={<Header variant="h1">{title}</Header>}>{children}</ContentLayout> : children} />
  </CloudscapeI18nProvider></ThemeProvider>;
}
