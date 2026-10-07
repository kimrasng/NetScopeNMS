"use client";
import { useState } from "react";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Textarea from "@cloudscape-design/components/textarea";
import SpaceBetween from "@cloudscape-design/components/space-between";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Box from "@cloudscape-design/components/box";
import { channelFields, configValue, setConfigValue } from "@/lib/notification-config";
import { useI18n } from "@/lib/i18n";

export function NotificationConfigFields({ type, config, stored, errors, onChange }: {
  type: string; config: Record<string, unknown>; stored?: Record<string, unknown>; errors: Record<string, string>; onChange: (config: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const initialHeaders = config.headers && typeof config.headers === "object" ? Object.entries(config.headers).map(([name, value]) => `${name}: ${value}`).join("\n") : "";
  const [headers, setHeaders] = useState(initialHeaders);
  return <SpaceBetween size="m">
    {(channelFields[type] ?? []).map(field => {
      const value = configValue(config, field.path);
      const retained = stored && configValue(stored, field.path) === "[REDACTED]";
      return <FormField key={field.path} label={t(field.label)} constraintText={field.optional ? t("Optional") : undefined} description={retained ? t("Leave blank to retain the stored secret.") : undefined} errorText={errors[field.path] ? t(errors[field.path]) : undefined}>
        <Input value={value === "[REDACTED]" ? "" : value} type={field.kind === "secret" || retained ? "password" : field.kind === "port" ? "number" : "text"} onChange={({ detail }) => onChange(setConfigValue(config, field.path, !detail.value && retained ? "[REDACTED]" : detail.value))} />
      </FormField>;
    })}
    {type === "in_app" && <Box>{t("Notifications are delivered inside NetPulse. No external credentials are needed.")}</Box>}
    {type === "webhook" && <ExpandableSection headerText={t("Advanced settings")}>
      <SpaceBetween size="m"><FormField label={t("HTTP headers")} constraintText={t("One header per line: Name: value")} errorText={errors.headers ? t(errors.headers) : undefined}><Textarea value={headers} onChange={({ detail }) => { setHeaders(detail.value); onChange({ ...config, headers: Object.fromEntries(detail.value.split("\n").filter(Boolean).map(line => { const index = line.indexOf(":"); return index < 0 ? [line, ""] : [line.slice(0, index).trim(), line.slice(index + 1).trim()]; })) }); }} /></FormField>
      <FormField label={t("Message template")} constraintText={t("Optional")}><Textarea value={String(config.template ?? "")} onChange={({ detail }) => onChange({ ...config, template: detail.value })} /></FormField></SpaceBetween>
    </ExpandableSection>}
  </SpaceBetween>;
}
