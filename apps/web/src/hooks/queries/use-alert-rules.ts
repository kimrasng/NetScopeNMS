import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";

export interface AlertRule {
  id: string;
  name: string;
  description?: string | null;
  deviceId?: string | null;
  groupId?: string | null;
  metricName: string;
  operator: string;
  threshold: number;
  severity: "critical" | "high" | "medium" | "low";
  channels: string[];
  flapThreshold: number;
  flapWindow: number;
  escalationMinutes?: number | null;
  escalationChannels?: string[] | null;
  runbookUrl?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlertRuleFormData {
  name: string;
  description?: string;
  deviceId?: string;
  groupId?: string;
  metricName: string;
  operator: string;
  threshold: number;
  severity: "critical" | "high" | "medium" | "low";
  channels?: string[];
  flapThreshold?: number;
  flapWindow?: number;
  escalationMinutes?: number;
  escalationChannels?: string[];
  runbookUrl?: string;
  enabled: boolean;
}

const QUERY_KEY = ["alert-rules"];

export function useAlertRules() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<AlertRule[]>("/api/alert-rules"),
  });
}

export function useCreateAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AlertRuleFormData) =>
      apiFetch<AlertRule>("/api/alert-rules", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdateAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<AlertRuleFormData> & { id: string }) =>
      apiFetch<AlertRule>(`/api/alert-rules/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ message: string }>(`/api/alert-rules/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
