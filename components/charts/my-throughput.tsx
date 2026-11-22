"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BarSeries } from "./bar-series";
import { ChartFrame } from "./chart-frame";
import { plural, useToday } from "./format";

/** The caller's completed issues per week, last 8 weeks, as a compact band under the header. */
export function MyThroughput() {
  const today = useToday();
  const data = useQuery(api.insights.mine, { now: today });
  const weeks = data?.weeks ?? [];
  const total = weeks.reduce((sum, week) => sum + week.completed, 0);
  const thisWeek = weeks.at(-1)?.completed ?? 0;
  return (
    <div className="px-3 @3xl/main:px-6">
      <ChartFrame
        title="You completed"
        figure={data === undefined ? undefined : thisWeek}
        figureLabel="this week"
        loading={data === undefined}
        height="h-28 @3xl/main:h-32"
        empty={total === 0}
        emptyText="Nothing completed in the last 8 weeks"
        summary={`You completed ${plural(total, "issue")} in the last 8 weeks, ${thisWeek} this week.`}
      >
        <BarSeries data={weeks} x="start" keys={[{ key: "completed", label: "Done" }]} className="h-28 @3xl/main:h-32" />
      </ChartFrame>
    </div>
  );
}
