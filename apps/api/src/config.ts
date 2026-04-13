import "dotenv/config";

const isProduction = process.env.NODE_ENV === "production";

function requireEnv(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    throw new Error(`${name} environment variable is required in production`);
  }
  return devFallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "info",
  apiPort: parseInt(process.env.API_PORT || "4000", 10),
  databaseUrl: requireEnv("DATABASE_URL", "postgresql://netpulse:netpulse@localhost:5432/netpulse"),
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwtSecret: requireEnv("NEXTAUTH_SECRET", "dev-secret-change-me-not-for-production"),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
  },
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || "",
  },
  twilio: {
    sid: process.env.TWILIO_SID || "",
    token: process.env.TWILIO_TOKEN || "",
    from: process.env.TWILIO_FROM || "",
  },
  pagerduty: {
    routingKey: process.env.PAGERDUTY_ROUTING_KEY || "",
  },
} as const;
