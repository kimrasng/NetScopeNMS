import type { DashboardWidget } from "../types";

export const ALERTS_TEMPLATE_META = {
  id: "alerts",
  name: "Alerts",
  description: "Incident monitoring with alert feed, counts, and severity breakdown",
  widgetCount: 3,
} as const;

export const alertsTemplateWidgets: DashboardWidget[] = [
  {
    id: "tpl-alerts-feed",
    type: "alert-feed",
    config: { maxItems: 20, title: "Alert Feed", autoScroll: true },
    gridPosition: { x: 0, y: 0, w: 8, h: 6, minW: 3, minH: 3 },
  },
  {
    id: "tpl-alerts-stat-incidents",
    type: "stat-card",
    config: { metric: "active_incident_count", title: "Active Incidents" },
    gridPosition: { x: 8, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
  },
  {
    id: "tpl-alerts-pie-severity",
    type: "pie-chart",
    config: { dataSource: "incident_severity", title: "Severity Distribution" },
    gridPosition: { x: 8, y: 2, w: 4, h: 4, minW: 3, minH: 3 },
  },
];
