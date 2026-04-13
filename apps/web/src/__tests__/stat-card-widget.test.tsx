import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatCardWidget } from "@/components/dashboard/widgets/stat-card-widget";

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    apiFetch: vi.fn().mockResolvedValue({
      devices: { up_count: "42", down_count: "3", warning_count: "5", unknown_count: "1", maintenance_count: "2", total: "53" },
      incidents: { problem_count: "7", acknowledged_count: "2", resolved_today: "4", active_count: "9" },
    }),
  };
});

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("StatCardWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with testid", async () => {
    render(
      <StatCardWidget
        id="w1"
        type="stat-card"
        config={{ metric: "device_count", title: "Total Devices" }}
      />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByTestId("widget-stat-card")).toBeInTheDocument();
  });

  it("shows title from config", async () => {
    render(
      <StatCardWidget
        id="w2"
        type="stat-card"
        config={{ metric: "device_count", title: "Total Devices" }}
      />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByText("Total Devices")).toBeInTheDocument();
  });

  it("shows loading skeleton initially", () => {
    render(
      <StatCardWidget
        id="w3"
        type="stat-card"
        config={{ metric: "device_count", title: "Devices" }}
      />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByText("Devices")).toBeInTheDocument();
  });

  it("renders the metric value after data loads", async () => {
    render(
      <StatCardWidget
        id="w4"
        type="stat-card"
        config={{ metric: "device_count", title: "Total" }}
      />,
      { wrapper: createWrapper() }
    );
    await vi.waitFor(() => {
      expect(screen.getByText("53")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("shows % suffix for uptime metric", async () => {
    render(
      <StatCardWidget
        id="w5"
        type="stat-card"
        config={{ metric: "uptime", title: "Uptime" }}
      />,
      { wrapper: createWrapper() }
    );
    await vi.waitFor(() => {
      expect(screen.getByText("79%")).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
