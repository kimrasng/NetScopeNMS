import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, pgEnum, integer, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────
export const deviceTypeEnum = pgEnum("device_type", [
  "router", "switch", "server", "firewall", "access_point", "load_balancer", "storage", "other"
]);

export const deviceStatusEnum = pgEnum("device_status", [
  "up", "down", "warning", "unknown", "maintenance"
]);

export const snmpVersionEnum = pgEnum("snmp_version", ["v1", "v2c", "v3"]);

export const severityEnum = pgEnum("severity", ["critical", "high", "medium", "low"]);

export const incidentStatusEnum = pgEnum("incident_status", [
  "problem", "acknowledged", "resolved"
]);

export const userRoleEnum = pgEnum("user_role", [
  "super_admin", "admin", "operator", "viewer"
]);

export const notificationChannelTypeEnum = pgEnum("notification_channel_type", [
  "email", "telegram", "discord", "slack", "sms", "kakao", "pagerduty", "webhook", "in_app"
]);

// ─── Users ───────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  name: varchar("name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("viewer"),
  phone: varchar("phone", { length: 50 }),
  telegramChatId: varchar("telegram_chat_id", { length: 100 }),
  avatarUrl: text("avatar_url"),
  onCall: boolean("on_call").notNull().default(false),
  provider: varchar("provider", { length: 50 }).default("local"),
  providerId: varchar("provider_id", { length: 255 }),
  enabled: boolean("enabled").notNull().default(true),
  scope: varchar("scope", { length: 20 }).notNull().default("all"), // "all" | "restricted"
  allowedDeviceIds: jsonb("allowed_device_ids").$type<string[]>().default([]),
  allowedGroupIds: jsonb("allowed_group_ids").$type<string[]>().default([]),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Device Groups ───────────────────────────────────
export const deviceGroups = pgTable("device_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  parentId: uuid("parent_id"),
  tenantId: uuid("tenant_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Devices ─────────────────────────────────────────
export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  ip: varchar("ip", { length: 45 }).notNull(),
  type: deviceTypeEnum("type").notNull().default("other"),
  status: deviceStatusEnum("status").notNull().default("unknown"),
  snmpVersion: snmpVersionEnum("snmp_version"),
  snmpCommunity: varchar("snmp_community", { length: 255 }),
  snmpPort: integer("snmp_port").default(161),
  snmpV3Config: jsonb("snmp_v3_config"),
  sshHost: varchar("ssh_host", { length: 255 }),
  sshPort: integer("ssh_port").default(22),
  sshUsername: varchar("ssh_username", { length: 255 }),
  sshKeyEncrypted: text("ssh_key_encrypted"),
  location: varchar("location", { length: 500 }),
  latitude: real("latitude"),
  longitude: real("longitude"),
  groupId: uuid("group_id").references(() => deviceGroups.id),
  tags: jsonb("tags").$type<string[]>().default([]),
  pollingInterval: integer("polling_interval").notNull().default(60),
  pollingEnabled: boolean("polling_enabled").notNull().default(true),
  sysObjectId: varchar("sys_object_id", { length: 255 }),
  sysName: varchar("sys_name", { length: 255 }),
  sysDescr: text("sys_descr"),
  vendor: varchar("vendor", { length: 255 }),
  model: varchar("model", { length: 255 }),
  osVersion: varchar("os_version", { length: 255 }),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  tenantId: uuid("tenant_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Interfaces ──────────────────────────────────────
export const interfaces = pgTable("interfaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  ifIndex: integer("if_index").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  alias: varchar("alias", { length: 255 }),
  type: varchar("type", { length: 100 }),
  speed: real("speed"),
  status: varchar("status", { length: 50 }).default("unknown"),
  adminStatus: varchar("admin_status", { length: 50 }),
  macAddress: varchar("mac_address", { length: 17 }),
  inBps: real("in_bps").default(0),
  outBps: real("out_bps").default(0),
  inErrors: integer("in_errors").default(0),
  outErrors: integer("out_errors").default(0),
  lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Metrics (TimescaleDB hypertable) ────────────────
export const metrics = pgTable("metrics", {
  deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  metricName: varchar("metric_name", { length: 100 }).notNull(),
  value: real("value").notNull(),
  unit: varchar("unit", { length: 50 }),
  tags: jsonb("tags").$type<Record<string, string>>(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Alert Rules ─────────────────────────────────────
export const alertRules = pgTable("alert_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  deviceId: uuid("device_id").references(() => devices.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").references(() => deviceGroups.id),
  metricName: varchar("metric_name", { length: 100 }).notNull(),
  operator: varchar("operator", { length: 10 }).notNull(),
  threshold: real("threshold").notNull(),
  severity: severityEnum("severity").notNull().default("medium"),
  channels: jsonb("channels").$type<string[]>().default([]),
  flapThreshold: integer("flap_threshold").default(3),
  flapWindow: integer("flap_window").default(5),
  escalationMinutes: integer("escalation_minutes"),
  escalationChannels: jsonb("escalation_channels").$type<string[]>(),
  runbookUrl: text("runbook_url"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Incidents ───────────────────────────────────────
export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").notNull().references(() => devices.id),
  ruleId: uuid("rule_id").references(() => alertRules.id),
  severity: severityEnum("severity").notNull(),
  status: incidentStatusEnum("status").notNull().default("problem"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  metricName: varchar("metric_name", { length: 100 }),
  metricValue: real("metric_value"),
  aiRca: text("ai_rca"),
  aiSummary: text("ai_summary"),
  assignedTo: uuid("assigned_to").references(() => users.id),
  acknowledgedBy: uuid("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Incident Events ─────────────────────────────────
export const incidentEvents = pgTable("incident_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id").notNull().references(() => incidents.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Notification Channels ───────────────────────────
export const notificationChannels = pgTable("notification_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  type: notificationChannelTypeEnum("type").notNull(),
  config: jsonb("config").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Notifications ───────────────────────────────────
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id").references(() => incidents.id),
  channelId: uuid("channel_id").references(() => notificationChannels.id),
  channelType: notificationChannelTypeEnum("channel_type").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  payload: jsonb("payload"),
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Config Snapshots ────────────────────────────────
export const configSnapshots = pgTable("config_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  configText: text("config_text").notNull(),
  hash: varchar("hash", { length: 64 }).notNull(),
  diff: text("diff"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Reports ─────────────────────────────────────────
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  period: varchar("period", { length: 50 }),
  content: jsonb("content"),
  aiSummary: text("ai_summary"),
  generatedBy: uuid("generated_by").references(() => users.id),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Audit Log ───────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  resource: varchar("resource", { length: 100 }).notNull(),
  resourceId: varchar("resource_id", { length: 255 }),
  details: jsonb("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Maintenance Windows ─────────────────────────────
export const maintenanceWindows = pgTable("maintenance_windows", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  deviceIds: jsonb("device_ids").$type<string[]>().default([]),
  groupIds: jsonb("group_ids").$type<string[]>().default([]),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  recurring: boolean("recurring").default(false),
  cronExpression: varchar("cron_expression", { length: 100 }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── AI Providers ────────────────────────────────────
export const aiProviderTypeEnum = pgEnum("ai_provider_type", ["openai", "gemini", "claude", "custom"]);

export const aiProviders = pgTable("ai_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  type: aiProviderTypeEnum("type").notNull(),
  apiKey: text("api_key").notNull(),
  model: varchar("model", { length: 255 }),
  baseUrl: text("base_url"),
  enabled: boolean("enabled").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── System Settings ─────────────────────────────────
export const systemSettings = pgTable("system_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── User Invitations ────────────────────────────────
export const userInvitations = pgTable("user_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  role: userRoleEnum("role").notNull().default("viewer"),
  scope: varchar("scope", { length: 20 }).notNull().default("all"), // "all" | "restricted"
  allowedDeviceIds: jsonb("allowed_device_ids").$type<string[]>().default([]),
  allowedGroupIds: jsonb("allowed_group_ids").$type<string[]>().default([]),
  invitedBy: uuid("invited_by").references(() => users.id),
  usedAt: timestamp("used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── API Keys ────────────────────────────────────────
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  keyHash: varchar("key_hash", { length: 255 }).notNull(),
  prefix: varchar("prefix", { length: 10 }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relations ───────────────────────────────────────
export const devicesRelations = relations(devices, ({ one, many }) => ({
  group: one(deviceGroups, { fields: [devices.groupId], references: [deviceGroups.id] }),
  interfaces: many(interfaces),
  incidents: many(incidents),
  configSnapshots: many(configSnapshots),
}));

export const incidentsRelations = relations(incidents, ({ one, many }) => ({
  device: one(devices, { fields: [incidents.deviceId], references: [devices.id] }),
  rule: one(alertRules, { fields: [incidents.ruleId], references: [alertRules.id] }),
  assignee: one(users, { fields: [incidents.assignedTo], references: [users.id] }),
  events: many(incidentEvents),
  notifications: many(notifications),
}));

export const interfacesRelations = relations(interfaces, ({ one }) => ({
  device: one(devices, { fields: [interfaces.deviceId], references: [devices.id] }),
}));

export const incidentEventsRelations = relations(incidentEvents, ({ one }) => ({
  incident: one(incidents, { fields: [incidentEvents.incidentId], references: [incidents.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  incident: one(incidents, { fields: [notifications.incidentId], references: [incidents.id] }),
  channel: one(notificationChannels, { fields: [notifications.channelId], references: [notificationChannels.id] }),
}));
