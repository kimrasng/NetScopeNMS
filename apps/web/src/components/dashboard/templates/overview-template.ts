import type { DashboardWidget } from "../types";

export const OVERVIEW_TEMPLATE_META = {
  id: "overview",
  name: "Overview",
  description: "General system overview with key metrics, trends, and alerts",
  widgetCount: 7,
} as const;

export const overviewTemplateWidgets: DashboardWidget[] = [
  {
    id: "tpl-overview-stat-devices-up",
    type: "stat-card",
    config: { metric: "device_up_count", title: "Devices Up" },
    gridPosition: { x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  },
  {
    id: "tpl-overview-stat-devices-down",
    type: "stat-card",
    config: { metric: "device_down_count", title: "Devices Down" },
    gridPosition: { x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  },
  {
    id: "tpl-overview-stat-active-incidents",
    type: "stat-card",
    config: { metric: "active_incident_count", title: "Active Incidents" },
    gridPosition: { x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  },
  {
    id: "tpl-overview-stat-avg-cpu",
    type: "stat-card",
    config: { metric: "avg_cpu", title: "Avg CPU %" },
    gridPosition: { x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  },
  {
    id: "tpl-overview-timeseries-bandwidth",
    type: "time-series",
    config: { metricName: "bandwidth", timeRange: "6h", showArea: true },
    gridPosition: { x: 0, y: 2, w: 8, h: 4, minW: 3, minH: 3 },
  },
  {
    id: "tpl-overview-pie-device-status",
    type: "pie-chart",
    config: { dataSource: "device_status", title: "Device Status" },
    gridPosition: { x: 8, y: 2, w: 4, h: 4, minW: 3, minH: 3 },
  },
  {
    id: "tpl-overview-alert-feed",
    type: "alert-feed",
    config: { maxItems: 10, title: "Recent Alerts" },
    gridPosition: { x: 0, y: 6, w: 12, h: 4, minW: 3, minH: 3 },
  },
];
