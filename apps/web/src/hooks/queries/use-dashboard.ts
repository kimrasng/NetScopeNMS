import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";

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
