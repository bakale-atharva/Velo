"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { Suspense, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { cycleRange, daysLeft } from "@/components/cycles/cycle-dates";
import { CycleDialog } from "@/components/cycles/cycle-dialog";
import { TeamPageHeader } from "@/components/issues/team-page-header";
import { useTeamFromUrl } from "@/components/issues/use-team";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";

const SECTIONS: { status: Doc<"cycles">["status"]; title: string }[] = [
  { status: "active", title: "Active" },
  { status: "upcoming", title: "Upcoming" },
  { status: "completed", title: "Completed" },
];

function CycleRow({
  cycle,
  href,
  now,
}: {
  cycle: Doc<"cycles">;
  href: string;
  now: number;
}) {
  const left = daysLeft(cycle, now);
  return (
    <Link
      href={href}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 px-8 py-3 hover:bg-card focus-visible:bg-card focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_200px_120px]"
    >
      <span className="truncate text-[13px] font-medium">{cycle.name}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{cycleRange(cycle)}</span>
      <span className="hidden text-right text-xs tabular-nums sm:block">
        {cycle.status === "active" && `${left} ${left === 1 ? "day" : "days"} left`}
        {cycle.status === "upcoming" &&
          `in ${Math.max(1, Math.ceil((cycle.startsAt - now) / 86_400_000))} days`}
      </span>
    </Link>
  );
}

function TeamCycles() {
  const { orgSlug, teamKey, team } = useTeamFromUrl();
  const cycles = useQuery(api.cycles.list, team ? { teamId: team._id } : "skip");
  const [creating, setCreating] = useState(false);
  // Read once per mount; the rollover cron moves statuses, not this page.
  const [now] = useState(() => Date.now());

  if (team === undefined || cycles === undefined) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex min-h-svh flex-col">
      <TeamPageHeader
        title={team.name}
        subtitle="Cycles"
        actions={<Button onClick={() => setCreating(true)}>New cycle</Button>}
      />
      <CycleDialog team={team} cycles={cycles} open={creating} onOpenChange={setCreating} />

      {cycles.length === 0 ? (
        <div className="px-8 py-6">
          <EmptyState
            title="No cycles yet"
            action={<Button onClick={() => setCreating(true)}>New cycle</Button>}
          >
            A cycle is a fixed stretch of time, usually two weeks, that the team commits issues to.
          </EmptyState>
        </div>
      ) : (
        <div className="pb-12">
          {SECTIONS.map((section) => {
            const inSection = cycles
              .filter((cycle) => cycle.status === section.status)
              // Upcoming reads soonest first; the rest newest first.
              .sort((a, b) =>
                section.status === "upcoming" ? a.startsAt - b.startsAt : b.startsAt - a.startsAt,
              );
            if (inSection.length === 0) return null;
            return (
              <section key={section.status} aria-labelledby={`cycles-${section.status}`} className="mt-6">
                <h2
                  id={`cycles-${section.status}`}
                  className="mx-8 flex items-baseline justify-between border-b-2 pb-1 text-[13px] font-semibold"
                  style={{
                    borderColor:
                      section.status === "active" ? "var(--state-started)" : "var(--rule)",
                  }}
                >
                  {section.title}
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {inSection.length}
                  </span>
                </h2>
                <ul className="divide-y divide-border">
                  {inSection.map((cycle) => (
                    <li key={cycle._id}>
                      <CycleRow
                        cycle={cycle}
                        now={now}
                        href={`/${orgSlug}/team/${teamKey}/cycles/${cycle.number}`}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TeamCyclesPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <TeamCycles />
      </Suspense>
    </ErrorBoundary>
  );
}
