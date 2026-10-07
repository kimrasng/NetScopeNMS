import "../env.js";
import { eq, sql } from "drizzle-orm";
import { createDb } from "./index.js";
import { devices, deviceGroups, metrics } from "../schema/index.js";

if (process.env.NODE_ENV === "production") throw new Error("Sample seeding is disabled in production");
const { db, client } = createDb(process.env.DATABASE_URL ?? "postgresql://netpulse:netpulse@localhost:5432/netpulse");
try {
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7824501)`);
    let [group] = await tx.select().from(deviceGroups).where(eq(deviceGroups.name, "Sample Network"));
    if (!group) [group] = await tx.insert(deviceGroups).values({ name: "Sample Network", description: "Sample devices; polling is disabled" }).returning();
    for (const [index, name] of ["Sample Router", "Sample Switch", "Sample Server"].entries()) {
      const [existing] = await tx.select().from(devices).where(eq(devices.name, name));
      if (existing) continue;
      const [device] = await tx.insert(devices).values({ name, ip: `192.0.2.${index + 1}`, type: index === 0 ? "router" : index === 1 ? "switch" : "server", groupId: group.id, pollingEnabled: false, tags: ["sample"], status: "unknown" }).returning();
      await tx.insert(metrics).values(Array.from({ length: 12 }, (_, n) => ({ deviceId: device.id, metricName: "cpu", value: 20 + n, unit: "%", timestamp: new Date(Date.now() - (12 - n) * 60000) })));
    }
  });
  console.info("Sample network created. Use the setup wizard to create an administrator.");
} finally { await client.end(); }
