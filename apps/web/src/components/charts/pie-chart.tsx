"use client";

import { ResponsivePie } from "@nivo/pie";
import type { MayHaveLabel } from "@nivo/pie";
import { useNivoTheme } from "./nivo-theme";

interface PieDatum extends MayHaveLabel {
  id: string | number;
  value: number;
  [key: string]: unknown;
}

interface PieChartProps {
  data: PieDatum[];
  innerRadius?: number;
  enableArcLabels?: boolean;
  height?: number;
}

export function PieChart({
  data,
  innerRadius = 0.6,
  enableArcLabels = true,
  height = 300,
}: PieChartProps) {
  const { theme, colors } = useNivoTheme();

  return (
    <div style={{ height }}>
      <ResponsivePie
        data={data}
        theme={theme}
        colors={colors}
        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        innerRadius={innerRadius}
        padAngle={1}
        cornerRadius={3}
        activeOuterRadiusOffset={4}
        enableArcLabels={enableArcLabels}
        arcLabelsSkipAngle={10}
        arcLabelsTextColor={{ from: "color", modifiers: [["darker", 2]] }}
        arcLinkLabelsSkipAngle={10}
        arcLinkLabelsTextColor={{ theme: "text.fill" }}
        arcLinkLabelsThickness={1}
        arcLinkLabelsColor={{ from: "color" }}
        animate
        motionConfig="gentle"
      />
    </div>
  );
}
