"use client";
import { formatDateTime } from "@/lib/date-format";

import { useState, useCallback, useMemo } from "react";
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
import { reportTitle } from "@/lib/report-title";
import { ReportView } from "@/components/common/report-view";
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
  const [formError, setFormError] = useState("");
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
    setFormError("");
    setGenerating(true);
    try {
      await apiPost("/api/reports/generate", {
        type: generateType.value,
        period: generatePeriod.value,
      });
      addNotification({ type: "success", content: t("report.generated") });
      setGenerateVisible(false);
      refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("Report generation failed"));
    } finally {
      setGenerating(false);
    }
  }, [generateType, generatePeriod, addNotification, refetch, t]);

  return (
    <>
      <Table
        {...collectionProps}
        items={items}
        loading={loading}
        loadingText={t("page.reports")}
        variant="full-page"
        stickyHeader
        onRowClick={({ detail }) => setDetailReport(detail.item)}
        header={
          <Header variant="awsui-h1-sticky"
            counter={pagination ? `(${pagination.total})` : undefined}
            actions={
              <Button variant="primary" onClick={() => { setFormError(""); setGenerateVisible(true); }}>
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
            />
          ) : undefined
        }
        columnDefinitions={[
          {
            id: "title",
            header: t("report.title"),
            cell: (item) => <Button variant="inline-link" onClick={() => setDetailReport(item)}>{reportTitle(item, t)}</Button>,
            sortingField: "title",
            width: 250,
          },
          {
            id: "type",
            header: t("report.type"),
            cell: (item) => (
              <Badge color={TYPE_COLORS[item.type]}>{t({ availability: "report.availability", performance: "report.performance", alert_summary: "report.alertSummary", ai_narrative: "report.aiNarrative" }[item.type])}</Badge>
            ),
            sortingField: "type",
            width: 150,
          },
          {
            id: "period",
            header: t("report.period"),
            cell: (item) => (item.period ? t(`report.${item.period}`) : "—"),
            sortingField: "period",
            width: 110,
          },
          {
            id: "generatedAt",
            header: t("report.generatedAt"),
            cell: (item) => formatDateTime(new Date(item.generatedAt)),
            sortingField: "generatedAt",
            width: 180,
          },
          {
            id: "generatedBy",
            header: t("report.generatedBy"),
            cell: (item) => item.generatedByName ?? t("System"),
            width: 150,
          },
        ]}
        empty={<Box textAlign="center" padding="l"><SpaceBetween size="s"><Box variant="strong">{t("No reports generated")}</Box><Box>{t("Generate a report to review collected observations for a period.")}</Box></SpaceBetween></Box>}
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
        <Form errorText={formError}>
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
        header={detailReport ? reportTitle(detailReport, t) : t("Details")}
        size="large"
      >
        {detailReport && <ReportView report={detailReport} />}
      </Modal>
    </>
  );
}
