"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import Toggle from "@cloudscape-design/components/toggle";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Container from "@cloudscape-design/components/container";
import Alert from "@cloudscape-design/components/alert";
import TokenGroup from "@cloudscape-design/components/token-group";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Box from "@cloudscape-design/components/box";
import Spinner from "@cloudscape-design/components/spinner";
import type { SelectProps } from "@cloudscape-design/components/select";
import { apiPut } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { useNotifications } from "@/hooks/use-notifications";
import { useI18n } from "@/lib/i18n";
import type { Device } from "@/lib/types";

const DEVICE_TYPE_OPTIONS: SelectProps.Option[] = [
  { value: "router", label: "Router" },
  { value: "switch", label: "Switch" },
  { value: "server", label: "Server" },
  { value: "firewall", label: "Firewall" },
  { value: "access_point", label: "Access Point" },
  { value: "load_balancer", label: "Load Balancer" },
  { value: "storage", label: "Storage" },
  { value: "other", label: "Other" },
];

const SNMP_VERSION_OPTIONS: SelectProps.Option[] = [
  { value: "v1", label: "v1" },
  { value: "v2c", label: "v2c" },
  { value: "v3", label: "v3" },
];

interface FormState {
  name: string;
  ip: string;
  type: SelectProps.Option | null;
  location: string;
  snmpVersion: SelectProps.Option | null;
  snmpCommunity: string;
  snmpPort: string;
  pollingInterval: string;
  pollingEnabled: boolean;
  latitude: string;
  longitude: string;
  tagInput: string;
  tags: string[];
}

function findOption(options: SelectProps.Option[], value: string | null | undefined): SelectProps.Option | null {
  if (!value) return null;
  return options.find((o) => o.value === value) ?? null;
}

export default function EditDevicePage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addNotification } = useNotifications();
  const { data: device, loading: fetching, error: fetchError } = useApi<Device>(`/api/devices/${id}`);

  const [form, setForm] = useState<FormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!device) return;
    setForm({
      name: device.name,
      ip: device.ip,
      type: findOption(DEVICE_TYPE_OPTIONS, device.type),
      location: device.location ?? "",
      snmpVersion: findOption(SNMP_VERSION_OPTIONS, device.snmpVersion),
      snmpCommunity: device.snmpCommunity ?? "",
      snmpPort: device.snmpPort != null ? String(device.snmpPort) : "161",
      pollingInterval: String(device.pollingInterval),
      pollingEnabled: device.pollingEnabled,
      latitude: device.latitude != null ? String(device.latitude) : "",
      longitude: device.longitude != null ? String(device.longitude) : "",
      tagInput: "",
      tags: device.tags ?? [],
    });
  }, [device]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleAddTag() {
    if (!form) return;
    const tag = form.tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm((prev) => (prev ? { ...prev, tags: [...prev.tags, tag], tagInput: "" } : prev));
    }
  }

  function handleTagKeyDown(key: string) {
    if (key === "Enter") {
      handleAddTag();
    }
  }

  async function handleSubmit() {
    if (!form) return;
    setError("");
    setSubmitting(true);
    try {
      const body = {
        name: form.name,
        ip: form.ip,
        type: form.type?.value,
        location: form.location || undefined,
        snmpVersion: form.snmpVersion?.value || undefined,
        snmpCommunity: form.snmpCommunity || undefined,
        snmpPort: form.snmpPort ? Number(form.snmpPort) : undefined,
        pollingInterval: Number(form.pollingInterval),
        pollingEnabled: form.pollingEnabled,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        tags: form.tags,
      };
      await apiPut<Device>(`/api/devices/${id}`, body);
      addNotification({ type: "success", content: "Device updated successfully." });
      router.push(`/devices/${id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update device.");
      setSubmitting(false);
    }
  }

  if (fetching || !form) {
    return (
      <ContentLayout header={<Header variant="h1">{t("page.devices.edit")}</Header>}>
        <Box textAlign="center" padding={{ vertical: "xxxl" }}>
          <Spinner size="large" />
        </Box>
      </ContentLayout>
    );
  }

  if (fetchError) {
    return (
      <ContentLayout header={<Header variant="h1">{t("page.devices.edit")}</Header>}>
        <Alert type="error">{fetchError}</Alert>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout header={<Header variant="h1">{t("page.devices.edit")}</Header>}>
      <SpaceBetween size="l">
        <BreadcrumbGroup
          items={[
            { text: "NetPulse", href: "/dashboard" },
            { text: "Devices", href: "/devices" },
            { text: device?.name ?? "Device", href: `/devices/${id}` },
            { text: "Edit", href: `/devices/${id}/edit` },
          ]}
          onFollow={(e) => {
            e.preventDefault();
            router.push(e.detail.href);
          }}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <Form
            actions={
              <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => router.push(`/devices/${id}`)}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" loading={submitting} formAction="submit">
                {t("common.save")}
              </Button>
              </SpaceBetween>
            }
            errorText={error}
          >
            <SpaceBetween size="l">
              {error && (
                <Alert type="error" dismissible onDismiss={() => setError("")}>
                  {error}
                </Alert>
              )}

              <Container header={<Header variant="h2">{t("device.basicInfo")}</Header>}>
                <SpaceBetween size="l">
                  <FormField label={t("common.name")} constraintText="Required">
                    <Input
                      value={form.name}
                      onChange={({ detail }) => update("name", detail.value)}
                      placeholder="core-router-01"
                    />
                  </FormField>
                  <FormField label={t("device.ip")} constraintText="Required">
                    <Input
                      value={form.ip}
                      onChange={({ detail }) => update("ip", detail.value)}
                      placeholder="192.168.1.1"
                    />
                  </FormField>
                  <FormField label={t("common.type")} constraintText="Required">
                    <Select
                      selectedOption={form.type}
                      onChange={({ detail }) => update("type", detail.selectedOption)}
                      options={DEVICE_TYPE_OPTIONS}
                      placeholder={t("device.selectType")}
                    />
                  </FormField>
                  <FormField label={t("device.location")}>
                    <Input
                      value={form.location}
                      onChange={({ detail }) => update("location", detail.value)}
                      placeholder="Data Center A, Rack 12"
                    />
                  </FormField>
                </SpaceBetween>
              </Container>

              <Container header={<Header variant="h2">{t("device.snmpConfig")}</Header>}>
                <SpaceBetween size="l">
                  <FormField label={t("device.snmpVersion")}>
                    <Select
                      selectedOption={form.snmpVersion}
                      onChange={({ detail }) => update("snmpVersion", detail.selectedOption)}
                      options={SNMP_VERSION_OPTIONS}
                      placeholder={t("device.selectSnmpVersion")}
                    />
                  </FormField>
                  <FormField label={t("device.snmpCommunity")}>
                    <Input
                      value={form.snmpCommunity}
                      onChange={({ detail }) => update("snmpCommunity", detail.value)}
                      placeholder="public"
                    />
                  </FormField>
                  <FormField label={t("device.snmpPort")}>
                    <Input
                      value={form.snmpPort}
                      onChange={({ detail }) => update("snmpPort", detail.value)}
                      inputMode="numeric"
                      placeholder="161"
                    />
                  </FormField>
                </SpaceBetween>
              </Container>

              <Container header={<Header variant="h2">{t("device.pollingInterval")}</Header>}>
                <SpaceBetween size="l">
                  <FormField label={t("device.pollingInterval")} constraintText="Minimum 30 seconds">
                    <Input
                      value={form.pollingInterval}
                      onChange={({ detail }) => update("pollingInterval", detail.value)}
                      inputMode="numeric"
                      placeholder="300"
                    />
                  </FormField>
                  <FormField label={t("device.pollingEnabled")}>
                    <Toggle
                      checked={form.pollingEnabled}
                      onChange={({ detail }) => update("pollingEnabled", detail.checked)}
                    >
                      {form.pollingEnabled ? t("common.enabled") : t("common.disabled")}
                    </Toggle>
                  </FormField>
                </SpaceBetween>
              </Container>

              <Container header={<Header variant="h2">{t("device.coordinates")}</Header>}>
                <SpaceBetween size="l">
                  <FormField label={t("device.latitude")} description="Optional">
                    <Input
                      value={form.latitude}
                      onChange={({ detail }) => update("latitude", detail.value)}
                      inputMode="decimal"
                      placeholder="37.5665"
                    />
                  </FormField>
                  <FormField label={t("device.longitude")} description="Optional">
                    <Input
                      value={form.longitude}
                      onChange={({ detail }) => update("longitude", detail.value)}
                      inputMode="decimal"
                      placeholder="126.9780"
                    />
                  </FormField>
                </SpaceBetween>
              </Container>

              <Container header={<Header variant="h2">{t("device.tags")}</Header>}>
                <SpaceBetween size="l">
                  <FormField label={t("device.addTag")} description="Press Enter to add a tag">
                    <SpaceBetween direction="horizontal" size="xs">
                      <Input
                        value={form.tagInput}
                        onChange={({ detail }) => update("tagInput", detail.value)}
                        onKeyDown={({ detail }) => handleTagKeyDown(detail.key)}
                        placeholder="production"
                      />
                      <Button onClick={handleAddTag} iconName="add-plus">
                        {t("device.addTag")}
                      </Button>
                    </SpaceBetween>
                  </FormField>
                  {form.tags.length > 0 && (
                    <TokenGroup
                      items={form.tags.map((tag) => ({ label: tag, dismissLabel: `Remove ${tag}` }))}
                      onDismiss={({ detail }) => {
                        setForm((prev) =>
                          prev ? { ...prev, tags: prev.tags.filter((_, i) => i !== detail.itemIndex) } : prev,
                        );
                      }}
                    />
                  )}
                </SpaceBetween>
              </Container>
            </SpaceBetween>
          </Form>
        </form>
      </SpaceBetween>
    </ContentLayout>
  );
}
