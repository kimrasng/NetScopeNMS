import { describe, expect, it } from "vitest";
import { channelPayload, configValue, setConfigValue, validateChannelConfig } from "../lib/notification-config";

const email = { smtp: { host: "smtp.example.test", port: "587", user: "qa", pass: "fixture-password", from: "" }, to: "qa@example.test" };

describe("Notification channel configuration", () => {
  it("submits a numeric SMTP port and omits an optional empty sender", () => {
    expect(validateChannelConfig("email", email)).toEqual({});
    expect(channelPayload("email", email)).toEqual({ smtp: { host: "smtp.example.test", port: 587, user: "qa", pass: "fixture-password" }, to: "qa@example.test" });
    expect(email.smtp).toHaveProperty("from", "");
  });
  it("updates nested fields without mutating stored configuration", () => {
    const changed = setConfigValue(email, "smtp.port", "465");
    expect(configValue(changed, "smtp.port")).toBe("465");
    expect(configValue(email, "smtp.port")).toBe("587");
    expect(configValue(changed, "smtp.host")).toBe("smtp.example.test");
  });
  it("accepts a stored masked credential while rejecting a new fake mask", () => {
    const config = { url: "[REDACTED]" };
    expect(validateChannelConfig("webhook", config, config)).toEqual({});
    expect(validateChannelConfig("webhook", config).url).toBeDefined();
    expect(validateChannelConfig("telegram", { botToken: "[REDACTED]", chatId: "42" }).botToken).toBeDefined();
  });
  it("rejects invalid recipients, ports, URL protocols and header injection", () => {
    expect(validateChannelConfig("email", { ...email, smtp: { ...email.smtp, port: "0" }, to: "bad-address" })).toHaveProperty("smtp.port");
    expect(validateChannelConfig("email", { ...email, to: "bad-address" })).toHaveProperty("to");
    expect(validateChannelConfig("webhook", { url: "javascript:alert(1)" })).toHaveProperty("url");
    expect(validateChannelConfig("webhook", { url: "https://example.test", headers: { Authorization: "value\r\nInjected: value" } })).toHaveProperty("headers");
  });
  it("needs no external configuration for in-app delivery", () => {
    expect(validateChannelConfig("in_app", {})).toEqual({});
    expect(channelPayload("in_app", {})).toEqual({});
  });
});
