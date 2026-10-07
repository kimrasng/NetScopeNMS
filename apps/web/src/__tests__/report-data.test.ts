import { describe, expect, it } from "vitest";
import { observedAvailability } from "../lib/report-data";
import { reportTitle } from "../lib/report-title";

describe("report presentation", () => {
  it("weights availability by observations rather than device count", () => {
    expect(observedAvailability([{ uptime_pct: "100", samples: "9" }, { uptime_pct: 0, samples: 1 }])).toBe(90);
  });
  it("keeps absence of observations separate from zero availability", () => {
    expect(observedAvailability([{ uptime_pct: 0, samples: 0 }, { uptime_pct: null, samples: 10 }])).toBeNull();
    expect(observedAvailability([{ uptime_pct: 0, samples: 10 }])).toBe(0);
  });
  it("excludes malformed observations from the aggregate", () => {
    expect(observedAvailability([{ uptime_pct: "unknown", samples: 1 }, { uptime_pct: 90, samples: "invalid" }, { uptime_pct: 75, samples: 4 }])).toBe(75);
  });
  it("localizes an automatically generated report title", () => {
    const labels: Record<string, string> = { "report.availability": "가용성", "report.daily": "일간" };
    expect(reportTitle({ title: "availability Report - daily", type: "availability", period: "daily" }, key => labels[key] ?? key)).toBe("가용성 · 일간");
  });
  it("retains the title supplied by a user", () => {
    expect(reportTitle({ title: "Branch availability review", type: "availability", period: "daily" }, () => "translated")).toBe("Branch availability review");
  });
});
