import type { DashboardWidget } from "../types";

export const NETWORK_TEMPLATE_META = {
  id: "network",
  name: "Network",
  description: "Network topology, geographic map, bandwidth ranking, and device health",
  widgetCount: 4,
} as const;

export const networkTemplateWidgets: DashboardWidget[] = [
  {
    id: "tpl-network-topology",
    type: "topology",
    config: { showMinimap: true, fitView: true, title: "Topology" },
    gridPosition: { x: 0, y: 0, w: 6, h: 5, minW: 4, minH: 4 },
  },
  {
    id: "tpl-network-map",
    type: "map",
    config: { zoom: 6, title: "Device Map" },
    gridPosition: { x: 6, y: 0, w: 6, h: 5, minW: 4, minH: 4 },
  },
  {
    id: "tpl-network-topn-bandwidth",
    type: "top-n-bar",
    config: { metric: "bandwidth", count: 10, sortOrder: "desc", title: "Top Bandwidth" },
    gridPosition: { x: 0, y: 5, w: 6, h: 4, minW: 3, minH: 3 },
  },
  {
    id: "tpl-network-honeycomb",
    type: "honeycomb",
    config: { showLabels: true, title: "Device Health" },
    gridPosition: { x: 6, y: 5, w: 6, h: 4, minW: 3, minH: 3 },
  },
];
