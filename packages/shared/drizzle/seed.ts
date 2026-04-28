import "dotenv/config";
import { createDb, users, devices, deviceGroups, alertRules, notificationChannels } from "../src/index.js";
import bcrypt from "bcryptjs";

/**
 * Seed the database with initial data for development.
 */
async function seed() {
  const dbUrl = process.env.DATABASE_URL || "postgresql://netpulse:netpulse@localhost:5432/netpulse";
  const { db, client } = createDb(dbUrl);

  console.log("Seeding database...");

  // Create admin user
  const passwordHash = await bcrypt.hash("admin1234", 12);
  const [admin] = await db.insert(users).values({
    email: "admin@netpulse.local",
    passwordHash,
    name: "Admin",
    role: "super_admin",
  }).onConflictDoNothing().returning();
  console.log("Created admin user:", admin?.email || "(already exists)");

  // Create device groups
  const [coreGroup] = await db.insert(deviceGroups).values({ name: "Core Network", description: "Core routers and switches" }).onConflictDoNothing().returning();
  const [serverGroup] = await db.insert(deviceGroups).values({ name: "Server Farm", description: "Production servers" }).onConflictDoNothing().returning();
  const [edgeGroup] = await db.insert(deviceGroups).values({ name: "Edge Devices", description: "Edge routers and firewalls" }).onConflictDoNothing().returning();
  console.log("Created device groups");

  // Create sample devices
  const sampleDevices = [
    { name: "core-rtr-01", ip: "10.0.0.1", type: "router" as const, location: "Seoul DC1", latitude: 37.5665, longitude: 126.978, groupId: coreGroup?.id, snmpVersion: "v2c" as const, snmpCommunity: "public", status: "up" as const },
    { name: "core-sw-01", ip: "10.0.0.2", type: "switch" as const, location: "Seoul DC1", latitude: 37.5665, longitude: 126.978, groupId: coreGroup?.id, snmpVersion: "v2c" as const, snmpCommunity: "public", status: "up" as const },
    { name: "core-sw-02", ip: "10.0.0.3", type: "switch" as const, location: "Seoul DC1", latitude: 37.5665, longitude: 126.978, groupId: coreGroup?.id, snmpVersion: "v2c" as const, snmpCommunity: "public", status: "up" as const },
    { name: "web-srv-01", ip: "10.0.1.10", type: "server" as const, location: "Seoul DC1", latitude: 37.5665, longitude: 126.978, groupId: serverGroup?.id, status: "up" as const },
    { name: "web-srv-02", ip: "10.0.1.11", type: "server" as const, location: "Seoul DC1", latitude: 37.5665, longitude: 126.978, groupId: serverGroup?.id, status: "up" as const },
    { name: "db-srv-01", ip: "10.0.1.20", type: "server" as const, location: "Seoul DC1", latitude: 37.5665, longitude: 126.978, groupId: serverGroup?.id, status: "up" as const },
    { name: "edge-fw-01", ip: "10.0.2.1", type: "firewall" as const, location: "Busan DC2", latitude: 35.1796, longitude: 129.0756, groupId: edgeGroup?.id, snmpVersion: "v2c" as const, snmpCommunity: "public", status: "up" as const },
    { name: "edge-rtr-01", ip: "10.0.2.2", type: "router" as const, location: "Busan DC2", latitude: 35.1796, longitude: 129.0756, groupId: edgeGroup?.id, snmpVersion: "v2c" as const, snmpCommunity: "public", status: "warning" as const },
    { name: "ap-01", ip: "10.0.3.1", type: "access_point" as const, location: "Seoul Office", latitude: 37.5326, longitude: 127.0246, status: "up" as const },
    { name: "nas-01", ip: "10.0.1.30", type: "storage" as const, location: "Seoul DC1", latitude: 37.5665, longitude: 126.978, groupId: serverGroup?.id, status: "up" as const },
  ];

  for (const d of sampleDevices) {
    await db.insert(devices).values(d).onConflictDoNothing();
  }
  console.log(`Created ${sampleDevices.length} sample devices`);

  // Create alert rules
  const allDevices = await db.select().from(devices);
  if (allDevices.length > 0) {
    await db.insert(alertRules).values([
      { name: "High CPU", metricName: "cpu", operator: ">", threshold: 90, severity: "critical" as const, channels: [], flapThreshold: 3, flapWindow: 5 },
      { name: "High Memory", metricName: "memory", operator: ">", threshold: 85, severity: "high" as const, channels: [], flapThreshold: 3, flapWindow: 5 },
      { name: "Device Down", metricName: "ping", operator: "==", threshold: 0, severity: "critical" as const, channels: [], flapThreshold: 2, flapWindow: 3 },
      { name: "High Latency", metricName: "latency", operator: ">", threshold: 200, severity: "medium" as const, channels: [], flapThreshold: 3, flapWindow: 5 },
    ]).onConflictDoNothing();
    console.log("Created alert rules");
  }

  // Create sample notification channels
  await db.insert(notificationChannels).values([
    { name: "In-App Notifications", type: "in_app" as const, config: {}, enabled: true },
  ]).onConflictDoNothing();
  console.log("Created notification channels");

  console.log("Seed complete!");
  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
