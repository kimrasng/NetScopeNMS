"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ResponsiveLine } from "@nivo/line";
import type { LineSeries } from "@nivo/line";
import type { CartesianMarkerProps, LineCurveFactoryId } from "@nivo/core";
import type { LegendProps } from "@nivo/legends";
import { Download, RotateCcw } from "lucide-react";
import { useNivoTheme } from "./nivo-theme";

interface LineChartProps<S extends LineSeries = LineSeries> {
  data: readonly S[];
  xLabel?: string;
  yLabel?: string;
  enableArea?: boolean;
  curve?: LineCurveFactoryId;
  height?: number;
  showLegend?: boolean;
  show95thPercentile?: boolean;
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

/** Sort y-values and pick the value at the 95th percentile index. */
function percentile95(series: LineSeries): number | null {
  const nums = series.data
    .map((d) => (typeof d.y === "number" ? d.y : null))
    .filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

interface ZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

const INITIAL_ZOOM: ZoomState = { scale: 1, translateX: 0, translateY: 0 };
const MIN_SCALE = 0.5;
const MAX_SCALE = 10;

export function LineChart<S extends LineSeries = LineSeries>({
  data,
  xLabel,
  yLabel,
  enableArea = false,
  curve = "monotoneX",
  height = 300,
  showLegend = false,
  show95thPercentile = false,
}: LineChartProps<S>) {
  const { theme, colors } = useNivoTheme();

  const handleExport = useCallback(() => {
    downloadCsv(seriesToCsv(data as unknown as LineSeries[]), "chart-data.csv");
  }, [data]);

  const [zoom, setZoom] = useState<ZoomState>(INITIAL_ZOOM);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const zoomAtPanStart = useRef(INITIAL_ZOOM);

  const isZoomed = zoom.scale !== 1 || zoom.translateX !== 0 || zoom.translateY !== 0;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
      return { ...prev, scale: next };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    zoomAtPanStart.current = zoom;
  }, [zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setZoom({
      ...zoomAtPanStart.current,
      translateX: zoomAtPanStart.current.translateX + dx,
      translateY: zoomAtPanStart.current.translateY + dy,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const resetZoom = useCallback(() => setZoom(INITIAL_ZOOM), []);

  const markers = useMemo<CartesianMarkerProps[]>(() => {
    if (!show95thPercentile) return [];
    const result: CartesianMarkerProps[] = [];
    for (const s of data as unknown as LineSeries[]) {
      const p = percentile95(s);
      if (p === null) continue;
      result.push({
        axis: "y",
        value: p,
        legend: `P95 ${String(s.id)}: ${p}`,
        legendOrientation: "horizontal",
        legendPosition: "top-left",
        lineStyle: {
          stroke: "hsl(349 89% 60%)",
          strokeWidth: 1.5,
          strokeDasharray: "6 4",
        },
        textStyle: { fontSize: 10, fill: "hsl(349 89% 60%)" },
      });
    }
    return result;
  }, [data, show95thPercentile]);

  const legends = useMemo<LegendProps[]>(() => {
    if (!showLegend) return [];
    return [
      {
        anchor: "bottom" as const,
        direction: "row" as const,
        translateY: xLabel ? 56 : 44,
        itemWidth: 100,
        itemHeight: 20,
        itemsSpacing: 4,
        toggleSerie: true,
      },
    ];
  }, [showLegend, xLabel]);

  const margin = useMemo(() => {
    const base = {
      top: 8,
      right: 16,
      bottom: xLabel ? 46 : 30,
      left: yLabel ? 54 : 42,
    };
    if (showLegend) base.bottom += 32;
    return base;
  }, [xLabel, yLabel, showLegend]);

  const svgTransform = `translate(${zoom.translateX},${zoom.translateY}) scale(${zoom.scale})`;

  return (
    <div style={{ height }} className="relative">
      <div className="absolute top-0 right-0 z-10 flex items-center gap-0.5">
        {isZoomed && (
          <button
            type="button"
            onClick={resetZoom}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Reset zoom"
            data-testid="chart-zoom-reset"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={handleExport}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Export CSV"
          data-testid="chart-export-csv"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          cursor: isPanning.current ? "grabbing" : "grab",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: svgTransform,
            transformOrigin: "center center",
          }}
        >
          <ResponsiveLine
            data={data}
            theme={theme}
            colors={colors}
            margin={margin}
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
            markers={markers.length > 0 ? markers : undefined}
            legends={legends}
            animate
            motionConfig="gentle"
          />
        </div>
      </div>
    </div>
  );
}
