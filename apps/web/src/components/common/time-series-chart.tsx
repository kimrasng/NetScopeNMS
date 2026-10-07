"use client";

import LineChart from "@cloudscape-design/components/line-chart";
import Box from "@cloudscape-design/components/box";
import { useI18n } from "@/lib/i18n";

export function metricUnit(metric: string): string {
  return metric === "cpu" || metric === "memory" ? "%" : metric.startsWith("bandwidth") ? "bps" : metric === "latency" ? "ms" : "";
}
export function formatMetric(value: number, unit: string): string {
  if (unit === "bps") {
    for (const [scale, label] of [[1e9, "Gbps"], [1e6, "Mbps"], [1e3, "Kbps"]] as const) {
      if (Math.abs(value) >= scale) return `${(value / scale).toFixed(1)} ${label}`;
    }
  }
  return `${Number(value.toFixed(2)).toLocaleString()}${unit ? ` ${unit}` : ""}`;
}
export function TimeSeriesChart({ series, unit, title, loading = false, height = 280 }: {
  series: { title: string; points: { time: string; value: number }[] }[];
  unit: string; title: string; loading?: boolean; height?: number;
}) {
  const { t, locale } = useI18n();
  const dates = series.flatMap(line => line.points.map(point => new Date(point.time).getTime())).filter(Number.isFinite);
  const minimum = Math.min(...dates), maximum = Math.max(...dates);
  return <LineChart<Date>
    ariaLabel={title}
    series={series.map(line => ({ type: "line", title: line.title, data: line.points.filter(point => Number.isFinite(point.value) && Number.isFinite(new Date(point.time).getTime())).map(point => ({ x: new Date(point.time), y: point.value })), valueFormatter: value => formatMetric(value, unit) }))}
    xScaleType="time"
    xDomain={dates.length ? [new Date(minimum), new Date(maximum === minimum ? maximum + 60000 : maximum)] : undefined}
    xTitle={t("Time")}
    yTitle={unit || t("Value")}
    height={height}
    statusType={loading ? "loading" : "finished"}
    hideFilter
    i18nStrings={{ xTickFormatter: date => date.toLocaleString(locale, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }), yTickFormatter: value => formatMetric(value, unit) }}
    empty={<Box textAlign="center" padding="l">{t("No metric samples")}</Box>}
    noMatch={<Box textAlign="center" padding="l">{t("No matching series")}</Box>}
  />;
}
