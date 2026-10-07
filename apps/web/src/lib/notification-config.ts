export interface ChannelField { path: string; label: string; kind?: "secret" | "url" | "email" | "port"; optional?: boolean }
export const channelFields: Record<string, ChannelField[]> = {
  email: [{ path: "smtp.host", label: "SMTP host" }, { path: "smtp.port", label: "SMTP port", kind: "port" }, { path: "smtp.user", label: "SMTP username" }, { path: "smtp.pass", label: "SMTP password", kind: "secret" }, { path: "smtp.from", label: "Sender email", kind: "email", optional: true }, { path: "to", label: "Recipient email", kind: "email" }],
  telegram: [{ path: "botToken", label: "Bot token", kind: "secret" }, { path: "chatId", label: "Chat ID" }],
  discord: [{ path: "webhookUrl", label: "Webhook URL", kind: "url" }],
  slack: [{ path: "webhookUrl", label: "Webhook URL", kind: "url" }],
  sms: [{ path: "twilio.sid", label: "Account SID" }, { path: "twilio.token", label: "Auth token", kind: "secret" }, { path: "twilio.from", label: "Sender number" }, { path: "to", label: "Recipient number" }],
  pagerduty: [{ path: "routingKey", label: "Routing key", kind: "secret" }],
  webhook: [{ path: "url", label: "Webhook URL", kind: "url" }],
  in_app: [],
};
export function configValue(config: Record<string, unknown>, path: string): string {
  let value: unknown = config;
  for (const key of path.split(".")) value = value && typeof value === "object" && key in value ? (value as Record<string, unknown>)[key] : undefined;
  return value == null ? "" : String(value);
}
export function setConfigValue(config: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const [key, ...rest] = path.split(".");
  const previous = config[key];
  return { ...config, [key]: rest.length ? setConfigValue(previous && typeof previous === "object" && !Array.isArray(previous) ? previous as Record<string, unknown> : {}, rest.join("."), value) : value };
}
export function validateChannelConfig(type: string, config: Record<string, unknown>, stored?: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of channelFields[type] ?? []) {
    const value = configValue(config, field.path).trim();
    if (value === "[REDACTED]") {
      if (stored && configValue(stored, field.path) === "[REDACTED]") continue;
      errors[field.path] = "Enter a value."; continue;
    }
    if (!value) { if (!field.optional) errors[field.path] = "Enter a value."; continue; }
    if (field.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field.path] = "Enter a valid email address.";
    if (field.kind === "url") { try { if (!["http:", "https:"].includes(new URL(value).protocol)) throw new Error(); } catch { errors[field.path] = "Enter an HTTP or HTTPS URL."; } }
    if (field.kind === "port" && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 65535)) errors[field.path] = "Enter a port between 1 and 65535.";
  }
  if (type === "webhook" && config.headers && typeof config.headers === "object" && Object.entries(config.headers).some(([name, value]) => !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || typeof value !== "string" || /[\r\n]/.test(value))) errors.headers = "Enter valid HTTP header names and values.";
  return errors;
}
export function channelPayload(type: string, config: Record<string, unknown>): Record<string, unknown> {
  let payload = { ...config };
  for (const field of channelFields[type] ?? []) {
    const value = configValue(config, field.path);
    if (field.optional && !value.trim()) {
      // Optional sender is omitted instead of submitting an invalid empty email.
      if (field.path === "smtp.from" && payload.smtp && typeof payload.smtp === "object") { const smtp = { ...payload.smtp }; delete (smtp as Record<string, unknown>).from; payload = { ...payload, smtp }; }
      continue;
    }
    payload = setConfigValue(payload, field.path, field.kind === "port" ? Number(value) : field.kind === "secret" ? value : value.trim());
  }
  return payload;
}
