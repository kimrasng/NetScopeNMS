"use client";

import { useState, useCallback, useEffect } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Pagination from "@cloudscape-design/components/pagination";
import Select from "@cloudscape-design/components/select";
import DateRangePicker from "@cloudscape-design/components/date-range-picker";
import type { DateRangePickerProps } from "@cloudscape-design/components/date-range-picker";
import Input from "@cloudscape-design/components/input";
import { useNotifications } from "@/hooks/use-notifications";
import { useI18n } from "@/lib/i18n";
import { apiGet, ApiError } from "@/lib/api";
import type { AuditLog, PaginatedResponse } from "@/lib/types";

const PAGE_SIZE = 50;

const ACTION_OPTIONS = [
  { label: "All Actions", value: "" },
  { label: "Create", value: "create" },
  { label: "Update", value: "update" },
  { label: "Delete", value: "delete" },
  { label: "Login", value: "login" },
  { label: "Logout", value: "logout" },
];

const RESOURCE_OPTIONS = [
  { label: "All Resources", value: "" },
  { label: "Device", value: "device" },
  { label: "Incident", value: "incident" },
  { label: "Alert Rule", value: "alert_rule" },
  { label: "User", value: "user" },
  { label: "API Key", value: "api_key" },
  { label: "Notification Channel", value: "notification_channel" },
  { label: "Maintenance Window", value: "maintenance_window" },
  { label: "Report", value: "report" },
];

export default function AuditLogsPage() {
  const { t } = useI18n();
  const { addNotification } = useNotifications();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [actionFilter, setActionFilter] = useState(ACTION_OPTIONS[0]);
  const [resourceFilter, setResourceFilter] = useState(RESOURCE_OPTIONS[0]);
  const [dateRange, setDateRange] = useState<DateRangePickerProps.Value | null>(null);
  const [userIdFilter, setUserIdFilter] = useState("");

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        page: p,
        limit: PAGE_SIZE,
      };
      if (actionFilter.value) params.action = actionFilter.value;
      if (resourceFilter.value) params.resource = resourceFilter.value;
      if (userIdFilter.trim()) params.userId = userIdFilter.trim();
      if (dateRange) {
        if (dateRange.type === "absolute") {
          params.startDate = dateRange.startDate;
          params.endDate = dateRange.endDate;
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
          params.startDate = new Date(now.getTime() - ms).toISOString();
          params.endDate = now.toISOString();
        }
      }

      const result = await apiGet<PaginatedResponse<AuditLog>>("/api/audit-logs", params);
      setLogs(result.data);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch (err) {
      const message = err instanceof ApiError ? err.body.error : "Failed to load audit logs.";
      addNotification({ type: "error", content: message });
    } finally {
      setLoading(false);
    }
  }, [actionFilter, resourceFilter, dateRange, userIdFilter, addNotification]);

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  useEffect(() => {
    setPage(1);
  }, [actionFilter, resourceFilter, dateRange, userIdFilter]);

  return (
    <ContentLayout header={<Header variant="h1">{t("page.auditLogs")}</Header>}>
      <Table
        items={logs}
        loading={loading}
        loadingText="Loading audit logs..."
        variant="full-page"
        stickyHeader
        sortingDisabled
        header={
          <Header variant="h2" counter={`(${total})`}>
            {t("page.auditLogs")}
          </Header>
        }
        filter={
          <SpaceBetween direction="horizontal" size="xs">
            <Select
              selectedOption={actionFilter}
              onChange={({ detail }) => setActionFilter(detail.selectedOption as typeof actionFilter)}
              options={ACTION_OPTIONS}
              placeholder={t("auditLog.filterByAction")}
            />
            <Select
              selectedOption={resourceFilter}
              onChange={({ detail }) => setResourceFilter(detail.selectedOption as typeof resourceFilter)}
              options={RESOURCE_OPTIONS}
              placeholder={t("auditLog.filterByResource")}
            />
            <Input
              value={userIdFilter}
              onChange={({ detail }) => setUserIdFilter(detail.value)}
              placeholder="User ID"
              type="search"
            />
            <DateRangePicker
              value={dateRange}
              onChange={({ detail }) => setDateRange(detail.value)}
              placeholder="Date range"
              relativeOptions={[
                { key: "1h", amount: 1, unit: "hour", type: "relative" },
                { key: "24h", amount: 24, unit: "hour", type: "relative" },
                { key: "7d", amount: 7, unit: "day", type: "relative" },
                { key: "30d", amount: 30, unit: "day", type: "relative" },
              ]}
              i18nStrings={{
                todayAriaLabel: "Today",
                nextMonthAriaLabel: "Next month",
                previousMonthAriaLabel: "Previous month",
                customRelativeRangeDurationLabel: "Duration",
                customRelativeRangeDurationPlaceholder: "Enter duration",
                customRelativeRangeOptionLabel: "Custom range",
                customRelativeRangeOptionDescription: "Set a custom range in the past",
                customRelativeRangeUnitLabel: "Unit of time",
                formatRelativeRange: (value) => {
                  const unit = value.amount === 1 ? value.unit : `${value.unit}s`;
                  return `Last ${value.amount} ${unit}`;
                },
                formatUnit: (unit, value) => (value === 1 ? unit : `${unit}s`),
                dateTimeConstraintText: "",
                relativeModeTitle: "Relative range",
                absoluteModeTitle: "Absolute range",
                relativeRangeSelectionHeading: "Choose a range",
                startDateLabel: "Start date",
                startTimeLabel: "Start time",
                endDateLabel: "End date",
                endTimeLabel: "End time",
                clearButtonLabel: "Clear",
                cancelButtonLabel: "Cancel",
                applyButtonLabel: "Apply",
              }}
              isValidRange={(value) => {
                if (value?.type === "absolute") {
                  if (!value.startDate || !value.endDate) {
                    return { valid: false, errorMessage: "Select a complete date range." };
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
            cell: (item) => item.resource,
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
            header: t("auditLog.userId"),
            cell: (item) => item.userId ? <Box variant="code">{item.userId}</Box> : "System",
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
            cell: (item) => new Date(item.createdAt).toLocaleString(),
            width: 200,
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No audit logs</b>
              <Box variant="p" color="inherit">No logs match the current filters.</Box>
            </SpaceBetween>
          </Box>
        }
      />
    </ContentLayout>
  );
}
