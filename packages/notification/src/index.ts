import nodemailer from "nodemailer";
import { z } from "zod";

const httpUrl = z.string().url().refine(value => ["http:", "https:"].includes(new URL(value).protocol), "Use an HTTP or HTTPS URL");
export const notificationTransportSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("email"), config: z.object({ smtp: z.object({ host: z.string().min(1), port: z.number().int().min(1).max(65535), user: z.string().min(1), pass: z.string().min(1), from: z.string().email().optional() }), to: z.string().email() }) }),
  z.object({ type: z.literal("telegram"), config: z.object({ botToken: z.string().min(1), chatId: z.string().min(1) }) }),
  z.object({ type: z.literal("discord"), config: z.object({ webhookUrl: httpUrl }) }),
  z.object({ type: z.literal("slack"), config: z.object({ webhookUrl: httpUrl }) }),
  z.object({ type: z.literal("sms"), config: z.object({ twilio: z.object({ sid: z.string().min(1), token: z.string().min(1), from: z.string().min(1) }), to: z.string().min(1) }) }),
  z.object({ type: z.literal("pagerduty"), config: z.object({ routingKey: z.string().min(1) }) }),
  z.object({ type: z.literal("webhook"), config: z.object({ url: httpUrl, headers: z.record(z.string()).optional(), template: z.string().optional() }) }),
  z.object({ type: z.literal("in_app"), config: z.object({}) }),
]);

async function checkedFetch(url: string, options: RequestInit) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Notification delivery rejected (HTTP ${response.status})`);
  return response;
}

// ─── Types ───────────────────────────────────────────
export interface NotificationPayload {
  deviceName: string;
  deviceIp: string;
  alertType: string;
  severity: "critical" | "high" | "medium" | "low";
  timestamp: string;
  metricValue: string;
  aiSummary?: string;
  incidentUrl: string;
  incidentId: string;
  event?: "trigger" | "resolved" | "escalated" | "test";
  runbookUrl?: string;
}

export interface ChannelConfig {
  type: string;
  config: Record<string, unknown>;
}

// ─── Severity Colors ─────────────────────────────────
const SEVERITY_COLORS: Record<string, { hex: string; emoji: string }> = {
  critical: { hex: "#DC2626", emoji: "🔴" },
  high: { hex: "#EA580C", emoji: "🟠" },
  medium: { hex: "#CA8A04", emoji: "🟡" },
  low: { hex: "#2563EB", emoji: "🔵" },
};

// ─── Email ───────────────────────────────────────────
export async function sendEmail(
  config: { host: string; port: number; user: string; pass: string; from?: string },
  to: string,
  payload: NotificationPayload
) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });

  const color = SEVERITY_COLORS[payload.severity] || SEVERITY_COLORS.medium;

  await transporter.sendMail({
    from: config.from ?? config.user,
    to,
    subject: `[${payload.severity.toUpperCase()}] ${payload.alertType} - ${payload.deviceName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:${color.hex};color:white;padding:16px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">${color.emoji} ${payload.severity.toUpperCase()} Alert</h2>
        </div>
        <div style="border:1px solid #e5e7eb;padding:20px;border-radius:0 0 8px 8px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px;font-weight:bold;">Device</td><td style="padding:8px;">${payload.deviceName} (${payload.deviceIp})</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Alert</td><td style="padding:8px;">${payload.alertType}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Value</td><td style="padding:8px;">${payload.metricValue}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Time</td><td style="padding:8px;">${payload.timestamp}</td></tr>
          </table>
          ${payload.aiSummary ? `<div style="background:#f3f4f6;padding:12px;border-radius:6px;margin-top:16px;"><strong>AI Analysis:</strong><br/>${payload.aiSummary}</div>` : ""}
          <div style="margin-top:20px;text-align:center;">
            <a href="${payload.incidentUrl}" style="background:${color.hex};color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">View Incident</a>
          </div>
        </div>
      </div>
    `,
  });
}

// ─── Telegram ────────────────────────────────────────
export async function sendTelegram(botToken: string, chatId: string, payload: NotificationPayload) {
  const color = SEVERITY_COLORS[payload.severity] || SEVERITY_COLORS.medium;
  const escape = (value: string, limit: number) => {
    const characters = Array.from(value);
    const bounded = characters.slice(0, limit).join("") + (characters.length > limit ? "…" : "");
    return bounded.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };
  const event = payload.event === "resolved" ? "Recovery" : payload.event === "escalated" ? "Escalated Alert" : payload.event === "test" ? "Test Alert" : "Alert";
  const text = `${color.emoji} <b>${payload.severity.toUpperCase()} ${event}</b>

<b>Device:</b> ${escape(payload.deviceName, 512)} (${escape(payload.deviceIp, 64)})
<b>Alert:</b> ${escape(payload.alertType, 512)}
<b>Value:</b> ${escape(payload.metricValue, 256)}
<b>Time:</b> ${escape(payload.timestamp, 64)}
${payload.aiSummary ? `\n<b>AI Analysis:</b> ${escape(payload.aiSummary, 1800)}` : ""}`;

  let includeIncidentLink = false;
  try {
    const url = new URL(payload.incidentUrl);
    const loopback = url.hostname === "localhost" || url.hostname.endsWith(".localhost") || /^127\./.test(url.hostname) || url.hostname === "[::1]";
    includeIncidentLink = ["http:", "https:"].includes(url.protocol) && !loopback;
  } catch {
    // A malformed incident link must not prevent the alert itself from being sent.
  }

  await checkedFetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(includeIncidentLink ? { reply_markup: {
        inline_keyboard: [[
          { text: "🔗 View Incident", url: payload.incidentUrl },
        ]],
      } } : {}),
    }),
  });
}

// ─── Discord ─────────────────────────────────────────
export async function sendDiscord(webhookUrl: string, payload: NotificationPayload) {
  const color = parseInt(SEVERITY_COLORS[payload.severity]?.hex.replace("#", "") || "CCCCCC", 16);

  await checkedFetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: `${payload.severity.toUpperCase()} Alert: ${payload.alertType}`,
        color,
        fields: [
          { name: "Device", value: `${payload.deviceName} (${payload.deviceIp})`, inline: true },
          { name: "Value", value: payload.metricValue, inline: true },
          { name: "Time", value: payload.timestamp, inline: true },
          ...(payload.aiSummary ? [{ name: "AI Analysis", value: payload.aiSummary }] : []),
        ],
        url: payload.incidentUrl,
        timestamp: new Date().toISOString(),
      }],
    }),
  });
}

// ─── Slack ───────────────────────────────────────────
export async function sendSlack(webhookUrl: string, payload: NotificationPayload) {
  await checkedFetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `${SEVERITY_COLORS[payload.severity]?.emoji || "⚠️"} ${payload.severity.toUpperCase()} Alert` },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Device:*\n${payload.deviceName} (${payload.deviceIp})` },
            { type: "mrkdwn", text: `*Alert:*\n${payload.alertType}` },
            { type: "mrkdwn", text: `*Value:*\n${payload.metricValue}` },
            { type: "mrkdwn", text: `*Time:*\n${payload.timestamp}` },
          ],
        },
        ...(payload.aiSummary ? [{
          type: "section",
          text: { type: "mrkdwn", text: `> *AI Analysis:* ${payload.aiSummary}` },
        }] : []),
        {
          type: "actions",
          elements: [
            { type: "button", text: { type: "plain_text", text: "View Incident" }, url: payload.incidentUrl },
          ],
        },
      ],
    }),
  });
}

// ─── SMS (Twilio) ────────────────────────────────────
export async function sendSMS(config: { sid: string; token: string; from: string }, to: string, payload: NotificationPayload) {
  const body = `[${payload.severity.toUpperCase()}] ${payload.alertType} - ${payload.deviceName} (${payload.deviceIp}) Value: ${payload.metricValue}`;

  const params = new URLSearchParams({ To: to, From: config.from, Body: body });
  await checkedFetch(`https://api.twilio.com/2010-04-01/Accounts/${config.sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${config.sid}:${config.token}`).toString("base64")}`,
    },
    body: params.toString(),
  });
}

// ─── PagerDuty ───────────────────────────────────────
export async function sendPagerDuty(routingKey: string, payload: NotificationPayload, action: "trigger" | "resolve" = "trigger") {
  await checkedFetch("https://events.pagerduty.com/v2/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      routing_key: routingKey,
      event_action: action,
      dedup_key: payload.incidentId,
      payload: {
        summary: `[${payload.severity.toUpperCase()}] ${payload.alertType} - ${payload.deviceName}`,
        source: payload.deviceIp,
        severity: payload.severity === "critical" ? "critical" : payload.severity === "high" ? "error" : payload.severity === "medium" ? "warning" : "info",
        timestamp: payload.timestamp,
        custom_details: {
          device: `${payload.deviceName} (${payload.deviceIp})`,
          metric_value: payload.metricValue,
          ai_summary: payload.aiSummary,
        },
      },
      links: [{ href: payload.incidentUrl, text: "View in NetPulse" }],
    }),
  });
}

// ─── Custom Webhook ──────────────────────────────────
export async function sendWebhook(
  config: { url: string; headers?: Record<string, string>; template?: string },
  payload: NotificationPayload
) {
  const body = config.template
    ? config.template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(Object.entries(payload).find(([field]) => field === key)?.[1] ?? ""))
    : JSON.stringify(payload);

  await checkedFetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...config.headers },
    body,
  });
}

// ─── Dispatcher ──────────────────────────────────────
/**
 * Send notification to a specific channel.
 */
export async function dispatchNotification(input: ChannelConfig, payload: NotificationPayload): Promise<void> {
  if (!notificationTransportSchema.options.some(option => option.shape.type.value === input.type)) throw new Error(`Unsupported notification channel type: ${input.type}`);
  const channel = notificationTransportSchema.parse(input);
  switch (channel.type) {
    case "email":
      await sendEmail(channel.config.smtp, channel.config.to, payload);
      break;
    case "telegram":
      await sendTelegram(channel.config.botToken, channel.config.chatId, payload);
      break;
    case "discord":
      await sendDiscord(channel.config.webhookUrl, payload);
      break;
    case "slack":
      await sendSlack(channel.config.webhookUrl, payload);
      break;
    case "sms":
      await sendSMS(channel.config.twilio, channel.config.to, payload);
      break;
    case "pagerduty":
      await sendPagerDuty(channel.config.routingKey, payload, payload.event === "resolved" ? "resolve" : "trigger");
      break;
    case "webhook":
      await sendWebhook(channel.config, payload);
      break;
    case "in_app":
      break;
  }
}
