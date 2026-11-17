"use client";

import { useParams } from "next/navigation";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { cycleRange, daysLeft } from "@/components/cycles/cycle-dates";
import { CycleDialog } from "@/components/cycles/cycle-dialog";
import { Board } from "@/components/issues/issue-board";
import { IssueGroups } from "@/components/issues/issue-groups";
import { TeamPageHeader } from "@/components/issues/team-page-header";
import { useTeamFromUrl } from "@/components/issues/use-team";
import { useIssueView, ViewToggle } from "@/components/issues/view-toggle";
import { Progress } from "@/components/projects/progress";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { errorMessage } from "@/lib/errors";

const PAGE_SIZE = 200;

const STATUS_LABEL: Record<Doc<"cycles">["status"], string> = {
  active: "Active",
  upcoming: "Upcoming",
  completed: "Completed",
};

/** A large number under its label. */
function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid gap-1">
      <dd className="text-[32px] leading-9 font-semibold tracking-[-0.02em] tabular-nums">{value}</dd>
      <dt className="order-first text-[13px] text-muted-foreground">{label}</dt>
    </div>
  );
}

function CycleIssues({
  cycle,
  states,
  orgSlug,
  view,
}: {
  cycle: Doc<"cycles">;
  states: Doc<"workflowStates">[];
  orgSlug: string;
  view: "list" | "board";
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.cycles.listIssues,
    { cycleId: cycle._id },
    { initialNumItems: PAGE_SIZE },
  );
  const move = useMutation(api.issues.move);
  if (status === "LoadingFirstPage") {
    return <PageSkeleton rows={5} />;
  }

  const done = results.filter((issue) => issue.stateType === "completed").length;
  const points = results.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0);
  const donePoints = results
    .filter((issue) => issue.stateType === "completed")
    .reduce((sum, issue) => sum + (issue.estimate ?? 0), 0);
  const more = status === "CanLoadMore" || status === "LoadingMore";

  const columns = states.map((state) => ({
    stateId: state._id,
    issues: results
      .filter((issue) => issue.stateId === state._id)
      .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0)),
  }));

  return (
    <>
      <dl className="panel mx-3 mt-8 mb-6 grid grid-cols-2 gap-x-10 gap-y-5 p-6 md:mx-6 sm:grid-cols-[auto_auto_auto_minmax(200px,1fr)]">
        <Figure label="Scope" value={`${results.length}${more ? "+" : ""}`} />
        <Figure label="Completed" value={done} />
        <Figure label="Points" value={points === 0 ? "—" : `${donePoints}/${points}`} />
        <div className="col-span-2 grid content-end gap-1 sm:col-span-1">
          <dt className="text-[13px] text-muted-foreground">Progress</dt>
          <dd>
            <Progress completed={done} total={results.length} />
          </dd>
        </div>
      </dl>

      {results.length === 0 ? (
        <div className="px-3 md:px-6">
          <EmptyState title="No issues in this cycle">
            Add issues by setting their Cycle in the issue’s properties.
          </EmptyState>
        </div>
      ) : view === "board" ? (
        <Board
          columns={columns}
          states={states}
          orgSlug={orgSlug}
          onMove={(args) =>
            move(args).catch((error: unknown) => toast.error(errorMessage(error)))
          }
        />
      ) : (
        <div className="pb-12">
          <IssueGroups issues={results} orgSlug={orgSlug} />
        </div>
      )}
      {more && (
        <div className="px-3 pt-2 pb-8 md:px-6">
          <Button
            variant="outline"
            disabled={status === "LoadingMore"}
            onClick={() => loadMore(PAGE_SIZE)}
          >
            {status === "LoadingMore" ? "Loading…" : "Load more issues"}
          </Button>
        </div>
      )}
    </>
  );
}

function CycleDetail() {
  const { number } = useParams<{ number: string }>();
  const { orgSlug, teamKey, team, states } = useTeamFromUrl();
  const cycleNumber = Number(number);
  const cycle = useQuery(
    api.cycles.get,
    team && Number.isInteger(cycleNumber) ? { teamId: team._id, number: cycleNumber } : "skip",
  );
  const cycles = useQuery(api.cycles.list, team ? { teamId: team._id } : "skip");
  const [view, setView] = useIssueView();
  const [editing, setEditing] = useState(false);
  const [now] = useState(() => Date.now());

  if (!Number.isInteger(cycleNumber)) {
    return (
      <div className="px-3 pt-8 md:px-6">
        <EmptyState title="No such cycle">Cycles are numbered 1, 2, 3 within a team.</EmptyState>
      </div>
    );
  }
  if (team === undefined || states === undefined || cycle === undefined || cycles === undefined) {
    return <PageSkeleton />;
  }

  const left = daysLeft(cycle, now);
  return (
    <div className="flex flex-1 flex-col">
      <TeamPageHeader
        back={{ href: `/${orgSlug}/team/${teamKey}/cycles`, label: `${team.name} cycles` }}
        title={cycle.name}
        subtitle={cycleRange(cycle)}
        actions={
          <>
            <ViewToggle view={view} onChange={setView} />
            {cycle.status !== "completed" && (
              <Button variant="outline" className="h-11 rounded-xl px-4" onClick={() => setEditing(true)}>
                Edit cycle
              </Button>
            )}
          </>
        }
      />
      <p className="px-3 pt-5 text-[14px] md:px-6">
        <span
          className="mr-2 inline-block size-2 rounded-full"
          style={{
            background: cycle.status === "active" ? "var(--state-started)" : "var(--state-backlog)",
          }}
          aria-hidden
        />
        {STATUS_LABEL[cycle.status]}
        {cycle.status === "active" && (
          <span className="text-muted-foreground tabular-nums">
            {" "}
            · {left} {left === 1 ? "day" : "days"} left
          </span>
        )}
      </p>
      {cycle.status !== "completed" && (
        <CycleDialog
          team={team}
          cycles={cycles}
          cycle={cycle}
          open={editing}
          onOpenChange={setEditing}
        />
      )}
      <CycleIssues cycle={cycle} states={states} orgSlug={orgSlug} view={view} />
    </div>
  );
}

export default function CyclePage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <CycleDetail />
      </Suspense>
    </ErrorBoundary>
  );
}
