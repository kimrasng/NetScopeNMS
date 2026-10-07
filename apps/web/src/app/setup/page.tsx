"use client";

import { PublicShell } from "@/components/common/public-shell";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Wizard from "@cloudscape-design/components/wizard";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Spinner from "@cloudscape-design/components/spinner";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { apiGet, apiPost, setToken } from "@/lib/api";
import type { LoginResponse } from "@/lib/types";

interface SetupFormState {
  email: string;
  password: string;
  name: string;
  siteName: string;
  logoUrl: string;
}

function SetupWizardContent() {
  const { t } = useI18n();
  const router = useRouter();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    apiGet<{ needsSetup: boolean }>("/api/setup/status")
      .then(status => { if (active) setNeedsSetup(status.needsSetup); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : t("Unable to check setup status.")); });
    return () => { active = false; };
  }, [t]);
  const [form, setForm] = useState<SetupFormState>({
    email: "",
    password: "",
    name: "",
    siteName: "",
    logoUrl: "",
  });

  function updateForm(key: keyof SetupFormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const result = await apiPost<LoginResponse>("/api/setup/init", {
        email: form.email,
        password: form.password,
        name: form.name,
        siteName: form.siteName,
        logoUrl: form.logoUrl || undefined,
      });
      setToken(result.token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Setup failed");
      setLoading(false);
    }
  }

  if (needsSetup === null) return <PublicShell title={t("Set up NetPulse")}>{error ? <Alert type="error">{error}</Alert> : <Spinner size="large" />}</PublicShell>;
  if (!needsSetup) return <PublicShell title={t("Set up NetPulse")}><Alert type="info" header={t("Initial setup is complete")} action={<Button href="/login">{t("auth.signIn")}</Button>}>{t("This site already has an administrator. Sign in to manage the site settings.")}</Alert></PublicShell>;

  return (
    <PublicShell wizard title={t("Set up NetPulse")}>
      {error && (
        <Box margin={{ bottom: "l" }}>
          <Alert type="error" dismissible onDismiss={() => setError("")}>
            {error}
          </Alert>
        </Box>
      )}
      <Wizard
        i18nStrings={{
          stepNumberLabel: (stepNumber) => `${t("Step")} ${stepNumber}`,
          collapsedStepsLabel: (stepNumber, stepsCount) =>
            `${t("Step")} ${stepNumber} / ${stepsCount}`,
          submitButton: t("setup.complete"),
          previousButton: t("common.previous"),
          nextButton: t("common.next"),
          cancelButton: t("common.cancel"),
          optional: t("Optional"),
        }}
        onNavigate={({ detail }) => {
          if (detail.requestedStepIndex > activeStepIndex && activeStepIndex === 0 && (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) || form.password.length < 8)) { setError(t("Enter your name, a valid email address, and a password of at least 8 characters.")); return; }
          setError(""); setActiveStepIndex(detail.requestedStepIndex);
        }}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/login")}
        activeStepIndex={activeStepIndex}
        isLoadingNextStep={loading}
        steps={[
          {
            title: t("setup.adminAccount"),
            description: t("setup.adminDesc"),
            content: (
              <Container header={<Header variant="h2">{t("setup.adminCredentials")}</Header>}>
                <SpaceBetween size="l">
                  <FormField label={t("setup.fullName")}>
                    <Input
                      value={form.name}
                      onChange={({ detail }) => updateForm("name", detail.value)}
                      placeholder={t("John Doe")}
                    />
                  </FormField>
                  <FormField label={t("auth.email")}>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={({ detail }) => updateForm("email", detail.value)}
                      placeholder={t("admin@netpulse.io")}
                    />
                  </FormField>
                  <FormField label={t("auth.password")} description={t("setup.passwordMinLength")}>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={({ detail }) => updateForm("password", detail.value)}
                    />
                  </FormField>
                </SpaceBetween>
              </Container>
            ),
          },
          {
            title: t("setup.siteSettings"),
            description: t("setup.siteDesc"),
            content: (
              <Container header={<Header variant="h2">{t("setup.siteConfig")}</Header>}>
                <SpaceBetween size="l">
                  <FormField label={t("site.siteName")}>
                    <Input
                      value={form.siteName}
                      onChange={({ detail }) => updateForm("siteName", detail.value)}
                      placeholder={t("My Network Operations Center")}
                    />
                  </FormField>
                  <FormField
                    label={t("site.logoUrl")}
                    description={t("Optional. URL to your organization logo")}
                  >
                    <Input
                      value={form.logoUrl}
                      onChange={({ detail }) => updateForm("logoUrl", detail.value)}
                      placeholder={t("https://example.com/logo.png")}
                    />
                  </FormField>
                </SpaceBetween>
              </Container>
            ),
          },
          {
            title: t("setup.review"),
            description: t("setup.reviewDesc"),
            content: (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">{t("setup.adminAccount")}</Header>}>
                  <SpaceBetween size="s">
                    <Box>
                      <Box variant="awsui-key-label">{t("common.name")}</Box>
                      <Box>{form.name || "-"}</Box>
                    </Box>
                    <Box>
                      <Box variant="awsui-key-label">{t("auth.email")}</Box>
                      <Box>{form.email || "-"}</Box>
                    </Box>
                  </SpaceBetween>
                </Container>
                <Container header={<Header variant="h2">{t("setup.siteSettings")}</Header>}>
                  <SpaceBetween size="s">
                    <Box>
                      <Box variant="awsui-key-label">{t("site.siteName")}</Box>
                      <Box>{form.siteName || "-"}</Box>
                    </Box>
                    <Box>
                      <Box variant="awsui-key-label">{t("site.logoUrl")}</Box>
                      <Box>{form.logoUrl || t("setup.notSet")}</Box>
                    </Box>
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            ),
          },
        ]}
      />
    </PublicShell>
  );
}

export default function SetupPage() {
  return (
    <AuthProvider>
      <I18nProvider>
        <SetupWizardContent />
      </I18nProvider>
    </AuthProvider>
  );
}
