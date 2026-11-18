"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { IssueRow } from "./issue-row";
import { StateHeading } from "./state-heading";

/** A group of issue rows: full width, opened by a hairline rule. */
export const GROUP_PANEL = "border-t border-rule first:border-t-0";

const PAGE_SIZE = 100;

type Issue = Omit<Doc<"issues">, "searchText">;

/** Issues of one team in sections by workflow state, in the team's order. */
export function StateSections({
  states,
  issues,
  orgSlug,
}: {
  states: Doc<"workflowStates">[];
  issues: Issue[];
  orgSlug: string;
}) {
  return (
    <>
      {states.map((state) => {
        const inState = issues.filter((issue) => issue.stateId === state._id);
        if (inState.length === 0) return null;
        return (
          <section key={state._id} aria-labelledby={`state-${state._id}`} className={GROUP_PANEL}>
            <div className="px-3 pt-5 pb-2 md:px-6">
              <StateHeading id={`state-${state._id}`} name={state.name} count={inState.length} type={state.type} />
            </div>
            <ul className="flex flex-col pb-2">
              {inState.map((issue) => (
                <li key={issue._id}>
                  <IssueRow issue={issue} orgSlug={orgSlug} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

/**
 * A team's issues grouped by workflow state in the team's state order, each
 * group headed by its name, gauge and live count.
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
      <div className="px-3 md:px-6">
        <EmptyState title="No issues yet">
          Create the first issue with <kbd className="data font-medium">C</kbd> or the New issue button.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <StateSections states={states} issues={results} orgSlug={orgSlug} />
      {status === "CanLoadMore" && (
        <div className="px-3 pt-2 md:px-6">
          <Button variant="outline" onClick={() => loadMore(PAGE_SIZE)}>
            Load more issues
          </Button>
        </div>
      )}
      {status === "LoadingMore" && (
        <p className="data px-3 pt-2 text-[13px] text-muted-foreground md:px-6">Loading more…</p>
      )}
    </div>
  );
}
