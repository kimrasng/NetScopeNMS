"use client";
import { formatDateTime } from "@/lib/date-format";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "@cloudscape-design/components/link";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";
import Pagination from "@cloudscape-design/components/pagination";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Select from "@cloudscape-design/components/select";
import Badge from "@cloudscape-design/components/badge";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Box from "@cloudscape-design/components/box";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { useApi } from "@/hooks/use-api";
import { useI18n } from "@/lib/i18n";
import type {
  Incident,
  IncidentStatus,
  Severity,
  PaginatedResponse,
} from "@/lib/types";

// ─── Constants ────────────────────────────────────────

const PAGE_SIZE = 50;

const SEVERITY_COLOR: Record<Severity, "red" | "blue" | "grey"> = {
  critical: "red",
  high: "red",
  medium: "blue",
  low: "grey",
};

const STATUS_MAP: Record<IncidentStatus, { type: "success" | "error" | "warning"; key: string }> = {
  problem: { type: "error", key: "status.problem" },
  acknowledged: { type: "warning", key: "status.acknowledged" },
  resolved: { type: "success", key: "status.resolved" },
};

const STATUS_OPTION_KEYS = [
  { value: "", key: "incident.allStatuses" },
  { value: "active", key: "Active incidents" },
  { value: "problem", key: "status.problem" },
  { value: "acknowledged", key: "status.acknowledged" },
  { value: "resolved", key: "status.resolved" },
];

const SEVERITY_OPTION_KEYS = [
  { value: "", key: "incident.allSeverities" },
  { value: "critical", key: "severity.critical" },
  { value: "high", key: "severity.high" },
  { value: "medium", key: "severity.medium" },
  { value: "low", key: "severity.low" },
];

// ─── Incidents Page ───────────────────────────────────

export default function IncidentsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [page, setPage] = useState(1);

  const statusOptions = STATUS_OPTION_KEYS.map((o) => ({ value: o.value, label: t(o.key) }));
  const severityOptions = SEVERITY_OPTION_KEYS.map((o) => ({ value: o.value, label: t(o.key) }));

  const [statusFilter, setStatusFilter] = useState(statusOptions[0]);
  const [severityFilter, setSeverityFilter] = useState(severityOptions[0]);

  useEffect(() => { const value = new URLSearchParams(window.location.search).get("status"); const option = STATUS_OPTION_KEYS.find(item => item.value === value); if (option) setStatusFilter({ value: option.value, label: t(option.key) }); }, [t]);

  const columnDefinitions = [
    {
      id: "severity",
      header: t("incident.severity"),
      cell: (item: Incident) => (
        <Badge color={SEVERITY_COLOR[item.severity]}>
          {t(`severity.${item.severity}`)}
        </Badge>
      ),
      sortingField: "severity",
      width: 120,
    },
    {
      id: "title",
      header: t("incident.title"),
      cell: (item: Incident) => <Link href={`/incidents/${item.id}`}>{item.title}</Link>,
      sortingField: "title",
    },
    {
      id: "deviceName",
      header: t("incident.deviceName"),
      cell: (item: Incident) => <Link href={`/devices/${item.deviceId}`}>{item.deviceName ?? t("Device")}</Link>,
      sortingField: "deviceName",
    },
    {
      id: "deviceIp",
      header: t("incident.deviceIp"),
      cell: (item: Incident) => item.deviceIp ?? "-",
    },
    {
      id: "status",
      header: t("common.status"),
      cell: (item: Incident) => {
        const s = STATUS_MAP[item.status];
        return <StatusIndicator type={s.type}>{t(s.key)}</StatusIndicator>;
      },
      sortingField: "status",
      width: 150,
    },
    {
      id: "startedAt",
      header: t("incident.startedAt"),
      cell: (item: Incident) => formatDateTime(new Date(item.startedAt)),
      sortingField: "startedAt",
      width: 180,
    },
    {
      id: "updatedAt",
      header: t("common.updatedAt"),
      cell: (item: Incident) => formatDateTime(new Date(item.updatedAt)),
      sortingField: "updatedAt",
      width: 180,
    },
  ];

  const params: Record<string, string | number | undefined> = {
    page,
    limit: PAGE_SIZE,
    status: statusFilter.value || undefined,
    severity: severityFilter.value || undefined,
  };

  const { data, loading } = useApi<PaginatedResponse<Incident>>("/api/incidents", params);

  const { items, collectionProps, paginationProps } = useCollection(data?.data ?? [], {
    sorting: {
      defaultState: { sortingColumn: columnDefinitions[5], isDescending: true },
    },
    pagination: { pageSize: PAGE_SIZE },
    selection: { trackBy: "id" },
  });

  const handlePageChange = useCallback(
    ({ detail }: { detail: { currentPageIndex: number } }) => {
      setPage(detail.currentPageIndex);
    },
    [],
  );

  return (
    <>
      <Table
        {...collectionProps}
        items={items}
        loading={loading}
        loadingText={t("Loading incidents...")}
        columnDefinitions={columnDefinitions}
        variant="full-page"
        stickyHeader
        onRowClick={({ detail }) => router.push(`/incidents/${detail.item.id}`)}
        filter={
          <SpaceBetween direction="horizontal" size="s">
            <Select
              selectedOption={statusFilter}
              onChange={({ detail }) => {
                setStatusFilter(detail.selectedOption as typeof statusFilter);
                setPage(1);
              }}
              options={statusOptions}
              placeholder={t("incident.filterByStatus")}
            />
            <Select
              selectedOption={severityFilter}
              onChange={({ detail }) => {
                setSeverityFilter(detail.selectedOption as typeof severityFilter);
                setPage(1);
              }}
              options={severityOptions}
              placeholder={t("incident.filterBySeverity")}
            />
          </SpaceBetween>
        }
        pagination={
          <Pagination
            {...paginationProps}
            currentPageIndex={page}
            pagesCount={data?.pagination.totalPages ?? 1}
            onChange={handlePageChange}
          />
        }
        header={
          <Header variant="awsui-h1-sticky" counter={data ? `(${data.pagination.total})` : undefined}>
            {t("page.incidents")}
          </Header>
        }
        empty={
          <Box textAlign="center" color="inherit" padding="l">
            <Box variant="strong">{t("No incidents")}</Box>
            <Box variant="p" color="inherit">
              {t("No incidents match the current filters.")}</Box>
          </Box>
        }
      />
    </>
  );
}
