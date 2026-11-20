"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { Suspense, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { cycleRange, daysLeft } from "@/components/cycles/cycle-dates";
import { CycleDialog } from "@/components/cycles/cycle-dialog";
import { GROUP_PANEL } from "@/components/issues/issue-list";
import { ROW_MUTED, TABLE_ROW } from "@/components/states/table-styles";
import { StateHeading } from "@/components/issues/state-heading";
import { TeamPageHeader, teamNav } from "@/components/issues/team-page-header";
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
      className={`${TABLE_ROW} grid h-11 grid-cols-[minmax(0,1fr)_auto] gap-4 @xl/main:grid-cols-[minmax(0,1fr)_220px_130px]`}
    >
      <span className="truncate text-[14px] font-medium">{cycle.name}</span>
      <span className={`data text-[12px] uppercase ${ROW_MUTED}`}>{cycleRange(cycle)}</span>
      <span className="data hidden text-right text-[12px] uppercase @xl/main:block">
        {cycle.status === "active" && `${left} ${left === 1 ? "day" : "days"} left`}
        {cycle.status === "upcoming" &&
          `in ${Math.max(1, Math.ceil((cycle.startsAt - now) / 86_400_000))} days`}
      </span>
    </Link>
  );
}

function TeamCycles() {
  const pathname = usePathname();
  const { orgSlug, teamKey, team } = useTeamFromUrl();
  const cycles = useQuery(api.cycles.list, team ? { teamId: team._id } : "skip");
  const [creating, setCreating] = useState(false);
  // Read once per mount; the rollover cron moves statuses, not this page.
  const [now] = useState(() => Date.now());

  if (team === undefined || cycles === undefined) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <TeamPageHeader
        title={team.name}
        subtitle={team.key}
        nav={teamNav(orgSlug, teamKey, pathname)}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            New cycle
          </Button>
        }
      />
      <CycleDialog team={team} cycles={cycles} open={creating} onOpenChange={setCreating} />

      {cycles.length === 0 ? (
        <div className="px-3 pt-8 @3xl/main:px-6">
          <EmptyState
            title="No cycles yet"
            action={<Button onClick={() => setCreating(true)}>New cycle</Button>}
          >
            A cycle is a fixed stretch of time, usually two weeks, that the team commits issues to.
          </EmptyState>
        </div>
      ) : (
        <div className="pt-8 pb-12">
          {SECTIONS.map((section) => {
            const inSection = cycles
              .filter((cycle) => cycle.status === section.status)
              // Upcoming reads soonest first; the rest newest first.
              .sort((a, b) =>
                section.status === "upcoming" ? a.startsAt - b.startsAt : b.startsAt - a.startsAt,
              );
            if (inSection.length === 0) return null;
            return (
              <section key={section.status} aria-labelledby={`cycles-${section.status}`} className={GROUP_PANEL}>
                <div className="px-3 pt-5 pb-2 @3xl/main:px-6">
                  <StateHeading
                    id={`cycles-${section.status}`}
                    name={section.title}
                    count={inSection.length}
                    type={
                      section.status === "active"
                        ? "started"
                        : section.status === "upcoming"
                          ? "unstarted"
                          : "completed"
                    }
                  />
                </div>
                <ul className="flex flex-col pb-2">
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
