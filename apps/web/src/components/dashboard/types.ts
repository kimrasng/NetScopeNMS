/* ─── Widget Type System ─── */

export const WIDGET_TYPES = [
  "stat-card",
  "time-series",
  "pie-chart",
  "top-n-bar",
  "alert-feed",
  "honeycomb",
  "map",
  "topology",
  "system-info",
  "ai-summary",
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

/* ─── Per-Widget Config Interfaces (max 5 options each) ─── */

export interface StatCardConfig {
  metric: string;
  title: string;
  icon?: string;
  thresholdWarning?: number;
  thresholdCritical?: number;
}

export interface TimeSeriesConfig {
  metricName: string;
  timeRange: string;
  deviceId?: string;
  aggregation?: "avg" | "max" | "min" | "sum";
  showArea?: boolean;
}

export interface PieChartConfig {
  dataSource: string;
  title?: string;
  innerRadius?: number;
  enableArcLabels?: boolean;
  colorScheme?: string;
}

export interface TopNBarConfig {
  metric: string;
  count: number;
  sortOrder?: "asc" | "desc";
  title?: string;
  layout?: "horizontal" | "vertical";
}

export interface AlertFeedConfig {
  maxItems: number;
  severityFilter?: string[];
  showAcknowledged?: boolean;
  title?: string;
  autoScroll?: boolean;
}

export interface HoneycombConfig {
  groupFilter?: string;
  sortBy?: string;
  cellSize?: number;
  showLabels?: boolean;
  title?: string;
}

export interface MapConfig {
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  groupFilter?: string;
  title?: string;
}

export interface TopologyConfig {
  groupFilter?: string;
  showMinimap?: boolean;
  fitView?: boolean;
  title?: string;
  interactable?: boolean;
}

export interface SystemInfoConfig {
  showUptime?: boolean;
  showVersion?: boolean;
  showDeviceCount?: boolean;
  showPollingStatus?: boolean;
  title?: string;
}

export interface AISummaryConfig {
  summaryType?: "overview" | "incidents" | "performance";
  maxLength?: number;
  title?: string;
  refreshInterval?: number;
  showTimestamp?: boolean;
}

/* ─── Union Config ─── */

export type WidgetConfig =
  | StatCardConfig
  | TimeSeriesConfig
  | PieChartConfig
  | TopNBarConfig
  | AlertFeedConfig
  | HoneycombConfig
  | MapConfig
  | TopologyConfig
  | SystemInfoConfig
  | AISummaryConfig;

/* ─── Widget Props ─── */

export interface WidgetProps {
  id: string;
  type: WidgetType;
  config: WidgetConfig;
  timeRange?: string;
  selectedHost?: string;
}

/* ─── Grid Layout ─── */

export interface GridPosition {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

/* ─── Dashboard Widget ─── */

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  config: WidgetConfig;
  gridPosition: GridPosition;
}

/* ─── Dashboard ─── */

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  isDefault?: boolean;
  isShared?: boolean;
  templateId?: string;
}

/* ─── Time Range ─── */

export type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d";
