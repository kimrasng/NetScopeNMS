import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NotificationPayload, ChannelConfig } from "../index.js";

const sendMailMock = vi.fn().mockResolvedValue({ messageId: "test-id" });
const createTransportMock = vi.fn().mockReturnValue({ sendMail: sendMailMock });

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

function makePayload(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
  return {
    deviceName: "router-1",
    deviceIp: "10.0.0.1",
    alertType: "High CPU",
    severity: "critical",
    timestamp: "2024-01-01T00:00:00Z",
    metricValue: "95%",
    incidentUrl: "https://netpulse.local/incidents/123",
    incidentId: "inc-123",
    ...overrides,
  };
}

describe("Notification", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let mod: typeof import("../index.js");

  beforeEach(async () => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    sendMailMock.mockResolvedValue({ messageId: "test-id" });
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    mod = await import("../index.js");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("dispatchNotification", () => {
    it("routes email channel", async () => {
      const channel: ChannelConfig = {
        type: "email",
        config: { smtp: { host: "smtp.test", port: 587, user: "u", pass: "p" }, to: "admin@test.com" },
      };
      await expect(mod.dispatchNotification(channel, makePayload())).resolves.toBeUndefined();
    });

    it("routes telegram channel", async () => {
      const channel: ChannelConfig = {
        type: "telegram",
        config: { botToken: "bot123", chatId: "chat456" },
      };
      await mod.dispatchNotification(channel, makePayload());

      expect(fetchMock).toHaveBeenCalledOnce();
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("api.telegram.org/botbot123/sendMessage");
    });

    it("routes discord channel", async () => {
      const channel: ChannelConfig = {
        type: "discord",
        config: { webhookUrl: "https://discord.com/api/webhooks/test" },
      };
      await mod.dispatchNotification(channel, makePayload());

      expect(fetchMock).toHaveBeenCalledOnce();
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toBe("https://discord.com/api/webhooks/test");
    });

    it("routes slack channel", async () => {
      const channel: ChannelConfig = {
        type: "slack",
        config: { webhookUrl: "https://hooks.slack.com/services/test" },
      };
      await mod.dispatchNotification(channel, makePayload());

      expect(fetchMock).toHaveBeenCalledOnce();
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toBe("https://hooks.slack.com/services/test");
    });

    it("routes sms channel", async () => {
      const channel: ChannelConfig = {
        type: "sms",
        config: { twilio: { sid: "AC123", token: "tok", from: "+1234" }, to: "+5678" },
      };
      await mod.dispatchNotification(channel, makePayload());

      expect(fetchMock).toHaveBeenCalledOnce();
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain("api.twilio.com");
      expect(url).toContain("AC123");
    });

    it("routes pagerduty channel", async () => {
      const channel: ChannelConfig = {
        type: "pagerduty",
        config: { routingKey: "rk-test" },
      };
      await mod.dispatchNotification(channel, makePayload());

      expect(fetchMock).toHaveBeenCalledOnce();
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toBe("https://events.pagerduty.com/v2/enqueue");
    });

    it("routes webhook channel", async () => {
      const channel: ChannelConfig = {
        type: "webhook",
        config: { url: "https://example.com/hook" },
      };
      await mod.dispatchNotification(channel, makePayload());

      expect(fetchMock).toHaveBeenCalledOnce();
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toBe("https://example.com/hook");
    });

    it("logs warning for unknown channel type", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const channel: ChannelConfig = { type: "carrier-pigeon", config: {} };
      await mod.dispatchNotification(channel, makePayload());

      expect(warnSpy).toHaveBeenCalledWith("Unknown notification channel type: carrier-pigeon");
    });
  });

  describe("sendWebhook", () => {
    it("sends raw JSON payload when no template", async () => {
      await mod.sendWebhook({ url: "https://example.com/hook" }, makePayload());

      expect(fetchMock).toHaveBeenCalledOnce();
      const body = fetchMock.mock.calls[0][1].body;
      const parsed = JSON.parse(body);
      expect(parsed.deviceName).toBe("router-1");
      expect(parsed.severity).toBe("critical");
    });

    it("replaces {{variable}} placeholders in template", async () => {
      const template = "Alert: {{alertType}} on {{deviceName}} ({{deviceIp}}) - Severity: {{severity}}";
      await mod.sendWebhook({ url: "https://example.com/hook", template }, makePayload());

      const body = fetchMock.mock.calls[0][1].body;
      expect(body).toBe("Alert: High CPU on router-1 (10.0.0.1) - Severity: critical");
    });

    it("replaces unknown template variables with empty string", async () => {
      const template = "Device: {{deviceName}}, Unknown: {{nonexistent}}";
      await mod.sendWebhook({ url: "https://example.com/hook", template }, makePayload());

      const body = fetchMock.mock.calls[0][1].body;
      expect(body).toBe("Device: router-1, Unknown: ");
    });

    it("includes custom headers", async () => {
      await mod.sendWebhook(
        { url: "https://example.com/hook", headers: { "X-Custom": "value" } },
        makePayload(),
      );

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers["X-Custom"]).toBe("value");
      expect(headers["Content-Type"]).toBe("application/json");
    });
  });

  describe("severity in notifications", () => {
    it("telegram message includes correct emoji for critical", async () => {
      await mod.sendTelegram("bot", "chat", makePayload({ severity: "critical" }));
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.text).toContain("🔴");
      expect(body.text).toContain("CRITICAL");
    });

    it("telegram message includes correct emoji for high", async () => {
      await mod.sendTelegram("bot", "chat", makePayload({ severity: "high" }));
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.text).toContain("🟠");
      expect(body.text).toContain("HIGH");
    });

    it("telegram message includes correct emoji for medium", async () => {
      await mod.sendTelegram("bot", "chat", makePayload({ severity: "medium" }));
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.text).toContain("🟡");
      expect(body.text).toContain("MEDIUM");
    });

    it("telegram message includes correct emoji for low", async () => {
      await mod.sendTelegram("bot", "chat", makePayload({ severity: "low" }));
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.text).toContain("🔵");
      expect(body.text).toContain("LOW");
    });

    it("discord embed uses correct hex color for critical", async () => {
      await mod.sendDiscord("https://discord.com/hook", makePayload({ severity: "critical" }));
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.embeds[0].color).toBe(0xDC2626);
    });

    it("pagerduty maps critical to critical", async () => {
      await mod.sendPagerDuty("rk", makePayload({ severity: "critical" }));
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.payload.severity).toBe("critical");
    });

    it("pagerduty maps high to error", async () => {
      await mod.sendPagerDuty("rk", makePayload({ severity: "high" }));
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.payload.severity).toBe("error");
    });

    it("pagerduty maps medium to warning", async () => {
      await mod.sendPagerDuty("rk", makePayload({ severity: "medium" }));
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.payload.severity).toBe("warning");
    });

    it("pagerduty maps low to info", async () => {
      await mod.sendPagerDuty("rk", makePayload({ severity: "low" }));
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.payload.severity).toBe("info");
    });
  });

  describe("sendEmail", () => {
    it("creates transporter with correct config and sends mail", async () => {
      await mod.sendEmail(
        { host: "smtp.test", port: 587, user: "user@test.com", pass: "pass" },
        "admin@test.com",
        makePayload(),
      );

      expect(createTransportMock).toHaveBeenCalledWith({
        host: "smtp.test",
        port: 587,
        secure: false,
        auth: { user: "user@test.com", pass: "pass" },
      });
      expect(sendMailMock).toHaveBeenCalledOnce();
    });

    it("uses secure:true for port 465", async () => {
      await mod.sendEmail(
        { host: "smtp.test", port: 465, user: "u", pass: "p" },
        "admin@test.com",
        makePayload(),
      );

      expect(createTransportMock).toHaveBeenCalledWith(
        expect.objectContaining({ secure: true }),
      );
    });
  });
});
