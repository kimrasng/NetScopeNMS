import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditLogPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AuditLogResponse {
  data: AuditLogEntry[];
  pagination: AuditLogPagination;
}

export interface AuditLogFilters {
  action?: string;
  resource?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (filters.action) p.set("action", filters.action);
      if (filters.resource) p.set("resource", filters.resource);
      if (filters.from) p.set("from", filters.from);
      if (filters.to) p.set("to", filters.to);
      p.set("page", String(filters.page || 1));
      p.set("limit", String(filters.limit || 50));
      return apiFetch<AuditLogResponse>(`/api/audit-logs?${p}`);
    },
  });
}
