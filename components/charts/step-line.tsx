"use client";

import { useReducedMotion } from "motion/react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { shortDate } from "./format";

export type StepLineSeries = {
  key: string;
  label: string;
  /** "ink" solid foreground, "muted" solid muted ink, "guide" dashed faint (pace and ideal lines). */
  tone: "ink" | "muted" | "guide";
};

const COLORS = { ink: "var(--foreground)", muted: "var(--muted-foreground)", guide: "var(--faint)" } as const;

/**
 * Step lines over time: actuals as hard steps (work lands in discrete issues,
 * so the line never interpolates), guides as dashed straight lines, a 1px
 * vertical rule at today, and an inverted tooltip. Null values end a line,
 * so actuals stop at today while guides run on to the target.
 */
export function StepLine<Row extends { t: number }>({
  data,
  series,
  today,
  className = "h-48 @3xl/main:h-56",
}: {
  data: Row[];
  series: StepLineSeries[];
  today?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: COLORS[s.tone] }]),
  );
  const showToday = today !== undefined && data.length > 1 && today > data[0].t && today < data[data.length - 1].t;
  return (
    <ChartContainer config={config} className={`w-full ${className}`}>
      <LineChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(value: number) => shortDate(value)}
          tickLine={false}
          axisLine={{ stroke: "var(--rule)" }}
          tickMargin={8}
          minTickGap={36}
        />
        <YAxis width={28} tickLine={false} axisLine={false} allowDecimals={false} tickCount={3} tickMargin={4} />
        {showToday && (
          <ReferenceLine
            x={today}
            stroke="var(--rule)"
            label={{ value: "TODAY", position: "insideTopLeft", fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
          />
        )}
        <ChartTooltip
          cursor={{ stroke: "var(--rule)" }}
          content={<ChartTooltipContent indicator="line" labelFormatter={(_, payload) => shortDate(Number(payload[0]?.payload?.t))} />}
        />
        <ChartLegend verticalAlign="top" align="left" content={<ChartLegendContent className="pb-4" />} />
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            type={s.tone === "guide" ? "linear" : "stepAfter"}
            stroke={`var(--color-${s.key})`}
            strokeWidth={s.tone === "ink" ? 1.5 : 1}
            strokeDasharray={s.tone === "guide" ? "3 3" : undefined}
            dot={false}
            activeDot={{ r: 2.5, strokeWidth: 0, fill: `var(--color-${s.key})` }}
            connectNulls={false}
            isAnimationActive={!reduce}
            animationDuration={200}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
