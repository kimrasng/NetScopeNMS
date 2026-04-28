"use client";

import { useState } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Button from "@cloudscape-design/components/button";
import Alert from "@cloudscape-design/components/alert";
import { useAuth } from "@/lib/auth";
import { apiPut } from "@/lib/api";
import { useNotifications } from "@/hooks/use-notifications";
import { useI18n } from "@/lib/i18n";

export default function ProfilePage() {
  const { t } = useI18n();
  const { user, refreshUser } = useAuth();
  const { addNotification } = useNotifications();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileLoading(true);
    try {
      await apiPut("/api/auth/profile", { name, phone: phone || null });
      await refreshUser();
      addNotification({ type: "success", content: t("profile.profileUpdated") });
    } catch (err: unknown) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : "Failed to update profile" });
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError(t("profile.passwordMinLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.passwordMismatch"));
      return;
    }

    setPasswordLoading(true);
    try {
      await apiPut("/api/auth/password", { currentPassword, newPassword });
      addNotification({ type: "success", content: t("profile.passwordChanged") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      addNotification({ type: "error", content: err instanceof Error ? err.message : "Failed to change password" });
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <ContentLayout header={<Header variant="h1">{t("page.profile")}</Header>}>
      <SpaceBetween size="l">
        <form onSubmit={handleProfileSubmit}>
          <Form
            actions={
              <Button variant="primary" loading={profileLoading} formAction="submit">
                {t("profile.saveProfile")}
              </Button>
            }
          >
            <Container header={<Header variant="h2">{t("profile.info")}</Header>}>
              <SpaceBetween size="l">
                <FormField label={t("common.email")}>
                  <Input value={user?.email ?? ""} disabled={true} />
                </FormField>
                <FormField label={t("common.role")}>
                  <Input value={user?.role ?? ""} disabled={true} />
                </FormField>
                <FormField label={t("common.name")}>
                  <Input value={name} onChange={({ detail }) => setName(detail.value)} />
                </FormField>
                <FormField label={t("profile.phone")}>
                  <Input value={phone} onChange={({ detail }) => setPhone(detail.value)} placeholder="+82-10-1234-5678" />
                </FormField>
              </SpaceBetween>
            </Container>
          </Form>
        </form>

        <form onSubmit={handlePasswordSubmit}>
          <Form
            actions={
              <Button variant="primary" loading={passwordLoading} formAction="submit">
                {t("profile.changePassword")}
              </Button>
            }
          >
            <Container header={<Header variant="h2">{t("profile.changePassword")}</Header>}>
              <SpaceBetween size="l">
                {passwordError && <Alert type="error">{passwordError}</Alert>}
                <FormField label={t("profile.currentPassword")}>
                  <Input type="password" value={currentPassword} onChange={({ detail }) => setCurrentPassword(detail.value)} />
                </FormField>
                <FormField label={t("profile.newPassword")} description={t("profile.passwordMinLength")}>
                  <Input type="password" value={newPassword} onChange={({ detail }) => setNewPassword(detail.value)} />
                </FormField>
                <FormField label={t("profile.confirmPassword")}>
                  <Input type="password" value={confirmPassword} onChange={({ detail }) => setConfirmPassword(detail.value)} />
                </FormField>
              </SpaceBetween>
            </Container>
          </Form>
        </form>
      </SpaceBetween>
    </ContentLayout>
  );
}
