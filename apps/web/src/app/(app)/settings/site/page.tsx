"use client";

import { useState, useEffect, useCallback } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Form from "@cloudscape-design/components/form";
import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import Box from "@cloudscape-design/components/box";
import { useApi } from "@/hooks/use-api";
import { useNotifications } from "@/hooks/use-notifications";
import { useI18n } from "@/lib/i18n";
import { apiPut } from "@/lib/api";

interface SiteSettings {
  siteName: string;
  logoUrl: string;
}

export default function SiteSettingsPage() {
  const { t } = useI18n();
  const { data, loading } = useApi<SiteSettings>("/api/setup/site");
  const { addNotification } = useNotifications();

  const [siteName, setSiteName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setSiteName(data.siteName ?? "");
      setLogoUrl(data.logoUrl ?? "");
    }
  }, [data]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await apiPut("/api/setup/site", { siteName, logoUrl });
      addNotification({ type: "success", content: t("site.saved") });
    } catch (err) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : "Failed to save settings." });
    } finally {
      setSaving(false);
    }
  }, [siteName, logoUrl, addNotification, t]);

  if (loading) {
    return (
      <ContentLayout header={<Header variant="h1">{t("page.siteSettings")}</Header>}>
        <Box textAlign="center" padding="xxl"><Spinner size="large" /></Box>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout header={<Header variant="h1">{t("page.siteSettings")}</Header>}>
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="primary" loading={saving} formAction="submit">
                {t("common.save")}
              </Button>
            </SpaceBetween>
          }
        >
          <Container header={<Header variant="h2">General</Header>}>
            <SpaceBetween size="l">
              <FormField label={t("site.siteName")} description="Display name shown in the top navigation.">
                <Input
                  value={siteName}
                  onChange={({ detail }) => setSiteName(detail.value)}
                  placeholder="NetPulse"
                />
              </FormField>
              <FormField label={t("site.logoUrl")} description="URL to the logo image displayed in the header.">
                <Input
                  value={logoUrl}
                  onChange={({ detail }) => setLogoUrl(detail.value)}
                  placeholder="https://example.com/logo.png"
                  type="url"
                />
              </FormField>
            </SpaceBetween>
          </Container>
        </Form>
      </form>
    </ContentLayout>
  );
}
