"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Alert from "@cloudscape-design/components/alert";
import { AuthProvider, useAuth } from "@/lib/auth";
import { apiGet } from "@/lib/api";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 16px" }}>
      <form onSubmit={handleSubmit}>
        <Form
          header={
            <Header variant="h1" description="AI-Powered Network Management System">
              NetPulse
            </Header>
          }
          actions={
            <Button variant="primary" loading={loading} formAction="submit">
              Sign in
            </Button>
          }
        >
          <Container>
            <SpaceBetween size="l">
              {error && <Alert type="error">{error}</Alert>}
              <FormField label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={({ detail }) => setEmail(detail.value)}
                  placeholder="admin@netpulse.io"
                />
              </FormField>
              <FormField label="Password">
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

function LoginPageInner() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useState(() => {
    apiGet<{ needsSetup: boolean }>("/api/setup/status")
      .then((res) => {
        if (res.needsSetup) router.replace("/setup");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  });

  if (checking) return null;
  return <LoginForm />;
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginPageInner />
    </AuthProvider>
  );
}
