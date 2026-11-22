"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ChartFrame, ChartGrid } from "./chart-frame";
import { plural, shortDate, useToday } from "./format";
import { StateBar } from "./state-bar";
import { StepLine } from "./step-line";

const STATE_ROWS = [
  { type: "backlog", label: "Backlog" },
  { type: "unstarted", label: "Not started" },
  { type: "started", label: "In progress" },
  { type: "completed", label: "Done" },
  { type: "canceled", label: "Canceled" },
] as const;

/** A project's burn-up (done against scope, with a pace line to the target) and where its issues sit. */
export function ProjectCharts({ projectId }: { projectId: Id<"projects"> }) {
  const today = useToday();
  const data = useQuery(api.insights.project, { projectId, now: today });
  const loading = data === undefined;
  const actual = (data?.points ?? []).filter((point) => point.scope !== null);
  const latest = actual.at(-1);
  const scope = latest?.scope ?? 0;
  const done = latest?.done ?? 0;
  const pace = data?.points.find((point) => point.t === latest?.t)?.pace ?? null;
  const percent = scope === 0 ? 0 : Math.round((done / scope) * 100);
  const hasPace = data?.targetDate !== null && data?.points.some((point) => point.pace !== null);
  const total = data === undefined ? 0 : Object.values(data.byState).reduce((sum, count) => sum + count, 0);

  let paceNote = "";
  if (pace !== null && scope > 0) {
    const gap = Math.round(done - pace);
    paceNote = gap >= 0 ? `On pace (${gap === 0 ? "even" : `${gap} ahead`}).` : `${-gap} behind pace.`;
  }

  return (
    <ChartGrid>
      <ChartFrame
        title="Burn-up"
        figure={loading ? undefined : `${percent}%`}
        figureLabel={`${done}/${scope} done`}
        loading={loading}
        height="h-48 @3xl/main:h-56"
        empty={scope === 0}
        emptyText="No issues in this project yet"
        summary={`${done} of ${plural(scope, "issue")} done (${percent}%).${data?.targetDate ? ` Target ${shortDate(data.targetDate)}.` : ""} ${paceNote}`}
        footnote={
          <>
            Scope counts each issue from its creation date; canceled issues leave it.
            {data?.truncated ? " Based on the first 2,000 issues." : ""}
          </>
        }
      >
        <StepLine
          data={data?.points ?? []}
          today={today}
          series={[
            { key: "scope", label: "Scope", tone: "muted" },
            { key: "done", label: "Done", tone: "ink" },
            ...(hasPace ? [{ key: "pace", label: "On pace", tone: "guide" as const }] : []),
          ]}
        />
      </ChartFrame>

      <ChartFrame
        title="Issues by state"
        figure={loading || data.estimate.total === 0 ? undefined : `${data.estimate.done}/${data.estimate.total}p`}
        figureLabel="points"
        loading={loading}
        summary={`${plural(total, "issue")}: ${STATE_ROWS.map((row) => `${row.label} ${data?.byState[row.type] ?? 0}`).join(", ")}.`}
      >
        <StateBar
          slices={STATE_ROWS.map((row) => ({ key: row.type, label: row.label, type: row.type, count: data?.byState[row.type] ?? 0 }))}
        />
      </ChartFrame>
    </ChartGrid>
  );
}
