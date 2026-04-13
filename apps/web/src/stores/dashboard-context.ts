import { create } from "zustand";
import type { TimeRange } from "@/components/dashboard/types";

interface DashboardContextState {
  selectedHostId: string | null;
  selectedTimeRange: TimeRange;
  selectedSeverity: string | null;
  setSelectedHost: (hostId: string | null) => void;
  setTimeRange: (range: TimeRange) => void;
  setSeverity: (severity: string | null) => void;
  clearContext: () => void;
}

export const useDashboardContextStore = create<DashboardContextState>(
  (set) => ({
    selectedHostId: null,
    selectedTimeRange: "1h",
    selectedSeverity: null,
    setSelectedHost: (hostId) => set({ selectedHostId: hostId }),
    setTimeRange: (range) => set({ selectedTimeRange: range }),
    setSeverity: (severity) => set({ selectedSeverity: severity }),
    clearContext: () =>
      set({
        selectedHostId: null,
        selectedTimeRange: "1h",
        selectedSeverity: null,
      }),
  }),
);
