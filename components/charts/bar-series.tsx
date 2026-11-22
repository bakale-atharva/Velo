"use client";

import { useReducedMotion } from "motion/react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { shortDate } from "./format";

export type BarSeriesKey = {
  key: string;
  label: string;
  /** "ink" draws solid foreground; "trace" draws foreground at 35%. */
  tone?: "ink" | "trace";
};

/**
 * Bars over time in the Datamatics voice: square ink bars, a hairline
 * baseline and grid, mono date ticks that thin out on narrow widths, and an
 * inverted tooltip. `x` holds bucket start times (ms).
 */
export function BarSeries({
  data,
  x,
  keys,
  className = "h-40 @3xl/main:h-48",
}: {
  data: Record<string, number>[];
  x: string;
  keys: BarSeriesKey[];
  className?: string;
}) {
  const reduce = useReducedMotion();
  const config: ChartConfig = Object.fromEntries(
    keys.map((k) => [k.key, { label: k.label, color: "var(--foreground)" }]),
  );
  return (
    <ChartContainer config={config} className={`w-full ${className}`}>
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="22%" barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis
          dataKey={x}
          tickFormatter={(value: number) => shortDate(value)}
          tickLine={false}
          axisLine={{ stroke: "var(--rule)" }}
          tickMargin={8}
          minTickGap={28}
          interval="preserveStartEnd"
        />
        <YAxis width={28} tickLine={false} axisLine={false} allowDecimals={false} tickCount={3} tickMargin={4} />
        <ChartTooltip
          cursor={{ fill: "var(--tile)" }}
          content={<ChartTooltipContent indicator="dot" labelFormatter={(_, payload) => shortDate(Number(payload[0]?.payload?.[x]))} />}
        />
        {keys.map((k) => (
          <Bar
            key={k.key}
            dataKey={k.key}
            fill={`var(--color-${k.key})`}
            fillOpacity={k.tone === "trace" ? 0.35 : 1}
            radius={0}
            maxBarSize={28}
            isAnimationActive={!reduce}
            animationDuration={200}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
