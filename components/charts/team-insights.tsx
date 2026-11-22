"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AssigneeAvatar } from "@/components/issues/assignee-avatar";
import { displayName, useWorkspaceLookups } from "@/components/issues/lookups";
import { BarList } from "./bar-list";
import { BarSeries } from "./bar-series";
import { ChartFrame, ChartGrid, FigureStrip } from "./chart-frame";
import { plural, shortDate, useToday } from "./format";
import { StateBar } from "./state-bar";

const TRUNCATED = "Based on the latest 2,000 issues in each series.";

function days(value: number | null): string {
  if (value === null) return "—";
  return value < 1 ? "<1" : String(Math.round(value));
}

/** A team's work as charts: throughput, intake, where open work sits, and how long work takes. */
export function TeamInsights({ teamId }: { teamId: Id<"teams"> }) {
  const today = useToday();
  const data = useQuery(api.insights.team, { teamId, now: today });
  const { memberById } = useWorkspaceLookups();
  const loading = data === undefined;

  const weeks = data?.weeks ?? [];
  const done12 = weeks.reduce((sum, week) => sum + week.completed, 0);
  const created12 = weeks.reduce((sum, week) => sum + week.created, 0);
  const thisWeek = weeks.at(-1)?.completed ?? 0;
  const open = (data?.openByState ?? []).reduce((sum, row) => sum + row.count, 0);
  const best = weeks.reduce((top, week) => (week.completed > top.completed ? week : top), { start: 0, completed: 0, created: 0 });
  const footnote = data?.truncated ? TRUNCATED : undefined;

  return (
    <div className="flex flex-col pb-12">
      <FigureStrip
        items={[
          { label: "Done / 12 weeks", value: loading ? "—" : done12 },
          { label: "Done this week", value: loading ? "—" : thisWeek },
          { label: "Open", value: loading ? "—" : open },
          { label: "Median cycle time", value: loading ? "—" : days(data.cycleTime.medianDays), note: "days" },
        ]}
      />
      <ChartGrid>
        <ChartFrame
          title="Throughput"
          figure={loading ? undefined : (done12 / 12).toFixed(1)}
          figureLabel="avg / week"
          loading={loading}
          empty={done12 === 0}
          emptyText="Nothing completed in the last 12 weeks"
          summary={`${plural(done12, "issue")} completed in the last 12 weeks${best.completed > 0 ? `, most in the week of ${shortDate(best.start)} (${best.completed})` : ""}.`}
          footnote={footnote}
        >
          <BarSeries data={weeks} x="start" keys={[{ key: "completed", label: "Done" }]} />
        </ChartFrame>

        <ChartFrame
          title="Created vs done"
          figure={loading ? undefined : `${created12 - done12 > 0 ? "+" : ""}${created12 - done12}`}
          figureLabel="net / 12w"
          loading={loading}
          empty={done12 === 0 && created12 === 0}
          emptyText="No issues created or completed in the last 12 weeks"
          summary={`${plural(created12, "issue")} created and ${done12} completed in the last 12 weeks.`}
          footnote={footnote}
        >
          <BarSeries
            data={weeks}
            x="start"
            keys={[
              { key: "created", label: "Created", tone: "trace" },
              { key: "completed", label: "Done" },
            ]}
          />
        </ChartFrame>

        <ChartFrame
          title="Open work by state"
          loading={loading}
          summary={`${plural(open, "open issue")}: ${(data?.openByState ?? []).map((row) => `${row.name} ${row.count}`).join(", ")}.`}
        >
          <StateBar
            slices={(data?.openByState ?? []).map((row) => ({ key: row.stateId, label: row.name, type: row.type, count: row.count }))}
          />
        </ChartFrame>

        <ChartFrame
          title="Open work by assignee"
          loading={loading}
          empty={open === 0}
          emptyText="No open issues"
          summary={`Open issues by assignee: ${(data?.openByAssignee ?? [])
            .map((row) => `${row.assigneeId === null ? "Unassigned" : displayName(memberById.get(row.assigneeId))} ${row.count}`)
            .join(", ")}.`}
        >
          <BarList
            rows={[
              ...(data?.openByAssignee ?? []).map((row) => {
                const member = row.assigneeId === null ? null : memberById.get(row.assigneeId);
                return {
                  key: row.assigneeId ?? "none",
                  count: row.count,
                  label: (
                    <>
                      <AssigneeAvatar member={member} size={18} />
                      <span className={`truncate ${member === null ? "text-muted-foreground" : ""}`}>
                        {member === null ? "Unassigned" : displayName(member)}
                      </span>
                    </>
                  ),
                };
              }),
              ...(data !== undefined && data.otherAssignees > 0
                ? [{ key: "others", count: data.otherAssignees, label: <span className="truncate text-muted-foreground">Everyone else</span> }]
                : []),
            ]}
          />
        </ChartFrame>

        <ChartFrame
          title="Cycle time"
          figure={loading ? undefined : days(data.cycleTime.p75Days)}
          figureLabel="p75 days"
          loading={loading}
          empty={(data?.cycleTime.sample ?? 0) === 0}
          emptyText="No completed issues to measure yet"
          summary={`Time from creation to completion for ${plural(data?.cycleTime.sample ?? 0, "issue")} completed in the last 12 weeks: median ${days(data?.cycleTime.medianDays ?? null)} days.`}
          footnote="Creation to completion, issues completed in the last 12 weeks."
        >
          <BarList rows={(data?.cycleTime.buckets ?? []).map((bucket) => ({ key: bucket.label, count: bucket.count, label: <span className="data text-[12px] uppercase">{bucket.label}</span> }))} />
        </ChartFrame>
      </ChartGrid>
    </div>
  );
}
