import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import type { Dashboard } from "@/components/dashboard/types";

/* ─── Summary (existing) ─── */

export interface DashboardSummary {
  devices: {
    up_count: string;
    down_count: string;
    warning_count: string;
    unknown_count: string;
    maintenance_count: string;
    total: string;
  };
  incidents: {
    problem_count: string;
    acknowledged_count: string;
    resolved_today: string;
    active_count: string;
  };
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiFetch<DashboardSummary>("/api/dashboard/summary"),
  });
}

/* ─── Dashboard CRUD ─── */

interface DashboardListResponse {
  data: Dashboard[];
}

export function useDashboards() {
  return useQuery({
    queryKey: ["dashboards"],
    queryFn: async () => {
      const res = await apiFetch<DashboardListResponse>("/api/dashboards");
      return res.data;
    },
  });
}

interface DashboardApiWidget {
  id: string;
  widgetType: string;
  config: Record<string, unknown>;
  gridPosition: Record<string, unknown>;
}

interface DashboardApiResponse extends Omit<Dashboard, "widgets"> {
  widgets: DashboardApiWidget[];
}

export function useDashboard(id: string | null) {
  return useQuery({
    queryKey: ["dashboards", id],
    queryFn: () => apiFetch<DashboardApiResponse>(`/api/dashboards/${id}`),
    enabled: !!id,
  });
}

export function useCreateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      apiFetch<Dashboard>("/api/dashboards", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function useUpdateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; widgets?: Array<{ widgetType: string; config: Record<string, unknown>; gridPosition: Record<string, unknown> }>; name?: string; description?: string }) =>
      apiFetch<Dashboard>(`/api/dashboards/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["dashboards", variables.id] });
      qc.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function useDeleteDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ message: string }>(`/api/dashboards/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}
