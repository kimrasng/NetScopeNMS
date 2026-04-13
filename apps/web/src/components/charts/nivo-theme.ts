"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import type { PartialTheme } from "@nivo/theming";

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return raw ? `hsl(${raw})` : fallback;
}

export function getChartColors(): string[] {
  return [
    cssVar("--chart-1", "hsl(217 91% 60%)"),
    cssVar("--chart-2", "hsl(160 84% 39%)"),
    cssVar("--chart-3", "hsl(38 92% 50%)"),
    cssVar("--chart-4", "hsl(280 68% 60%)"),
    cssVar("--chart-5", "hsl(349 89% 60%)"),
  ];
}

function buildTheme(mode: "dark" | "light"): PartialTheme {
  const fg = cssVar("--foreground", mode === "dark" ? "hsl(213 31% 91%)" : "hsl(222 47% 11%)");
  const muted = cssVar("--muted-foreground", mode === "dark" ? "hsl(215 20% 50%)" : "hsl(215 16% 47%)");
  const border = cssVar("--border", mode === "dark" ? "hsl(222 47% 16%)" : "hsl(214 32% 87%)");
  const card = cssVar("--card", mode === "dark" ? "hsl(222 47% 9%)" : "hsl(0 0% 100%)");

  const textStyle = { fill: muted, fontSize: 11 } as const;

  return {
    background: "transparent",
    text: { fill: fg, fontSize: 12 },
    axis: {
      domain: { line: { stroke: border, strokeWidth: 1 } },
      ticks: {
        line: { stroke: border, strokeWidth: 1 },
        text: textStyle,
      },
      legend: { text: { fill: fg, fontSize: 12, fontWeight: 600 } },
    },
    grid: { line: { stroke: border, strokeWidth: 1 } },
    crosshair: {
      line: { stroke: muted, strokeWidth: 1, strokeOpacity: 0.5, strokeDasharray: "4 4" },
    },
    legends: {
      text: textStyle,
      title: { text: { fill: fg, fontSize: 12 } },
    },
    labels: { text: { fill: fg, fontSize: 11 } },
    dots: { text: { fill: fg, fontSize: 11 } },
    tooltip: {
      container: {
        background: card,
        color: fg,
        fontSize: 12,
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        border: `1px solid ${border}`,
      },
    },
    annotations: {
      text: { fill: fg, fontSize: 13, outlineWidth: 2, outlineColor: card },
      link: { stroke: fg, strokeWidth: 1, outlineWidth: 2, outlineColor: card },
      outline: { stroke: fg, strokeWidth: 2, outlineWidth: 2, outlineColor: card },
      symbol: { fill: fg, outlineWidth: 2, outlineColor: card },
    },
  };
}

export function useNivoTheme() {
  const { resolvedTheme } = useTheme();
  const mode = (resolvedTheme === "light" ? "light" : "dark") as "dark" | "light";

  const theme = useMemo(() => buildTheme(mode), [mode]);
  const colors = useMemo(() => getChartColors(), [mode]);

  return { theme, colors } as const;
}
