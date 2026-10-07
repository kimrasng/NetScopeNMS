"use client";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import { useI18n } from "@/lib/i18n";
import FormField from "@cloudscape-design/components/form-field";
import Textarea from "@cloudscape-design/components/textarea";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import type { Device, DeviceGroup, PaginatedResponse } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
export interface DeviceConnectionState {
  groupId: string; username: string; securityLevel: string; authProtocol: string; authKey: string; privProtocol: string; privKey: string;
  sshHost: string; sshPort: string; sshUsername: string; sshPrivateKey: string; sshHostFingerprint: string;
}
export function connectionState(device?: Device): DeviceConnectionState {
  return { groupId: device?.groupId ?? "", username: device?.snmpV3Config?.username ?? "", securityLevel: device?.snmpV3Config?.securityLevel ?? "noAuthNoPriv", authProtocol: device?.snmpV3Config?.authProtocol ?? "SHA", authKey: "", privProtocol: device?.snmpV3Config?.privProtocol ?? "AES", privKey: "", sshHost: device?.sshHost ?? "", sshPort: String(device?.sshPort ?? 22), sshUsername: device?.sshUsername ?? "", sshPrivateKey: "", sshHostFingerprint: device?.sshHostFingerprint ?? "" };
}
export function connectionPayload(state: DeviceConnectionState, version?: string) {
  return { groupId: state.groupId || null, sshHost: state.sshHost || null, sshPort: Number(state.sshPort), sshUsername: state.sshUsername || null, sshHostFingerprint: state.sshHostFingerprint || null, ...(state.sshPrivateKey ? { sshPrivateKey: state.sshPrivateKey } : {}),
    snmpV3Config: version === "v3" ? { username: state.username, securityLevel: state.securityLevel, ...(state.securityLevel !== "noAuthNoPriv" ? { authProtocol: state.authProtocol, ...(state.authKey ? { authKey: state.authKey } : {}) } : {}), ...(state.securityLevel === "authPriv" ? { privProtocol: state.privProtocol, ...(state.privKey ? { privKey: state.privKey } : {}) } : {}) } : null };
}
export function DeviceConnectionFields({ value, onChange, version, editing }: { value: DeviceConnectionState; onChange: (value: DeviceConnectionState) => void; version?: string; editing?: boolean }) {
  const { t } = useI18n();
  const { data } = useApi<PaginatedResponse<DeviceGroup>>("/api/device-groups", { limit: 200 });
  const groupOptions = [{ value: "", label: t("No group") }, ...(data?.data ?? []).map(group => ({ value: group.id, label: group.name }))];
  const update = (key: keyof DeviceConnectionState, next: string) => onChange({ ...value, [key]: next });
  const select = (key: keyof DeviceConnectionState, values: string[]) => <Select options={values.map(option => ({ value: option, label: option }))} selectedOption={{ value: value[key], label: value[key] }} onChange={({ detail }) => update(key, detail.selectedOption.value ?? "")} />;
  return <SpaceBetween size="m">
    <FormField label={t("Device group")}><Select filteringType="auto" options={groupOptions} selectedOption={groupOptions.find(option => option.value === value.groupId) ?? { value: value.groupId, label: value.groupId }} onChange={({ detail }) => update("groupId", detail.selectedOption.value ?? "")} /></FormField>
    {version === "v3" && <>
      <FormField label={t("SNMPv3 username")}><Input value={value.username} onChange={({ detail }) => update("username", detail.value)} /></FormField>
      <FormField label={t("Security level")}>{select("securityLevel", ["noAuthNoPriv", "authNoPriv", "authPriv"])}</FormField>
      {value.securityLevel !== "noAuthNoPriv" && <>
        <FormField label={t("Authentication protocol")}>{select("authProtocol", ["MD5", "SHA", "SHA224", "SHA256", "SHA384", "SHA512"])}</FormField>
        <FormField label={t("Authentication key")} description={editing ? t("Leave blank to retain the stored key.") : t("At least 8 characters.")}><Input type="password" value={value.authKey} onChange={({ detail }) => update("authKey", detail.value)} /></FormField>
      </>}
      {value.securityLevel === "authPriv" && <>
        <FormField label={t("Privacy protocol")}>{select("privProtocol", ["DES", "AES", "AES256"])}</FormField>
        <FormField label={t("Privacy key")} description={editing ? t("Leave blank to retain the stored key.") : t("At least 8 characters.")}><Input type="password" value={value.privKey} onChange={({ detail }) => update("privKey", detail.value)} /></FormField>
      </>}
    </>}
    <ExpandableSection headerText={t("SSH configuration backup")}><SpaceBetween size="m">
    <FormField label={t("SSH host")} description={t("Optional connection metadata for configuration backups.")}><Input value={value.sshHost} onChange={({ detail }) => update("sshHost", detail.value)} /></FormField>
    <FormField label={t("SSH port")}><Input type="number" value={value.sshPort} onChange={({ detail }) => update("sshPort", detail.value)} /></FormField>
    <FormField label={t("Trusted SSH host fingerprint")} description={t("SHA256:base64 or 64-character SHA256 hex. Verify it with your device administrator.")}><Input value={value.sshHostFingerprint} onChange={({ detail }) => update("sshHostFingerprint", detail.value)} /></FormField>
    <FormField label={t("SSH private key")} description={editing ? t("Leave blank to retain the encrypted stored key.") : t("Used to capture configuration over SSH.")}><Textarea value={value.sshPrivateKey} onChange={({ detail }) => update("sshPrivateKey", detail.value)} rows={4} /></FormField>
    <FormField label={t("SSH username")}><Input value={value.sshUsername} onChange={({ detail }) => update("sshUsername", detail.value)} /></FormField>
    </SpaceBetween></ExpandableSection>
  </SpaceBetween>;
}
