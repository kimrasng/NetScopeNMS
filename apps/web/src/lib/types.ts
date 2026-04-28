// ─── Shared Frontend Types ────────────────────────────

// ─── Auth ─────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "admin" | "operator" | "viewer";
  scope: string;
  phone?: string | null;
  avatarUrl?: string | null;
  onCall: boolean;
  enabled: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface LoginResponse {
  user: Pick<User, "id" | "email" | "name" | "role">;
  token: string;
}

// ─── Pagination ───────────────────────────────────────
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

// ─── Devices ──────────────────────────────────────────
export type DeviceType = "router" | "switch" | "server" | "firewall" | "access_point" | "load_balancer" | "storage" | "other";
export type DeviceStatus = "up" | "down" | "warning" | "unknown" | "maintenance";

export interface Device {
  id: string;
  name: string;
  ip: string;
  type: DeviceType;
  status: DeviceStatus;
  snmpVersion?: string | null;
  snmpCommunity?: string | null;
  snmpPort?: number | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  groupId?: string | null;
  tags: string[];
  pollingInterval: number;
  pollingEnabled: boolean;
  vendor?: string | null;
  model?: string | null;
  osVersion?: string | null;
  lastPolledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceInterface {
  id: string;
  deviceId: string;
  ifIndex: number;
  name: string;
  alias?: string | null;
  type?: string | null;
  speed?: number | null;
  status: string;
  adminStatus?: string | null;
  macAddress?: string | null;
  inBps: number;
  outBps: number;
  inErrors: number;
  outErrors: number;
  lastUpdatedAt?: string | null;
}

// ─── Device Groups ────────────────────────────────────
export interface DeviceGroup {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
}

// ─── Incidents ────────────────────────────────────────
export type Severity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "problem" | "acknowledged" | "resolved";

export interface Incident {
  id: string;
  deviceId: string;
  ruleId?: string | null;
  severity: Severity;
  status: IncidentStatus;
  title: string;
  description?: string | null;
  metricName?: string | null;
  metricValue?: number | null;
  aiRca?: string | null;
  aiSummary?: string | null;
  assignedTo?: string | null;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  startedAt: string;
  updatedAt: string;
  deviceName?: string;
  deviceIp?: string;
}

export interface IncidentEvent {
  id: string;
  incidentId: string;
  type: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt: string;
}

// ─── Alert Rules ──────────────────────────────────────
export interface AlertRule {
  id: string;
  name: string;
  description?: string | null;
  deviceId?: string | null;
  groupId?: string | null;
  metricName: string;
  operator: string;
  threshold: number;
  severity: Severity;
  channels: string[];
  flapThreshold: number;
  flapWindow: number;
  escalationMinutes?: number | null;
  escalationChannels?: string[] | null;
  runbookUrl?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Metrics ──────────────────────────────────────────
export interface MetricPoint {
  time: string;
  avg_value: number;
  max_value: number;
  min_value: number;
}

export interface AnomalyPoint {
  value: number;
  timestamp: string;
  mean: number;
  stddev: number;
  is_anomaly: boolean;
}

// ─── Dashboard ────────────────────────────────────────
export interface DashboardSummary {
  devices: {
    up_count: number;
    down_count: number;
    warning_count: number;
    unknown_count: number;
    maintenance_count: number;
    total: number;
  };
  incidents: {
    problem_count: number;
    acknowledged_count: number;
    resolved_today: number;
    active_count: number;
  };
}

export interface ThroughputPoint {
  bucket: string;
  total_in: number;
  total_out: number;
}

export interface TopDevice {
  device_id: string;
  name: string;
  ip: string;
  type: DeviceType;
  status: DeviceStatus;
  metric_name: string;
  value: number;
  timestamp: string;
}

// ─── Notification Channels ────────────────────────────
export type NotificationChannelType = "email" | "telegram" | "discord" | "slack" | "sms" | "kakao" | "pagerduty" | "webhook" | "in_app";

export interface NotificationChannel {
  id: string;
  name: string;
  type: NotificationChannelType;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  incidentId?: string | null;
  channelId?: string | null;
  channelType: NotificationChannelType;
  status: string;
  payload?: Record<string, unknown> | null;
  error?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

// ─── Reports ──────────────────────────────────────────
export type ReportType = "availability" | "performance" | "alert_summary" | "ai_narrative";

export interface Report {
  id: string;
  type: ReportType;
  title: string;
  period?: string | null;
  content?: Record<string, unknown> | null;
  aiSummary?: string | null;
  generatedBy?: string | null;
  generatedAt: string;
}

// ─── AI ───────────────────────────────────────────────
export type AIProviderType = "openai" | "gemini" | "claude" | "custom";

export interface AIProvider {
  id: string;
  name: string;
  type: AIProviderType;
  model?: string | null;
  baseUrl?: string | null;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
}

// ─── Maintenance Windows ──────────────────────────────
export interface MaintenanceWindow {
  id: string;
  name: string;
  description?: string | null;
  deviceIds: string[];
  groupIds: string[];
  startAt: string;
  endAt: string;
  recurring: boolean;
  cronExpression?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

// ─── Config Snapshots ─────────────────────────────────
export interface ConfigSnapshot {
  id: string;
  deviceId: string;
  configText: string;
  hash: string;
  diff?: string | null;
  capturedAt: string;
}

// ─── Audit Logs ───────────────────────────────────────
export interface AuditLog {
  id: string;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
}

// ─── API Keys ─────────────────────────────────────────
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

// ─── Dashboards (Custom) ──────────────────────────────
export interface Dashboard {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isShared: boolean;
  templateId?: string | null;
  layoutConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardWidget {
  id: string;
  dashboardId: string;
  widgetType: string;
  config: Record<string, unknown>;
  gridPosition: Record<string, unknown>;
  createdAt: string;
}

// ─── Invitations ──────────────────────────────────────
export interface Invitation {
  id: string;
  email?: string | null;
  token: string;
  role: string;
  scope: string;
  allowedDeviceIds: string[];
  allowedGroupIds: string[];
  invitedBy?: string | null;
  usedAt?: string | null;
  expiresAt: string;
  createdAt: string;
}

// ─── Topology ─────────────────────────────────────────
export interface TopologyPosition {
  id: string;
  userId: string;
  deviceId: string;
  x: number;
  y: number;
  updatedAt: string;
}
