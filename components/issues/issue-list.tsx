"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { IssueRow } from "./issue-row";

const PAGE_SIZE = 100;

/**
 * A team's issues grouped by workflow state in the team's state order, each
 * group headed by its name and live count on a state-coloured rule.
 */
export function IssueList({
  teamId,
  states,
  orgSlug,
}: {
  teamId: Id<"teams">;
  states: Doc<"workflowStates">[];
  orgSlug: string;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.issues.listByTeam,
    { teamId },
    { initialNumItems: PAGE_SIZE },
  );

  if (status === "LoadingFirstPage") {
    return <PageSkeleton />;
  }
  if (results.length === 0) {
    return (
      <div className="px-8 py-6">
        <EmptyState title="No issues yet">
          Create the first issue with <kbd className="font-semibold">C</kbd> or the New issue button.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="pb-12">
      {states.map((state) => {
        const issues = results.filter((issue) => issue.stateId === state._id);
        if (issues.length === 0) return null;
        return (
          <section key={state._id} aria-labelledby={`state-${state._id}`} className="mt-6">
            <h2
              id={`state-${state._id}`}
              className="mx-8 flex items-baseline justify-between border-b-2 pb-1 text-[13px] font-semibold"
              style={{ borderColor: `var(--state-${state.type})` }}
            >
              {state.name}
              <span className="text-xs font-normal text-muted-foreground tabular-nums">{issues.length}</span>
            </h2>
            <ul className="divide-y divide-border">
              {issues.map((issue) => (
                <li key={issue._id}>
                  <IssueRow issue={issue} orgSlug={orgSlug} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {status === "CanLoadMore" && (
        <div className="px-8 pt-6">
          <Button variant="outline" onClick={() => loadMore(PAGE_SIZE)}>
            Load more issues
          </Button>
        </div>
      )}
      {status === "LoadingMore" && (
        <p className="px-8 pt-6 text-xs text-muted-foreground">Loading more…</p>
      )}
    </div>
  );
}
