"use client";

import { useCallback } from "react";
import { ResponsiveLine } from "@nivo/line";
import type { LineSeries } from "@nivo/line";
import type { LineCurveFactoryId } from "@nivo/core";
import { Download } from "lucide-react";
import { useNivoTheme } from "./nivo-theme";

interface LineChartProps<S extends LineSeries = LineSeries> {
  data: readonly S[];
  xLabel?: string;
  yLabel?: string;
  enableArea?: boolean;
  curve?: LineCurveFactoryId;
  height?: number;
}

function seriesToCsv(data: readonly LineSeries[]): string {
  const header = ["series", "x", "y"];
  const rows = data.flatMap((s) =>
    s.data.map((d) => [String(s.id), String(d.x ?? ""), String(d.y ?? "")])
  );
  return [header, ...rows].map((r) => r.join(",")).join("\n");
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function LineChart<S extends LineSeries = LineSeries>({
  data,
  xLabel,
  yLabel,
  enableArea = false,
  curve = "monotoneX",
  height = 300,
}: LineChartProps<S>) {
  const { theme, colors } = useNivoTheme();

  const handleExport = useCallback(() => {
    downloadCsv(seriesToCsv(data as unknown as LineSeries[]), "chart-data.csv");
  }, [data]);

  return (
    <div style={{ height }} className="relative">
      <button
        type="button"
        onClick={handleExport}
        className="absolute top-0 right-0 z-10 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Export CSV"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
      <ResponsiveLine
        data={data}
        theme={theme}
        colors={colors}
        margin={{ top: 8, right: 16, bottom: xLabel ? 46 : 30, left: yLabel ? 54 : 42 }}
        xScale={{ type: "point" }}
        yScale={{ type: "linear", min: "auto", max: "auto", stacked: false }}
        curve={curve}
        enableArea={enableArea}
        areaOpacity={0.08}
        lineWidth={2}
        enablePoints={false}
        useMesh
        enableSlices="x"
        enableCrosshair
        enableGridX={false}
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
          legend: xLabel,
          legendOffset: 36,
          legendPosition: "middle",
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 8,
          legend: yLabel,
          legendOffset: -44,
          legendPosition: "middle",
        }}
        animate
        motionConfig="gentle"
      />
    </div>
  );
}
