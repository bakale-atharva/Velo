"use client";

import { CirclePlus } from "lucide-react";
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
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[14px] px-3 py-3 hover:bg-tile focus-visible:bg-tile focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_220px_130px]"
    >
      <span className="truncate text-[15px] font-medium">{cycle.name}</span>
      <span className="text-[13px] text-muted-foreground tabular-nums">{cycleRange(cycle)}</span>
      <span className="hidden text-right text-[13px] tabular-nums sm:block">
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
          <Button size="lg" className="h-11 px-5 text-[15px]" onClick={() => setCreating(true)}>
            <CirclePlus aria-hidden />
            New cycle
          </Button>
        }
      />
      <CycleDialog team={team} cycles={cycles} open={creating} onOpenChange={setCreating} />

      {cycles.length === 0 ? (
        <div className="px-3 pt-8 md:px-6">
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
                <div className="px-3 pt-2 pb-3">
                  <StateHeading
                    id={`cycles-${section.status}`}
                    name={section.title}
                    count={inSection.length}
                    color={
                      section.status === "active"
                        ? "var(--state-started)"
                        : section.status === "upcoming"
                          ? "var(--state-unstarted)"
                          : "var(--state-completed)"
                    }
                  />
                </div>
                <ul className="flex flex-col gap-0.5">
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
