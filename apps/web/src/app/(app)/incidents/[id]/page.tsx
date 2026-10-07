"use client";
import { formatDateTime } from "@/lib/date-format";

import { useState } from "react";
import { useParams } from "next/navigation";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import SpaceBetween from "@cloudscape-design/components/space-between";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Box from "@cloudscape-design/components/box";
import Badge from "@cloudscape-design/components/badge";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Button from "@cloudscape-design/components/button";
import { AnalysisView } from "@/components/common/analysis-view";
import Link from "@cloudscape-design/components/link";
import FormField from "@cloudscape-design/components/form-field";
import Textarea from "@cloudscape-design/components/textarea";
import Spinner from "@cloudscape-design/components/spinner";
import Modal from "@cloudscape-design/components/modal";
import Input from "@cloudscape-design/components/input";
import Alert from "@cloudscape-design/components/alert";
import { useAuth } from "@/lib/auth";
import { canOperate } from "@/lib/permissions";
import { useApi } from "@/hooks/use-api";
import { useNotifications } from "@/hooks/use-notifications";
import { useI18n } from "@/lib/i18n";
import { apiPost, ApiError } from "@/lib/api";
import type { Incident, IncidentEvent, IncidentStatus, Severity } from "@/lib/types";

// ─── Constants ────────────────────────────────────────

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

const EVENT_TYPE_COLOR: Record<string, "red" | "blue" | "grey" | "green"> = {
  created: "blue",
  acknowledged: "grey",
  resolved: "green",
  comment: "grey",
  escalated: "red",
  ai_analysis: "blue",
};

// ─── Types ────────────────────────────────────────────

interface IncidentDetail extends Incident {
  device?: { id: string; name: string; ip: string } | null;
  rule?: { id: string; name: string } | null;
  events?: IncidentEvent[];
  notifications?: { id: string; channelType: string; status: string; sentAt?: string | null }[];
}

// ─── Incident Detail Page ─────────────────────────────

export default function IncidentDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const { data: incident, loading, error, refetch } = useApi<IncidentDetail>(`/api/incidents/${id}`);

  const [comment, setComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [ackModalVisible, setAckModalVisible] = useState(false);
  const [ackComment, setAckComment] = useState("");

  async function handleAction(action: string, body?: unknown) {
    setActionLoading(action);
    try {
      await apiPost(`/api/incidents/${id}/${action}`, body);
      addNotification({ type: "success", content: `Incident ${action} successful.` });
      await refetch();
    } catch (err) {
      const message = err instanceof ApiError ? err.body.error : "Action failed";
      addNotification({ type: "error", content: message });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddComment() {
    if (!comment.trim()) return;
    setSubmittingComment(true);
    try {
      await apiPost(`/api/incidents/${id}/comments`, { message: comment });
      addNotification({ type: "success", content: "Comment added." });
      setComment("");
      await refetch();
    } catch (err) {
      const message = err instanceof ApiError ? err.body.error : "Failed to add comment";
      addNotification({ type: "error", content: message });
    } finally {
      setSubmittingComment(false);
    }
  }

  function handleAcknowledge() {
    setAckModalVisible(false);
    handleAction("acknowledge", ackComment.trim() ? { comment: ackComment } : undefined);
    setAckComment("");
  }

  if (error) return <Alert type="error" action={<Button onClick={refetch}>{t("Retry")}</Button>}>{error}</Alert>;
  if (!loading && !incident) return <Alert type="error">{t("Incident not found")}</Alert>;
  if (loading || !incident) {
    return (
      <ContentLayout header={<Header variant="h1">{t("Incident")}</Header>}>
        <Box textAlign="center" padding="xxl">
          <Spinner size="large" />
        </Box>
      </ContentLayout>
    );
  }

  const deviceName = incident.device?.name ?? incident.deviceName ?? "-";
  const deviceIp = incident.device?.ip ?? incident.deviceIp ?? "-";
  const statusInfo = STATUS_MAP[incident.status];

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              {canOperate(user) && incident.status === "problem" && (
                <Button
                  loading={actionLoading === "acknowledge"}
                  onClick={() => setAckModalVisible(true)}
                >
                  {t("incident.acknowledge")}
                </Button>
              )}
              {canOperate(user) && incident.status !== "resolved" && (
                <Button
                  loading={actionLoading === "resolve"}
                  onClick={() => handleAction("resolve")}
                >
                  {t("incident.resolve")}
                </Button>
              )}
              <Button href={`/ai?incidentId=${id}`} iconName="gen-ai">{t("ai.chat")}</Button>
              <Button
                variant="primary"
                loading={actionLoading === "ai-analysis"}
                disabled={!canOperate(user)} onClick={() => handleAction("ai-analysis")}
              >
                {t("incident.aiAnalysis")}
              </Button>
            </SpaceBetween>
          }
        >
          {incident.title}
        </Header>
      }
    >

      <SpaceBetween size="l">
        {/* ─── Overview ─────────────────────────────── */}
        <Container header={<Header variant="h2">{t("Overview")}</Header>}>
          <ColumnLayout columns={3} variant="text-grid">
            <SpaceBetween size="s">
              <div>
                <Box variant="awsui-key-label">{t("incident.severity")}</Box>
                <Badge color={SEVERITY_COLOR[incident.severity]}>
                  {t(`severity.${incident.severity}`)}
                </Badge>
              </div>
              <div>
                <Box variant="awsui-key-label">{t("common.status")}</Box>
                <StatusIndicator type={statusInfo.type}>{t(statusInfo.key)}</StatusIndicator>
              </div>
            </SpaceBetween>
            <SpaceBetween size="s">
              <div>
                <Box variant="awsui-key-label">{t("incident.device")}</Box>
                <Link href={`/devices/${incident.deviceId}`}>{deviceName} ({deviceIp})</Link>
              </div>
              <div>
                <Box variant="awsui-key-label">{t("incident.metricName")}</Box>
                <Box>{incident.metricName ?? "-"}</Box>
              </div>
              <div>
                <Box variant="awsui-key-label">{t("incident.metricValue")}</Box>
                <Box>{incident.metricValue != null ? String(incident.metricValue) : "-"}</Box>
              </div>
            </SpaceBetween>
            <SpaceBetween size="s">
              <div>
                <Box variant="awsui-key-label">{t("incident.startedAt")}</Box>
                <Box>{formatDateTime(new Date(incident.startedAt))}</Box>
              </div>
              <div>
                <Box variant="awsui-key-label">{t("incident.resolvedAt")}</Box>
                <Box>{incident.resolvedAt ? formatDateTime(new Date(incident.resolvedAt)) : "-"}</Box>
              </div>
              {incident.acknowledgedBy && (
                <div>
                  <Box variant="awsui-key-label">{t("Acknowledged By")}</Box>
                  <Box>{incident.acknowledgedByName ?? t("User")}</Box>
                </div>
              )}
            </SpaceBetween>
          </ColumnLayout>
        </Container>

        {/* ─── AI Root Cause Analysis ──────────────── */}
        {incident.aiRca && (
          <Container header={<Header variant="h2">{t("incident.aiRca")}</Header>}>
            <AnalysisView raw={incident.aiRca} summary={incident.aiSummary} />
          </Container>
        )}

        {/* ─── Event Timeline ─────────────────────── */}
        <Container header={<Header variant="h2">{t("incident.events")}</Header>}>
          {incident.events && incident.events.length > 0 ? (
            <SpaceBetween size="m">
              {incident.events.map((event) => (
                <div key={event.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Badge color={EVENT_TYPE_COLOR[event.type] ?? "grey"}>
                    {t(`event.${event.type}`)}
                  </Badge>
                  <div style={{ flex: 1 }}>
                    <Box variant="p">{event.message}</Box>
                    <Box variant="small" color="text-body-secondary">
                      {formatDateTime(new Date(event.createdAt))}
                      {event.createdByName ? ` · ${event.createdByName}` : ""}
                    </Box>
                  </div>
                </div>
              ))}
            </SpaceBetween>
          ) : (
            <Box textAlign="center" color="inherit" padding="l">
              {t("No events recorded.")}</Box>
          )}
        </Container>

        {/* ─── Add Comment ─────────────────────────── */}
        <Container header={<Header variant="h2">{t("incident.addComment")}</Header>}>
          <SpaceBetween size="m">
            <FormField label={t("incident.comment")}>
              <Textarea
                value={comment}
                onChange={({ detail }) => setComment(detail.value)}
                placeholder={t("Write a comment...")}
                rows={3}
              />
            </FormField>
            <Button
              loading={submittingComment}
              disabled={!comment.trim() || !canOperate(user)} onClick={handleAddComment}
            >
              {t("incident.addComment")}
            </Button>
          </SpaceBetween>
        </Container>
      </SpaceBetween>

      {/* ─── Acknowledge Modal ───────────────────── */}
      <Modal
        visible={ackModalVisible}
        onDismiss={() => setAckModalVisible(false)}
        header={t("incident.acknowledge")}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setAckModalVisible(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" onClick={handleAcknowledge}>
                {t("incident.acknowledge")}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <FormField label={`${t("incident.comment")} (optional)`}>
          <Input
            value={ackComment}
            onChange={({ detail }) => setAckComment(detail.value)}
            placeholder={t("Add a note...")}
          />
        </FormField>
      </Modal>
    </ContentLayout>
  );
}
