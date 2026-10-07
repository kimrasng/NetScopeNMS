"use client";
import { formatDateTime } from "@/lib/date-format";

import { useState, useCallback, useEffect } from "react";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Pagination from "@cloudscape-design/components/pagination";
import Select from "@cloudscape-design/components/select";
import DateRangePicker from "@cloudscape-design/components/date-range-picker";
import type { DateRangePickerProps } from "@cloudscape-design/components/date-range-picker";
import { useApi } from "@/hooks/use-api";
import { useNotifications } from "@/hooks/use-notifications";
import { useTablePreferences } from "@/hooks/use-table-preferences";
import { useI18n } from "@/lib/i18n";
import { apiGet, ApiError } from "@/lib/api";
import type { AuditLog, PaginatedResponse } from "@/lib/types";

const PAGE_SIZE = 50;

interface AuditOptions {
  actions: string[];
  resources: string[];
  users: { id: string; name: string; email: string }[];
}

export default function AuditLogsPage() {
  const { t } = useI18n();
  const { addNotification } = useNotifications();
  const { data: options, loading: optionsLoading } = useApi<AuditOptions>("/api/audit-logs/options");

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRangePickerProps.Value | null>(null);
  const [userIdFilter, setUserIdFilter] = useState("");

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        page: p,
        limit: PAGE_SIZE,
      };
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resource = resourceFilter;
      if (userIdFilter.trim()) params.userId = userIdFilter.trim();
      if (dateRange) {
        if (dateRange.type === "absolute") {
          params.from = new Date(dateRange.startDate).toISOString();
          params.to = new Date(dateRange.endDate).toISOString();
        } else {
          const now = new Date();
          const ms = dateRange.amount * (
            dateRange.unit === "second" ? 1000 :
            dateRange.unit === "minute" ? 60_000 :
            dateRange.unit === "hour" ? 3_600_000 :
            dateRange.unit === "day" ? 86_400_000 :
            dateRange.unit === "week" ? 604_800_000 :
            dateRange.unit === "month" ? 2_592_000_000 :
            31_536_000_000
          );
          params.from = new Date(now.getTime() - ms).toISOString();
          params.to = now.toISOString();
        }
      }

      const result = await apiGet<PaginatedResponse<AuditLog>>("/api/audit-logs", params);
      setLogs(result.data);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch (err) {
      const message = err instanceof ApiError ? err.body.error : "Failed to load audit logs.";
      if (!(err instanceof ApiError)) addNotification({ type: "error", content: t(message) });
    } finally {
      setLoading(false);
    }
  }, [actionFilter, resourceFilter, dateRange, userIdFilter, addNotification, t]);

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  useEffect(() => {
    setPage(1);
  }, [actionFilter, resourceFilter, dateRange, userIdFilter]);

  const tablePreferences = useTablePreferences([{ id: "action", label: "auditLog.action" }, { id: "resource", label: "auditLog.resource" }, { id: "resourceId", label: "auditLog.resourceId", visible: false }, { id: "userId", label: "common.user" }, { id: "ipAddress", label: "auditLog.ipAddress" }, { id: "createdAt", label: "common.createdAt" }]);
  const actionOptions = [{ value: "", label: t("All Actions") }, ...(options?.actions ?? []).map(value => ({ value, label: value }))];
  const resourceOptions = [{ value: "", label: t("All Resources") }, ...(options?.resources ?? []).map(value => ({ value, label: t(value) }))];
  const userOptions = [{ value: "", label: t("All users") }, ...(options?.users ?? []).map(user => ({ value: user.id, label: user.name, description: user.email }))];

  return (
    <>
      <Table
        {...tablePreferences}
        items={logs}
        loading={loading}
        loadingText={t("Loading audit logs...")}
        variant="full-page"
        stickyHeader
        sortingDisabled
        header={
          <Header variant="awsui-h1-sticky" counter={`(${total})`}>
            {t("page.auditLogs")}
          </Header>
        }
        filter={
          <SpaceBetween direction="horizontal" size="xs">
            <Select
              selectedOption={actionOptions.find(option => option.value === actionFilter) ?? actionOptions[0]}
              onChange={({ detail }) => setActionFilter(detail.selectedOption.value ?? "")}
              options={actionOptions}
              filteringType="auto"
              loadingText={t("common.loading")}
              statusType={optionsLoading ? "loading" : "finished"}
              ariaLabel={t("auditLog.filterByAction")}
              placeholder={t("auditLog.filterByAction")}
            />
            <Select
              selectedOption={resourceOptions.find(option => option.value === resourceFilter) ?? resourceOptions[0]}
              onChange={({ detail }) => setResourceFilter(detail.selectedOption.value ?? "")}
              options={resourceOptions}
              ariaLabel={t("auditLog.filterByResource")}
              placeholder={t("auditLog.filterByResource")}
            />
            <Select
              selectedOption={userOptions.find(option => option.value === userIdFilter) ?? userOptions[0]}
              options={userOptions}
              onChange={({ detail }) => setUserIdFilter(detail.selectedOption.value ?? "")}
              filteringType="auto"
              ariaLabel={t("common.user")}
            />
            <DateRangePicker
              value={dateRange}
              onChange={({ detail }) => setDateRange(detail.value)}
              placeholder={t("Date range")}
              relativeOptions={[
                { key: "1h", amount: 1, unit: "hour", type: "relative" },
                { key: "24h", amount: 24, unit: "hour", type: "relative" },
                { key: "7d", amount: 7, unit: "day", type: "relative" },
                { key: "30d", amount: 30, unit: "day", type: "relative" },
              ]}
              isValidRange={(value) => {
                if (value?.type === "absolute") {
                  if (!value.startDate || !value.endDate) {
                    return { valid: false, errorMessage: t("Select a complete date range.") };
                  }
                  if (!Number.isFinite(Date.parse(value.startDate)) || !Number.isFinite(Date.parse(value.endDate)) || Date.parse(value.startDate) >= Date.parse(value.endDate)) {
                    return { valid: false, errorMessage: t("End time must be after start time.") };
                  }
                }
                return { valid: true };
              }}
            />
          </SpaceBetween>
        }
        pagination={
          <Pagination
            currentPageIndex={page}
            pagesCount={totalPages}
            onChange={({ detail }) => setPage(detail.currentPageIndex)}
          />
        }
        columnDefinitions={[
          {
            id: "action",
            header: t("auditLog.action"),
            cell: (item) => item.action,
            width: 120,
          },
          {
            id: "resource",
            header: t("auditLog.resource"),
            cell: (item) => t(item.resource),
            width: 160,
          },
          {
            id: "resourceId",
            header: t("auditLog.resourceId"),
            cell: (item) => item.resourceId ? <Box variant="code">{item.resourceId}</Box> : "—",
            width: 200,
          },
          {
            id: "userId",
            header: t("User"),
            cell: (item) => item.userName ?? t("System / removed account"),
            width: 200,
          },
          {
            id: "ipAddress",
            header: t("auditLog.ipAddress"),
            cell: (item) => item.ipAddress ?? "—",
            width: 140,
          },
          {
            id: "createdAt",
            header: t("auditLog.createdAt"),
            cell: (item) => formatDateTime(new Date(item.createdAt)),
            width: 200,
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>{t("No audit logs")}</b>
              <Box variant="p" color="inherit">{t("No logs match the current filters.")}</Box>
            </SpaceBetween>
          </Box>
        }
      />
    </>
  );
}
