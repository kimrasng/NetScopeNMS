import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";

export interface ConfigSnapshot {
  id: string;
  deviceId: string;
  configText: string;
  hash: string;
  diff: string | null;
  capturedAt: string;
}

export interface DiffResult {
  added: string[];
  removed: string[];
  unchanged: number;
}

interface PaginatedResponse {
  data: ConfigSnapshot[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export function useConfigSnapshots(params: { deviceId?: string; page?: number; limit?: number } = {}) {
  const { deviceId, page = 1, limit = 50 } = params;
  return useQuery({
    queryKey: ["config-snapshots", { deviceId, page, limit }],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (deviceId) p.set("deviceId", deviceId);
      return apiFetch<PaginatedResponse>(`/api/config-snapshots?${p}`);
    },
  });
}

export function useConfigSnapshot(id: string | null) {
  return useQuery({
    queryKey: ["config-snapshots", id],
    queryFn: () => apiFetch<ConfigSnapshot>(`/api/config-snapshots/${id}`),
    enabled: !!id,
  });
}

export function useConfigSnapshotDiff(id1: string | null, id2: string | null) {
  return useQuery({
    queryKey: ["config-snapshots", "diff", id1, id2],
    queryFn: () => apiFetch<DiffResult>(`/api/config-snapshots/${id1}/diff/${id2}`),
    enabled: !!id1 && !!id2,
  });
}
