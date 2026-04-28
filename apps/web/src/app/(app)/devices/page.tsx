"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Table from "@cloudscape-design/components/table";
import Header from "@cloudscape-design/components/header";
import Button from "@cloudscape-design/components/button";
import Pagination from "@cloudscape-design/components/pagination";
import TextFilter from "@cloudscape-design/components/text-filter";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Box from "@cloudscape-design/components/box";
import Badge from "@cloudscape-design/components/badge";
import Select from "@cloudscape-design/components/select";
import type { SelectProps } from "@cloudscape-design/components/select";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { useApi } from "@/hooks/use-api";
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
  return new Date(dateStr).toLocaleString();
}

export default function DeviceListPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [filterText, setFilterText] = useState("");
  const [searchText, setSearchText] = useState("");

  const deviceTypeOptions: SelectProps.Option[] = DEVICE_TYPE_KEYS.map((o) => ({ value: o.value, label: t(o.key) }));
  const statusOptions: SelectProps.Option[] = STATUS_KEYS.map((o) => ({ value: o.value, label: t(o.key) }));

  const [typeFilter, setTypeFilter] = useState<SelectProps.Option>(deviceTypeOptions[0]);
  const [statusFilter, setStatusFilter] = useState<SelectProps.Option>(statusOptions[0]);

  const params: Record<string, string | number | undefined> = {
    page: currentPage,
    limit: 50,
    search: searchText || undefined,
    type: (typeFilter.value as DeviceType) || undefined,
    status: (statusFilter.value as DeviceStatus) || undefined,
  };

  const { data, loading, error } = useApi<PaginatedResponse<Device>>("/api/devices", params);

  const devices = data?.data ?? [];
  const pagination = data?.pagination;

  const { items, collectionProps, filterProps } = useCollection(devices, {
    filtering: {
      empty: (
        <Box textAlign="center" color="inherit">
          <b>No devices</b>
          <Box padding={{ bottom: "s" }} variant="p" color="inherit">
            No devices match the current filters.
          </Box>
        </Box>
      ),
      noMatch: (
        <Box textAlign="center" color="inherit">
          <b>No matches</b>
          <Box padding={{ bottom: "s" }} variant="p" color="inherit">
            No devices match the search text.
          </Box>
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
    <ContentLayout
      header={<Header variant="h1">{t("page.devices")}</Header>}
    >
      <Table
        {...collectionProps}
        variant="full-page"
        stickyHeader
        loading={loading}
        loadingText="Loading devices..."
        items={items}
        header={
          <Header
            variant="h2"
            counter={pagination ? `(${pagination.total})` : undefined}
            actions={
              <Button variant="primary" onClick={() => router.push("/devices/create")}>
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
              ariaLabels={{
                nextPageLabel: "Next page",
                previousPageLabel: "Previous page",
                pageLabel: (pageNumber) => `Page ${pageNumber}`,
              }}
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
            cell: (item) => item.type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
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
              <b>No devices</b>
              <Box variant="p" color="inherit">
                No devices have been added yet.
              </Box>
              <Button variant="primary" onClick={() => router.push("/devices/create")}>
                {t("device.createDevice")}
              </Button>            </SpaceBetween>
          </Box>
        }
      />
      {error && (
        <Box color="text-status-error" padding="s">
          Error loading devices: {error}
        </Box>
      )}
    </ContentLayout>
  );
}
