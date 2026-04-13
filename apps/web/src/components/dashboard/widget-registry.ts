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
