import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";

export interface MaintenanceWindow {
  id: string;
  name: string;
  description: string | null;
  deviceIds: string[];
  groupIds: string[];
  startAt: string;
  endAt: string;
  recurring: boolean | null;
  cronExpression: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface PaginatedResponse {
  data: MaintenanceWindow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export type MaintenanceStatus = "active" | "upcoming" | "past";

export function useMaintenanceWindows(params: { status?: MaintenanceStatus; page?: number; limit?: number } = {}) {
  const { status, page = 1, limit = 50 } = params;
  return useQuery({
    queryKey: ["maintenance-windows", { status, page, limit }],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) p.set("status", status);
      return apiFetch<PaginatedResponse>(`/api/maintenance-windows?${p}`);
    },
  });
}

export function useCreateMaintenanceWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      deviceIds?: string[];
      groupIds?: string[];
      startAt: string;
      endAt: string;
      recurring?: boolean;
      cronExpression?: string;
    }) =>
      apiFetch<MaintenanceWindow>("/api/maintenance-windows", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance-windows"] });
    },
  });
}

export function useUpdateMaintenanceWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: {
      id: string;
      name?: string;
      description?: string;
      deviceIds?: string[];
      groupIds?: string[];
      startAt?: string;
      endAt?: string;
      recurring?: boolean;
      cronExpression?: string;
    }) =>
      apiFetch<MaintenanceWindow>(`/api/maintenance-windows/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance-windows"] });
    },
  });
}

export function useDeleteMaintenanceWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ message: string }>(`/api/maintenance-windows/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance-windows"] });
    },
  });
}
