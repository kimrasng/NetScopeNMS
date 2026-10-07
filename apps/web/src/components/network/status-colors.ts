import { colorTextStatusSuccess, colorTextStatusError, colorTextStatusWarning, colorTextStatusInactive, colorTextStatusInfo } from "@cloudscape-design/design-tokens";
import type { DeviceStatus } from "@/lib/types";
export const statusColors: Record<DeviceStatus, string> = { up: colorTextStatusSuccess, down: colorTextStatusError, warning: colorTextStatusWarning, unknown: colorTextStatusInactive, maintenance: colorTextStatusInfo };
