"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import Toggle from "@cloudscape-design/components/toggle";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Container from "@cloudscape-design/components/container";
import TokenGroup from "@cloudscape-design/components/token-group";
import type { SelectProps } from "@cloudscape-design/components/select";
import { apiPost } from "@/lib/api";
import { useNotifications } from "@/hooks/use-notifications";
import { useI18n } from "@/lib/i18n";
import { DeviceConnectionFields, connectionState, connectionPayload } from "@/components/common/device-connection-fields";
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

const INITIAL_STATE: FormState = {
  name: "",
  ip: "",
  type: null,
  location: "",
  snmpVersion: null,
  snmpCommunity: "",
  snmpPort: "161",
  pollingInterval: "300",
  pollingEnabled: true,
  latitude: "",
  longitude: "",
  tagInput: "",
  tags: [],
};

export default function CreateDevicePage() {
  const { t } = useI18n();
  const router = useRouter();
  const { addNotification } = useNotifications();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [connection, setConnection] = useState(connectionState());
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleAddTag() {
    const tag = form.tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tag], tagInput: "" }));
    }
  }

  function handleTagKeyDown(key: string) {
    if (key === "Enter") {
      handleAddTag();
    }
  }

  async function handleSubmit() {
    setError("");
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = t("Name is required.");
    if (!form.ip.trim()) errors.ip = t("Enter an IP address.");
    if (!form.type) errors.type = t("Select a device type.");
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
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
        ...connectionPayload(connection, form.snmpVersion?.value),
      };
      await apiPost<Device>("/api/devices", body);
      addNotification({ type: "success", content: "Device created successfully." });
      router.push("/devices");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create device.");
      setSubmitting(false);
    }
  }

  return (
    <ContentLayout header={<Header variant="h1">{t("page.devices.create")}</Header>}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => router.push("/devices")}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" loading={submitting} formAction="submit">
                {t("device.createDevice")}
              </Button>
            </SpaceBetween>
          }
          errorText={error}
        >
          <SpaceBetween size="l">

            <Container header={<Header variant="h2">{t("device.basicInfo")}</Header>}>
              <SpaceBetween size="l">
                <FormField label={t("common.name")} errorText={fieldErrors.name} constraintText={t("Required")}>
                  <Input
                    value={form.name}
                    onChange={({ detail }) => update("name", detail.value)}
                    placeholder={t("core-router-01")}
                  />
                </FormField>
                <FormField label={t("device.ip")} errorText={fieldErrors.ip} constraintText={t("Required")}>
                  <Input
                    value={form.ip}
                    onChange={({ detail }) => update("ip", detail.value)}
                    placeholder="192.168.1.1"
                  />
                </FormField>
                <FormField label={t("common.type")} errorText={fieldErrors.type} constraintText={t("Required")}>
                  <Select
                    selectedOption={form.type ? { ...form.type, label: t(`deviceType.${form.type.value}`) } : null}
                    onChange={({ detail }) => update("type", detail.selectedOption)}
                    options={DEVICE_TYPE_OPTIONS.map(option => ({ ...option, label: t(`deviceType.${option.value}`) }))}
                    placeholder={t("device.selectType")}
                  />
                </FormField>
                <FormField label={t("device.location")}>
                  <Input
                    value={form.location}
                    onChange={({ detail }) => update("location", detail.value)}
                    placeholder={t("Data Center A, Rack 12")}
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
                    placeholder={t("public")}
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

            <Container header={<Header variant="h2">{t("Connection settings")}</Header>}>
              <DeviceConnectionFields value={connection} onChange={setConnection} version={form.snmpVersion?.value} editing={false} />
            </Container>

            <Container header={<Header variant="h2">{t("device.pollingInterval")}</Header>}>
              <SpaceBetween size="l">
                <FormField
                  label={t("device.pollingInterval")}
                  constraintText={t("Minimum 30 seconds")}
                >
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

            <ExpandableSection variant="container" headerText={t("device.coordinates")} >
              <SpaceBetween size="l">
                <FormField label={t("device.latitude")} description={t("Optional")}>
                  <Input
                    value={form.latitude}
                    onChange={({ detail }) => update("latitude", detail.value)}
                    inputMode="decimal"
                    placeholder="37.5665"
                  />
                </FormField>
                <FormField label={t("device.longitude")} description={t("Optional")}>
                  <Input
                    value={form.longitude}
                    onChange={({ detail }) => update("longitude", detail.value)}
                    inputMode="decimal"
                    placeholder="126.9780"
                  />
                </FormField>
              </SpaceBetween>
            </ExpandableSection>

            <ExpandableSection variant="container" headerText={t("device.tags")} >
              <SpaceBetween size="l">
                <FormField label={t("device.addTag")} description={t("Press Enter to add a tag")}>
                  <SpaceBetween direction="horizontal" size="xs">
                    <Input
                      value={form.tagInput}
                      onChange={({ detail }) => update("tagInput", detail.value)}
                      onKeyDown={({ detail }) => handleTagKeyDown(detail.key)}
                      placeholder={t("production")}
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
                      setForm((prev) => ({
                        ...prev,
                        tags: prev.tags.filter((_, i) => i !== detail.itemIndex),
                      }));
                    }}
                  />
                )}
              </SpaceBetween>
            </ExpandableSection>
          </SpaceBetween>
        </Form>
      </form>
    </ContentLayout>
  );
}
