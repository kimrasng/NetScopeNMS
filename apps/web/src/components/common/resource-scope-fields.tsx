"use client";
import { useI18n } from "@/lib/i18n";
import FormField from "@cloudscape-design/components/form-field";
import Multiselect from "@cloudscape-design/components/multiselect";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useApi } from "@/hooks/use-api";
import type { Device, DeviceGroup, PaginatedResponse } from "@/lib/types";

export function ResourceScopeFields({ deviceIds, groupIds, onChange, description = "Type a device name or IP. Selected devices and groups are combined." }: { deviceIds: string[]; groupIds: string[]; onChange: (devices: string[], groups: string[]) => void; description?: string }) {
  const { t } = useI18n();
  const { data: devices, loading: deviceLoading } = useApi<{ nodes: Device[] }>("/api/topology/graph");
  const { data: groups, loading: groupLoading } = useApi<PaginatedResponse<DeviceGroup>>("/api/device-groups", { limit: 200 });
  const deviceOptions = (devices?.nodes ?? []).map(device => ({ value: device.id, label: `${device.name} (${device.ip})` }));
  const groupOptions = (groups?.data ?? []).map(group => ({ value: group.id, label: group.name }));
  return <SpaceBetween size="m">
    <FormField label={t("Devices")} description={t(description)}>
      <Multiselect filteringType="auto" options={deviceOptions} selectedOptions={deviceIds.map(id => deviceOptions.find(option => option.value === id) ?? { value: id, label: id })} statusType={deviceLoading ? "loading" : "finished"} onChange={({ detail }) => onChange(detail.selectedOptions.map(option => option.value ?? ""), groupIds)} />
    </FormField>
    <FormField label={t("Device groups")}>
      <Multiselect filteringType="auto" options={groupOptions} selectedOptions={groupIds.map(id => groupOptions.find(option => option.value === id) ?? { value: id, label: id })} statusType={groupLoading ? "loading" : "finished"} onChange={({ detail }) => onChange(deviceIds, detail.selectedOptions.map(option => option.value ?? ""))} />
    </FormField>
  </SpaceBetween>;
}
