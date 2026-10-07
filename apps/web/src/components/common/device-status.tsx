"use client";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { useI18n } from "@/lib/i18n";
import type { DeviceStatus } from "@/lib/types";
export const deviceStatusTypes = { up: "success", down: "error", warning: "warning", unknown: "stopped", maintenance: "in-progress" } as const;
export function DeviceStatusLabel({ status }: { status: DeviceStatus }) {
  const { t } = useI18n();
  return <StatusIndicator type={deviceStatusTypes[status]}>{t(`status.${status}`)}</StatusIndicator>;
}
