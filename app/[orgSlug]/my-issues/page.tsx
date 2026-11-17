"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { IssueRow } from "@/components/issues/issue-row";
import { TeamPageHeader } from "@/components/issues/team-page-header";

type StateType = Doc<"issues">["stateType"];

// Same order `issues.listMine` sorts by: work in hand first.
const GROUPS: { type: StateType; name: string }[] = [
  { type: "started", name: "In progress" },
  { type: "unstarted", name: "Todo" },
  { type: "backlog", name: "Backlog" },
  { type: "completed", name: "Done" },
  { type: "canceled", name: "Canceled" },
];

function MyIssues() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const issues = useQuery(api.issues.listMine);

  if (issues === undefined) {
    return <PageSkeleton />;
  }

  const open = issues.filter(
    (issue) => issue.stateType !== "completed" && issue.stateType !== "canceled",
  ).length;

  return (
    <div className="flex min-h-svh flex-col">
      <TeamPageHeader
        title="My issues"
        subtitle={issues.length === 0 ? undefined : `${open} open`}
      />
      {issues.length === 0 ? (
        <div className="px-8 py-6">
          <EmptyState title="Nothing assigned to you">
            Issues you are assigned to in any team show up here.
          </EmptyState>
        </div>
      ) : (
        <div className="pb-12">
          {GROUPS.map((group) => {
            const inGroup = issues.filter((issue) => issue.stateType === group.type);
            if (inGroup.length === 0) return null;
            return (
              <section key={group.type} aria-labelledby={`group-${group.type}`} className="mt-6">
                <h2
                  id={`group-${group.type}`}
                  className="mx-8 flex items-baseline justify-between border-b-2 pb-1 text-[13px] font-semibold"
                  style={{ borderColor: `var(--state-${group.type})` }}
                >
                  {group.name}
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {inGroup.length}
                  </span>
                </h2>
                <ul className="divide-y divide-border">
                  {inGroup.map((issue) => (
                    <li key={issue._id}>
                      <IssueRow issue={issue} orgSlug={orgSlug} />
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

export default function MyIssuesPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <MyIssues />
      </Suspense>
    </ErrorBoundary>
  );
}
