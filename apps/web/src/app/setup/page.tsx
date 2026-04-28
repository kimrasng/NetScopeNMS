"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Wizard from "@cloudscape-design/components/wizard";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { apiPost, setToken } from "@/lib/api";
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

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: "0 16px" }}>
      {error && (
        <Box margin={{ bottom: "l" }}>
          <Alert type="error" dismissible onDismiss={() => setError("")}>
            {error}
          </Alert>
        </Box>
      )}
      <Wizard
        i18nStrings={{
          stepNumberLabel: (stepNumber) => `Step ${stepNumber}`,
          collapsedStepsLabel: (stepNumber, stepsCount) =>
            `Step ${stepNumber} of ${stepsCount}`,
          submitButton: t("setup.complete"),
          previousButton: t("common.previous"),
          nextButton: t("common.next"),
          cancelButton: t("common.cancel"),
          optional: "optional",
        }}
        onNavigate={({ detail }) => setActiveStepIndex(detail.requestedStepIndex)}
        onSubmit={handleSubmit}
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
                      placeholder="John Doe"
                    />
                  </FormField>
                  <FormField label={t("auth.email")}>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={({ detail }) => updateForm("email", detail.value)}
                      placeholder="admin@netpulse.io"
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
                      placeholder="My Network Operations Center"
                    />
                  </FormField>
                  <FormField
                    label={t("site.logoUrl")}
                    description="Optional. URL to your organization logo"
                  >
                    <Input
                      value={form.logoUrl}
                      onChange={({ detail }) => updateForm("logoUrl", detail.value)}
                      placeholder="https://example.com/logo.png"
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
    </div>
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
