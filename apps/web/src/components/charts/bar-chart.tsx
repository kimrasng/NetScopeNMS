"use client";

import { ResponsiveBar } from "@nivo/bar";
import type { BarDatum } from "@nivo/bar";
import { useNivoTheme } from "./nivo-theme";

interface BarChartProps {
  data: BarDatum[];
  keys: string[];
  indexBy: string;
  layout?: "horizontal" | "vertical";
  height?: number;
}

export function BarChart({
  data,
  keys,
  indexBy,
  layout = "vertical",
  height = 300,
}: BarChartProps) {
  const { theme, colors } = useNivoTheme();

  return (
    <div style={{ height }}>
      <ResponsiveBar
        data={data}
        theme={theme}
        colors={colors}
        keys={keys}
        indexBy={indexBy}
        layout={layout}
        margin={{
          top: 8,
          right: 16,
          bottom: layout === "horizontal" ? 30 : 40,
          left: layout === "horizontal" ? 80 : 42,
        }}
        padding={0.3}
        valueScale={{ type: "linear" }}
        indexScale={{ type: "band", round: true }}
        borderRadius={3}
        enableGridX={layout === "horizontal"}
        enableGridY={layout === "vertical"}
        axisTop={null}
        axisRight={null}
        axisBottom={{ tickSize: 0, tickPadding: 8 }}
        axisLeft={{ tickSize: 0, tickPadding: 8 }}
        labelSkipWidth={12}
        labelSkipHeight={12}
        labelTextColor={{ from: "color", modifiers: [["darker", 2]] }}
        animate
        motionConfig="gentle"
      />
    </div>
  );
}
