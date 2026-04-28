"use client";

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
      setFetchError("No invitation token provided");
      setLoadingInvite(false);
      return;
    }
    apiGet<Invitation>(`/api/setup/invite/${token}`)
      .then((data) => {
        setInvitation(data);
        if (data.email) setEmail(data.email);
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : "Invalid or expired invitation");
      })
      .finally(() => setLoadingInvite(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
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
      setError(err instanceof Error ? err.message : "Registration failed");
      setSubmitting(false);
    }
  }

  if (loadingInvite) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", textAlign: "center" }}>
        <Spinner size="large" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 16px" }}>
        <Alert type="error">{fetchError}</Alert>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 16px" }}>
      <form onSubmit={handleSubmit}>
        <Form
          header={
            <Header variant="h1" description="Complete your registration to join NetPulse">
              Accept Invitation
            </Header>
          }
          actions={
            <Button variant="primary" loading={submitting} formAction="submit">
              Create account
            </Button>
          }
        >
          <Container>
            <SpaceBetween size="l">
              {error && <Alert type="error">{error}</Alert>}
              {invitation && (
                <Box>
                  <Box variant="awsui-key-label">Role</Box>
                  <Box>{invitation.role}</Box>
                </Box>
              )}
              <FormField label="Full name">
                <Input
                  value={name}
                  onChange={({ detail }) => setName(detail.value)}
                  placeholder="John Doe"
                />
              </FormField>
              <FormField label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={({ detail }) => setEmail(detail.value)}
                  placeholder="user@netpulse.io"
                  disabled={!!invitation?.email}
                />
              </FormField>
              <FormField label="Password" description="Minimum 8 characters">
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
    </div>
  );
}

export default function InvitePage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div style={{ maxWidth: 400, margin: "80px auto", textAlign: "center" }}><Spinner size="large" /></div>}>
        <InviteContent />
      </Suspense>
    </AuthProvider>
  );
}
