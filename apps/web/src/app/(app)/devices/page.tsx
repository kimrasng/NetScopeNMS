"use client";
import { formatDateTime } from "@/lib/date-format";

import { useState, useCallback, useEffect } from "react";
import Link from "@cloudscape-design/components/link";
import { useRouter } from "next/navigation";
import Table from "@cloudscape-design/components/table";
import Header from "@cloudscape-design/components/header";
import Button from "@cloudscape-design/components/button";
import Pagination from "@cloudscape-design/components/pagination";
import TextFilter from "@cloudscape-design/components/text-filter";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Box from "@cloudscape-design/components/box";
import Badge from "@cloudscape-design/components/badge";
import Select from "@cloudscape-design/components/select";
import type { SelectProps } from "@cloudscape-design/components/select";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { useTablePreferences } from "@/hooks/use-table-preferences";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/lib/auth";
import { canOperate } from "@/lib/permissions";
import { useI18n } from "@/lib/i18n";
import type { Device, DeviceType, DeviceStatus, PaginatedResponse } from "@/lib/types";

// ─── Status Mapping ──────────────────────────────────
const STATUS_MAP: Record<DeviceStatus, { type: "success" | "error" | "warning" | "stopped" | "in-progress"; key: string }> = {
  up: { type: "success", key: "status.up" },
  down: { type: "error", key: "status.down" },
  warning: { type: "warning", key: "status.warning" },
  unknown: { type: "stopped", key: "status.unknown" },
  maintenance: { type: "in-progress", key: "status.maintenance" },
};

const DEVICE_TYPE_KEYS: { value: string; key: string }[] = [
  { value: "", key: "device.allTypes" },
  { value: "router", key: "deviceType.router" },
  { value: "switch", key: "deviceType.switch" },
  { value: "server", key: "deviceType.server" },
  { value: "firewall", key: "deviceType.firewall" },
  { value: "access_point", key: "deviceType.access_point" },
  { value: "load_balancer", key: "deviceType.load_balancer" },
  { value: "storage", key: "deviceType.storage" },
  { value: "other", key: "deviceType.other" },
];

const STATUS_KEYS: { value: string; key: string }[] = [
  { value: "", key: "device.allStatuses" },
  { value: "up", key: "status.up" },
  { value: "down", key: "status.down" },
  { value: "warning", key: "status.warning" },
  { value: "unknown", key: "status.unknown" },
  { value: "maintenance", key: "status.maintenance" },
];

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return formatDateTime(new Date(dateStr));
}

export default function DeviceListPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [filterText, setFilterText] = useState("");
  const [searchText, setSearchText] = useState("");

  const deviceTypeOptions: SelectProps.Option[] = DEVICE_TYPE_KEYS.map((o) => ({ value: o.value, label: t(o.key) }));
  const statusOptions: SelectProps.Option[] = STATUS_KEYS.map((o) => ({ value: o.value, label: t(o.key) }));

  const [typeFilter, setTypeFilter] = useState<SelectProps.Option>(deviceTypeOptions[0]);
  const [statusFilter, setStatusFilter] = useState<SelectProps.Option>(statusOptions[0]);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    const option = STATUS_KEYS.find(item => item.value === status);
    if (option) setStatusFilter({ value: option.value, label: t(option.key) });
  }, [t]);

  const params: Record<string, string | number | undefined> = {
    page: currentPage,
    limit: 50,
    search: searchText || undefined,
    type: (typeFilter.value as DeviceType) || undefined,
    status: (statusFilter.value as DeviceStatus) || undefined,
  };

  const { data, loading, error } = useApi<PaginatedResponse<Device>>("/api/devices", params);

  const tablePreferences = useTablePreferences([{ id: "name", label: "common.name", alwaysVisible: true }, { id: "ip", label: "device.ip" }, { id: "type", label: "common.type" }, { id: "status", label: "common.status" }, { id: "location", label: "device.location" }, { id: "pollingInterval", label: "device.pollingInterval", visible: false }, { id: "lastPolledAt", label: "device.lastPolled" }, { id: "tags", label: "device.tags", visible: false }]);
  const devices = data?.data ?? [];
  const pagination = data?.pagination;

  const { items, collectionProps, filterProps } = useCollection(devices, {
    filtering: {
      empty: (
        <Box textAlign="center" color="inherit">
          <b>{t("No devices")}</b>
          <Box padding={{ bottom: "s" }} variant="p" color="inherit">
            {t("No devices match the current filters.")}</Box>
        </Box>
      ),
      noMatch: (
        <Box textAlign="center" color="inherit">
          <b>{t("No matches")}</b>
          <Box padding={{ bottom: "s" }} variant="p" color="inherit">
            {t("No devices match the search text.")}</Box>
        </Box>
      ),
    },
    sorting: {
      defaultState: { sortingColumn: { sortingField: "name" }, isDescending: false },
    },
    selection: { trackBy: "id" },
  });

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    setCurrentPage(1);
  }, []);

  return (
    <>
      <Table
        {...collectionProps}
        {...tablePreferences}
        variant="full-page"
        stickyHeader
        loading={loading}
        loadingText={t("Loading devices...")}
        items={items}
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={pagination ? `(${pagination.total})` : undefined}
            actions={
              <Button variant="primary" disabled={!canOperate(user)} onClick={() => router.push("/devices/create")}>
                {t("device.createDevice")}
              </Button>
            }
          >
            {t("page.devices")}
          </Header>
        }
        filter={
          <SpaceBetween direction="horizontal" size="xs">
            <TextFilter
              {...filterProps}
              filteringText={filterText}
              onChange={({ detail }) => setFilterText(detail.filteringText)}
              onDelayedChange={({ detail }) => handleSearch(detail.filteringText)}
              filteringPlaceholder={t("device.filterDevices")}
              filteringAriaLabel={t("device.filterDevices")}
            />
            <Select
              selectedOption={typeFilter}
              onChange={({ detail }) => {
                setTypeFilter(detail.selectedOption);
                setCurrentPage(1);
              }}
              options={deviceTypeOptions}
              filteringType="auto"
              placeholder={t("device.allTypes")}
            />
            <Select
              selectedOption={statusFilter}
              onChange={({ detail }) => {
                setStatusFilter(detail.selectedOption);
                setCurrentPage(1);
              }}
              options={statusOptions}
              placeholder={t("device.allStatuses")}
            />
          </SpaceBetween>
        }
        pagination={
          pagination ? (
            <Pagination
              currentPageIndex={currentPage}
              pagesCount={pagination.totalPages}
              onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
            />
          ) : undefined
        }
        columnDefinitions={[
          {
            id: "name",
            header: t("common.name"),
            cell: (item) => <Link href={`/devices/${item.id}`}>{item.name}</Link>,
            sortingField: "name",
            width: 200,
          },
          {
            id: "ip",
            header: t("device.ip"),
            cell: (item) => item.ip,
            sortingField: "ip",
            width: 150,
          },
          {
            id: "type",
            header: t("common.type"),
            cell: (item) => t(`deviceType.${item.type}`),
            sortingField: "type",
            width: 130,
          },
          {
            id: "status",
            header: t("common.status"),
            cell: (item) => {
              const s = STATUS_MAP[item.status];
              return <StatusIndicator type={s.type}>{t(s.key)}</StatusIndicator>;
            },
            sortingField: "status",
            width: 130,
          },
          {
            id: "location",
            header: t("device.location"),
            cell: (item) => item.location ?? "—",
            sortingField: "location",
            width: 150,
          },
          {
            id: "pollingInterval",
            header: t("device.pollingInterval"),
            cell: (item) => `${item.pollingInterval}s`,
            sortingField: "pollingInterval",
            width: 130,
          },
          {
            id: "lastPolledAt",
            header: t("device.lastPolled"),
            cell: (item) => formatDate(item.lastPolledAt),
            sortingField: "lastPolledAt",
            width: 180,
          },
          {
            id: "tags",
            header: t("device.tags"),
            cell: (item) =>
              item.tags.length > 0 ? (
                <SpaceBetween direction="horizontal" size="xxs">
                  {item.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </SpaceBetween>
              ) : (
                "—"
              ),
            width: 200,
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>{t("No devices")}</b>
              <Box variant="p" color="inherit">
                {t("No devices have been added yet.")}</Box>
                          </SpaceBetween>
          </Box>
        }
      />
      {error && (
        <Box color="text-status-error" padding="s">
          {t("Error loading devices:")}{error}
        </Box>
      )}
    </>
  );
}
