"use client";

import { PublicShell } from "@/components/common/public-shell";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Form from "@cloudscape-design/components/form";
import Spinner from "@cloudscape-design/components/spinner";
import { AuthProvider } from "@/lib/auth";
import { apiGet, apiPost, setToken } from "@/lib/api";
import type { Invitation, LoginResponse } from "@/lib/types";

function InviteContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [loadingInvite, setLoadingInvite] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setFetchError(t("No invitation token provided"));
      setLoadingInvite(false);
      return;
    }
    apiGet<Invitation>(`/api/setup/invite/${token}`)
      .then((data) => {
        setInvitation(data);
        if (data.email) setEmail(data.email);
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : t("Invalid or expired invitation"));
      })
      .finally(() => setLoadingInvite(false));
  }, [token, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      setError(t("Enter your name, a valid email address, and a password of at least 8 characters."));
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiPost<LoginResponse>("/api/setup/invite/accept", {
        token,
        email,
        password,
        name,
      });
      setToken(result.token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("Registration failed"));
      setSubmitting(false);
    }
  }

  if (loadingInvite) {
    return (
      <PublicShell>
        <Spinner size="large" />
      </PublicShell>
    );
  }

  if (fetchError) {
    return (
      <PublicShell>
        <Alert type="error">{fetchError}</Alert>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <form onSubmit={handleSubmit}>
        <Form
          header={
            <Header variant="h1" description={t("Complete your registration to join NetPulse")}>
              {t("Accept Invitation")}</Header>
          }
          actions={
            <Button variant="primary" loading={submitting} formAction="submit">
              {t("Create account")}</Button>
          }
        >
          <Container>
            <SpaceBetween size="l">
              {error && <Alert type="error">{error}</Alert>}
              {invitation && (
                <Box>
                  <Box variant="awsui-key-label">{t("Role")}</Box>
                  <Box>{t(`role.${invitation.role}`)}</Box>
                </Box>
              )}
              <FormField label={t("Full name")}>
                <Input
                  value={name}
                  onChange={({ detail }) => setName(detail.value)}
                  placeholder={t("John Doe")}
                />
              </FormField>
              <FormField label={t("Email")}>
                <Input
                  type="email"
                  value={email}
                  onChange={({ detail }) => setEmail(detail.value)}
                  placeholder={t("user@netpulse.io")}
                  disabled={!!invitation?.email}
                />
              </FormField>
              <FormField label={t("Password")} description={t("Minimum 8 characters")}>
                <Input
                  type="password"
                  value={password}
                  onChange={({ detail }) => setPassword(detail.value)}
                />
              </FormField>
            </SpaceBetween>
          </Container>
        </Form>
      </form>
    </PublicShell>
  );
}

export default function InvitePage() {
  return (
    <AuthProvider><I18nProvider>
      <Suspense fallback={<PublicShell><Spinner size="large" /></PublicShell>}>
        <InviteContent />
      </Suspense>
    </I18nProvider></AuthProvider>
  );
}
