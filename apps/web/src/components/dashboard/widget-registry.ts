import type { ComponentType } from "react";
import type { WidgetType, WidgetProps, WidgetConfig, GridPosition } from "./types";
import { WIDGET_TYPES } from "./types";

export interface WidgetRegistryEntry {
  component: ComponentType<WidgetProps>;
  defaultConfig: WidgetConfig;
  defaultSize: GridPosition;
}

const widgetRegistry = new Map<WidgetType, WidgetRegistryEntry>();

export function registerWidget(type: WidgetType, entry: WidgetRegistryEntry): void {
  widgetRegistry.set(type, entry);
}

export function getWidget(type: WidgetType): WidgetRegistryEntry | undefined {
  return widgetRegistry.get(type);
}

export function getWidgetDefaultSize(type: WidgetType): GridPosition | undefined {
  return widgetRegistry.get(type)?.defaultSize;
}

export function getAllWidgetTypes(): WidgetType[] {
  return [...WIDGET_TYPES];
}

export { widgetRegistry };

/* ─── Widget Registrations ─── */

import { StatCardWidget } from "./widgets/stat-card-widget";
import { TimeSeriesWidget } from "./widgets/time-series-widget";
import { PieChartWidget } from "./widgets/pie-chart-widget";
import { TopNBarWidget } from "./widgets/top-n-bar-widget";
import { AlertFeedWidget } from "./widgets/alert-feed-widget";
import { HoneycombWidget } from "./widgets/honeycomb-widget";
import { MapWidget } from "./widgets/map-widget";
import { TopologyWidget } from "./widgets/topology-widget";
import { SystemInfoWidget } from "./widgets/system-info-widget";
import { AISummaryWidget } from "./widgets/ai-summary-widget";

registerWidget("stat-card", {
  component: StatCardWidget,
  defaultConfig: { metric: "device_count", title: "Devices" },
  defaultSize: { x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
});

registerWidget("time-series", {
  component: TimeSeriesWidget,
  defaultConfig: { metricName: "cpu", timeRange: "1h" },
  defaultSize: { x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
});

registerWidget("pie-chart", {
  component: PieChartWidget,
  defaultConfig: { dataSource: "device_status" },
  defaultSize: { x: 0, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
});

registerWidget("top-n-bar", {
  component: TopNBarWidget,
  defaultConfig: { metric: "cpu", count: 10 },
  defaultSize: { x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
});

registerWidget("alert-feed", {
  component: AlertFeedWidget,
  defaultConfig: { maxItems: 20 },
  defaultSize: { x: 0, y: 0, w: 4, h: 6, minW: 3, minH: 4 },
});

registerWidget("honeycomb", {
  component: HoneycombWidget,
  defaultConfig: {},
  defaultSize: { x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
});

registerWidget("map", {
  component: MapWidget,
  defaultConfig: {},
  defaultSize: { x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
});

registerWidget("topology", {
  component: TopologyWidget,
  defaultConfig: { fitView: true },
  defaultSize: { x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
});

registerWidget("system-info", {
  component: SystemInfoWidget,
  defaultConfig: {},
  defaultSize: { x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
});

registerWidget("ai-summary", {
  component: AISummaryWidget,
  defaultConfig: { summaryType: "incidents" },
  defaultSize: { x: 0, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
});
