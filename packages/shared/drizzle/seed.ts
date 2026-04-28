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
    { name: "core-router-01", ip: "10.100.0.11", type: "router" as const, location: "Seoul DC Rack A3", latitude: 37.5665, longitude: 126.978, groupId: coreGroup?.id, snmpVersion: "v2c" as const, snmpCommunity: "public", snmpPort: 161, status: "up" as const },
    { name: "core-router-02", ip: "10.100.0.12", type: "router" as const, location: "Seoul DC Rack B1", latitude: 37.5665, longitude: 126.978, groupId: coreGroup?.id, snmpVersion: "v2c" as const, snmpCommunity: "public", snmpPort: 161, status: "up" as const },
    { name: "dist-switch-01", ip: "10.100.0.13", type: "switch" as const, location: "Seoul DC Rack C2", latitude: 37.5665, longitude: 126.978, groupId: coreGroup?.id, snmpVersion: "v2c" as const, snmpCommunity: "public", snmpPort: 161, status: "up" as const },
    { name: "dist-switch-02", ip: "10.100.0.14", type: "switch" as const, location: "Seoul DC Rack D1", latitude: 37.5665, longitude: 126.978, groupId: coreGroup?.id, snmpVersion: "v2c" as const, snmpCommunity: "public", snmpPort: 161, status: "unknown" as const },
    { name: "web-server-01", ip: "10.100.0.15", type: "server" as const, location: "Seoul DC Rack E1", latitude: 37.5665, longitude: 126.978, groupId: serverGroup?.id, snmpVersion: "v2c" as const, snmpCommunity: "public", snmpPort: 161, status: "up" as const },
    { name: "db-server-01", ip: "10.100.0.16", type: "server" as const, location: "Seoul DC Rack E2", latitude: 37.5665, longitude: 126.978, groupId: serverGroup?.id, snmpVersion: "v2c" as const, snmpCommunity: "public", snmpPort: 161, status: "maintenance" as const },
    { name: "fw-main-01", ip: "10.100.0.17", type: "firewall" as const, location: "Seoul DC Rack A1", latitude: 37.5665, longitude: 126.978, groupId: edgeGroup?.id, snmpVersion: "v2c" as const, snmpCommunity: "public", snmpPort: 161, status: "warning" as const },
    { name: "ap-floor1-01", ip: "10.100.0.19", type: "access_point" as const, location: "Seoul Office 3F", latitude: 37.5326, longitude: 127.0246, snmpVersion: "v2c" as const, snmpCommunity: "public", snmpPort: 161, pollingEnabled: false, status: "down" as const },
    { name: "lb-frontend-01", ip: "10.100.0.18", type: "load_balancer" as const, location: "Seoul DC Rack A2", latitude: 37.5665, longitude: 126.978, groupId: edgeGroup?.id, snmpVersion: "v2c" as const, snmpCommunity: "public", snmpPort: 161, status: "up" as const },
    { name: "nas-backup-01", ip: "10.100.0.20", type: "storage" as const, location: "Seoul DC Rack F1", latitude: 37.5665, longitude: 126.978, groupId: serverGroup?.id, snmpVersion: "v2c" as const, snmpCommunity: "public", snmpPort: 161, pollingEnabled: false, status: "down" as const },
  ];

  await db.delete(devices);
  for (const d of sampleDevices) {
    await db.insert(devices).values(d);
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
