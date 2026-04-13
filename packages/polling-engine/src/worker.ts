import "dotenv/config";
import { startPollingEngine } from "@netpulse/polling-engine";

/**
 * Standalone polling engine worker process.
 * Run with: npx tsx packages/polling-engine/src/worker.ts
 */
const config = {
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  databaseUrl: process.env.DATABASE_URL || "postgresql://netpulse:netpulse@localhost:5432/netpulse",
  concurrency: parseInt(process.env.POLL_CONCURRENCY || "10", 10),
};

console.log("Starting NetPulse Polling Engine...");
console.log(`Redis: ${config.redisUrl}`);
console.log(`Database: ${config.databaseUrl.replace(/\/\/.*@/, "//***@")}`);
console.log(`Concurrency: ${config.concurrency}`);

const engine = startPollingEngine(config);

// Schedule polling for all enabled devices
engine.schedulePolling().then(() => {
  console.log("Polling engine is running. Press Ctrl+C to stop.");
}).catch((err) => {
  console.error("Failed to schedule polling:", err);
  process.exit(1);
});
