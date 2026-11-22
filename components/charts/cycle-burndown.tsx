"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ChartFrame } from "./chart-frame";
import { plural, useToday } from "./format";
import { StepLine } from "./step-line";

/** Remaining issues per day against the straight line to zero at the cycle's end. */
export function CycleBurndown({ cycleId }: { cycleId: Id<"cycles"> }) {
  const today = useToday();
  const data = useQuery(api.insights.cycle, { cycleId, now: today });
  const loading = data === undefined;
  const actual = (data?.points ?? []).filter((point) => point.remaining !== null);
  const latest = actual.at(-1);
  const remaining = latest?.remaining ?? 0;
  const gap = latest === undefined ? 0 : Math.round(remaining - latest.ideal);

  return (
    <div className="border-b border-rule px-3 py-6 @3xl/main:px-6">
      <ChartFrame
        title="Burndown"
        figure={loading ? undefined : remaining}
        figureLabel="remaining"
        loading={loading}
        empty={(data?.total ?? 0) === 0}
        emptyText="No issues in this cycle"
        summary={`${plural(remaining, "issue")} remaining of ${data?.total ?? 0}. ${
          gap > 0 ? `${gap} behind the ideal line.` : gap < 0 ? `${-gap} ahead of the ideal line.` : "On the ideal line."
        }`}
        footnote={
          <>
            Issues created before the cycle count from its first day; unfinished issues move to the next cycle when it ends.
            {data?.truncated ? " Based on the first 2,000 issues." : ""}
          </>
        }
      >
        <StepLine
          data={data?.points ?? []}
          today={today}
          className="h-44 @3xl/main:h-52"
          series={[
            { key: "remaining", label: "Remaining", tone: "ink" },
            { key: "ideal", label: "Ideal", tone: "guide" },
          ]}
        />
      </ChartFrame>
    </div>
  );
}
