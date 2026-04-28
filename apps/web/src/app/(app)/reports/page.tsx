"use client";

import { useState, useCallback, useMemo } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Badge from "@cloudscape-design/components/badge";
import Modal from "@cloudscape-design/components/modal";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Select from "@cloudscape-design/components/select";
import type { SelectProps } from "@cloudscape-design/components/select";
import Pagination from "@cloudscape-design/components/pagination";
import Container from "@cloudscape-design/components/container";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { useApi } from "@/hooks/use-api";
import { useNotifications } from "@/hooks/use-notifications";
import { apiPost } from "@/lib/api";
import type { Report, ReportType, PaginatedResponse } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

// ─── Constants ────────────────────────────────────────

const TYPE_COLORS: Record<ReportType, "blue" | "green" | "red" | "grey"> = {
  availability: "green",
  performance: "blue",
  alert_summary: "red",
  ai_narrative: "grey",
};

function formatTypeName(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderContentValue(value: unknown, depth: number): React.ReactNode {
  if (value === null || value === undefined) return <span>—</span>;
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  if (typeof value === "number" || typeof value === "string") return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    return (
      <SpaceBetween size="xxs">
        {value.map((item, i) => (
          <Box key={i} variant="code">{typeof item === "object" ? JSON.stringify(item) : String(item)}</Box>
        ))}
      </SpaceBetween>
    );
  }
  if (typeof value === "object") {
    if (depth > 2) return <Box variant="code">{JSON.stringify(value)}</Box>;
    return (
      <SpaceBetween size="xs">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <ExpandableSection key={k} headerText={k} variant="footer">
            {renderContentValue(v, depth + 1)}
          </ExpandableSection>
        ))}
      </SpaceBetween>
    );
  }
  return <span>{String(value)}</span>;
}

// ─── Reports Page ─────────────────────────────────────

export default function ReportsPage() {
  const { t } = useI18n();
  const { addNotification } = useNotifications();
  const [page, setPage] = useState(1);
  const { data, loading, refetch } = useApi<PaginatedResponse<Report>>(
    "/api/reports",
    { page, limit: 20 },
  );

  const REPORT_TYPE_OPTIONS: SelectProps.Option[] = useMemo(() => [
    { value: "availability", label: t("report.availability") },
    { value: "performance", label: t("report.performance") },
    { value: "alert_summary", label: t("report.alertSummary") },
    { value: "ai_narrative", label: t("report.aiNarrative") },
  ], [t]);

  const PERIOD_OPTIONS: SelectProps.Option[] = useMemo(() => [
    { value: "daily", label: t("report.daily") },
    { value: "weekly", label: t("report.weekly") },
    { value: "monthly", label: t("report.monthly") },
  ], [t]);

  const [generateVisible, setGenerateVisible] = useState(false);
  const [generateType, setGenerateType] = useState<SelectProps.Option | null>(REPORT_TYPE_OPTIONS[0]);
  const [generatePeriod, setGeneratePeriod] = useState<SelectProps.Option | null>(PERIOD_OPTIONS[0]);
  const [generating, setGenerating] = useState(false);

  const [detailReport, setDetailReport] = useState<Report | null>(null);

  const reports = data?.data ?? [];
  const pagination = data?.pagination;

  const { items, collectionProps } = useCollection(reports, {
    sorting: {
      defaultState: { sortingColumn: { sortingField: "generatedAt" }, isDescending: true },
    },
  });

  const handleGenerate = useCallback(async () => {
    if (!generateType || !generatePeriod) return;
    setGenerating(true);
    try {
      await apiPost("/api/reports/generate", {
        type: generateType.value,
        period: generatePeriod.value,
      });
      addNotification({ type: "success", content: t("report.generated") });
      setGenerateVisible(false);
      refetch();
    } catch {
      addNotification({ type: "error", content: t("report.generated") });
    } finally {
      setGenerating(false);
    }
  }, [generateType, generatePeriod, addNotification, refetch]);

  return (
    <ContentLayout header={<Header variant="h1">{t("page.reports")}</Header>}>
      <Table
        {...collectionProps}
        items={items}
        loading={loading}
        loadingText={t("page.reports")}
        variant="full-page"
        stickyHeader
        onRowClick={({ detail }) => setDetailReport(detail.item)}
        header={
          <Header
            counter={pagination ? `(${pagination.total})` : undefined}
            actions={
              <Button variant="primary" onClick={() => setGenerateVisible(true)}>
                {t("report.generateReport")}
              </Button>
            }
          >
            {t("page.reports")}
          </Header>
        }
        pagination={
          pagination ? (
            <Pagination
              currentPageIndex={page}
              pagesCount={pagination.totalPages}
              onChange={({ detail }) => setPage(detail.currentPageIndex)}
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
            id: "title",
            header: t("report.title"),
            cell: (item) => item.title,
            sortingField: "title",
            width: 250,
          },
          {
            id: "type",
            header: t("report.type"),
            cell: (item) => (
              <Badge color={TYPE_COLORS[item.type]}>{formatTypeName(item.type)}</Badge>
            ),
            sortingField: "type",
            width: 150,
          },
          {
            id: "period",
            header: t("report.period"),
            cell: (item) => (item.period ? formatTypeName(item.period) : "—"),
            sortingField: "period",
            width: 110,
          },
          {
            id: "generatedAt",
            header: t("report.generatedAt"),
            cell: (item) => new Date(item.generatedAt).toLocaleString(),
            sortingField: "generatedAt",
            width: 180,
          },
          {
            id: "generatedBy",
            header: t("report.generatedBy"),
            cell: (item) => item.generatedBy ?? "System",
            width: 150,
          },
        ]}
        empty={
          <Box textAlign="center" color="inherit" padding="l">
            <SpaceBetween size="m">
              <Box variant="strong">{t("page.reports")}</Box>
              <Box variant="p" color="inherit">{t("report.generateReport")}</Box>
              <Button variant="primary" onClick={() => setGenerateVisible(true)}>
                {t("report.generateReport")}
              </Button>
            </SpaceBetween>
          </Box>
        }
      />

      <Modal
        visible={generateVisible}
        onDismiss={() => setGenerateVisible(false)}
        header={t("report.generateReport")}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setGenerateVisible(false)}>{t("common.cancel")}</Button>
              <Button variant="primary" loading={generating} onClick={handleGenerate}>
                {t("common.generate")}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Form>
          <SpaceBetween size="m">
            <FormField label={t("report.selectType")}>
              <Select
                selectedOption={generateType}
                onChange={({ detail }) => setGenerateType(detail.selectedOption)}
                options={REPORT_TYPE_OPTIONS}
              />
            </FormField>
            <FormField label={t("report.selectPeriod")}>
              <Select
                selectedOption={generatePeriod}
                onChange={({ detail }) => setGeneratePeriod(detail.selectedOption)}
                options={PERIOD_OPTIONS}
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </Modal>

      <Modal
        visible={detailReport !== null}
        onDismiss={() => setDetailReport(null)}
        header={detailReport?.title ?? "Report Detail"}
        size="large"
      >
        {detailReport && (
          <SpaceBetween size="l">
            <SpaceBetween direction="horizontal" size="m">
              <Badge color={TYPE_COLORS[detailReport.type]}>{formatTypeName(detailReport.type)}</Badge>
              {detailReport.period &&               <Box variant="small">{t("report.period")}: {formatTypeName(detailReport.period)}</Box>}
              <Box variant="small">{t("report.generatedAt")}: {new Date(detailReport.generatedAt).toLocaleString()}</Box>
            </SpaceBetween>

            {detailReport.aiSummary && (
              <Container
                header={<Header variant="h3">{t("report.aiSummary")}</Header>}
              >
                <Box
                  variant="p"
                  padding="m"
                  color="text-status-info"
                >
                  {detailReport.aiSummary}
                </Box>
              </Container>
            )}

            {detailReport.content && (
              <Container header={<Header variant="h3">{t("page.reports")}</Header>}>
                {renderContentValue(detailReport.content, 0)}
              </Container>
            )}

            {!detailReport.content && !detailReport.aiSummary && (
              <Box textAlign="center" color="inherit" padding="l">
                <Box variant="p">No content available for this report.</Box>
              </Box>
            )}
          </SpaceBetween>
        )}
      </Modal>
    </ContentLayout>
  );
}
