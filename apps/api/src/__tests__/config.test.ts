import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses environment variables when set", async () => {
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://custom:5432/mydb";
    process.env.NEXTAUTH_SECRET = "my-secret";
    process.env.API_PORT = "5000";
    process.env.LOG_LEVEL = "debug";

    const { config } = await import("../config.js");

    expect(config.databaseUrl).toBe("postgresql://custom:5432/mydb");
    expect(config.jwtSecret).toBe("my-secret");
    expect(config.apiPort).toBe(5000);
    expect(config.logLevel).toBe("debug");
  });

  it("uses dev fallbacks when env vars are missing in development", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.DATABASE_URL;
    delete process.env.NEXTAUTH_SECRET;

    const { config } = await import("../config.js");

    expect(config.databaseUrl).toBe("postgresql://netpulse:netpulse@localhost:5432/netpulse");
    expect(config.jwtSecret).toBe("dev-secret-change-me-not-for-production");
  });

  it("throws in production when required env vars are missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    delete process.env.NEXTAUTH_SECRET;

    await expect(import("../config.js")).rejects.toThrow("environment variable is required in production");
  });

  it("parses API_PORT as integer with default 4000", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.API_PORT;

    const { config } = await import("../config.js");
    expect(config.apiPort).toBe(4000);
  });

  it("reads SMTP config from env", async () => {
    process.env.NODE_ENV = "development";
    process.env.SMTP_HOST = "mail.example.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "secret";

    const { config } = await import("../config.js");

    expect(config.smtp.host).toBe("mail.example.com");
    expect(config.smtp.port).toBe(465);
    expect(config.smtp.user).toBe("user@example.com");
    expect(config.smtp.pass).toBe("secret");
  });

  it("defaults CORS origin to localhost:3000", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.CORS_ORIGIN;

    const { config } = await import("../config.js");
    expect(config.corsOrigin).toBe("http://localhost:3000");
  });

  it("defaults Redis URL to localhost:6379", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.REDIS_URL;

    const { config } = await import("../config.js");
    expect(config.redisUrl).toBe("redis://localhost:6379");
  });
});
