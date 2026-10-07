import "../env.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://netpulse:netpulse@localhost:5432/netpulse";
const client = postgres(databaseUrl, { max: 1 });
try {
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  const initialization = await readFile(new URL("../../drizzle/init-timescale.sql", import.meta.url), "utf8");
  await client.unsafe(initialization).simple();
  console.info("Database migrations and Timescale policies applied.");
} finally { await client.end(); }
