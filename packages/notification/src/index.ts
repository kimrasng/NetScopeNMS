import nodemailer from "nodemailer";

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
  config: { host: string; port: number; user: string; pass: string },
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
    from: config.user,
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
  const text = `${color.emoji} *${payload.severity.toUpperCase()} Alert*

*Device:* ${payload.deviceName} (${payload.deviceIp})
*Alert:* ${payload.alertType}
*Value:* ${payload.metricValue}
*Time:* ${payload.timestamp}
${payload.aiSummary ? `\n*AI Analysis:* ${payload.aiSummary}` : ""}`;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Acknowledge", callback_data: `ack:${payload.incidentId}` },
          { text: "🔗 View Incident", url: payload.incidentUrl },
        ]],
      },
    }),
  });
}

// ─── Discord ─────────────────────────────────────────
export async function sendDiscord(webhookUrl: string, payload: NotificationPayload) {
  const color = parseInt(SEVERITY_COLORS[payload.severity]?.hex.replace("#", "") || "CCCCCC", 16);

  await fetch(webhookUrl, {
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
  await fetch(webhookUrl, {
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
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.sid}/Messages.json`, {
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
  await fetch("https://events.pagerduty.com/v2/enqueue", {
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
    ? config.template.replace(/\{\{(\w+)\}\}/g, (_, key) => (payload as any)[key] || "")
    : JSON.stringify(payload);

  await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...config.headers },
    body,
  });
}

// ─── Dispatcher ──────────────────────────────────────
/**
 * Send notification to a specific channel.
 */
export async function dispatchNotification(channel: ChannelConfig, payload: NotificationPayload): Promise<void> {
  const cfg = channel.config as any;
  switch (channel.type) {
    case "email":
      await sendEmail(cfg.smtp, cfg.to, payload);
      break;
    case "telegram":
      await sendTelegram(cfg.botToken, cfg.chatId, payload);
      break;
    case "discord":
      await sendDiscord(cfg.webhookUrl, payload);
      break;
    case "slack":
      await sendSlack(cfg.webhookUrl, payload);
      break;
    case "sms":
      await sendSMS(cfg.twilio, cfg.to, payload);
      break;
    case "pagerduty":
      await sendPagerDuty(cfg.routingKey, payload);
      break;
    case "webhook":
      await sendWebhook(cfg, payload);
      break;
    default:
      console.warn(`Unknown notification channel type: ${channel.type}`);
  }
}
