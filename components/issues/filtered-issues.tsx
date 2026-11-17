"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { errorMessage } from "@/lib/errors";
import type { IssueFilter } from "./filters";
import { Board } from "./issue-board";
import { IssueGroups } from "./issue-groups";
import { StateSections } from "./issue-list";

const PAGE_SIZE = 100;
// Filtered pages can come back short (conditions apply after the index), so
// keep loading until the list has at least this many or the data runs out.
const FILL_TO = 30;

function byRank(a: { rank: string }, b: { rank: string }) {
  return a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0;
}

/**
 * Issues matching a filter from `api.issues.listFiltered`. With a team's
 * `states` they show in that team's state sections or as its board;
 * without, they are grouped by state type across teams.
 */
export function FilteredIssues({
  filter,
  orgSlug,
  states,
  view = "list",
  onClear,
}: {
  filter: IssueFilter;
  orgSlug: string;
  states?: Doc<"workflowStates">[];
  view?: "list" | "board";
  onClear?: () => void;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.issues.listFiltered,
    { filter },
    { initialNumItems: PAGE_SIZE },
  );
  const move = useMutation(api.issues.move);

  useEffect(() => {
    if (status === "CanLoadMore" && results.length < FILL_TO) {
      loadMore(PAGE_SIZE);
    }
  }, [status, results.length, loadMore]);

  if (status === "LoadingFirstPage") {
    return <PageSkeleton />;
  }
  if (results.length === 0 && status === "Exhausted") {
    return (
      <div className="px-8 py-6">
        <EmptyState
          title="No issues match"
          action={
            onClear === undefined ? undefined : (
              <Button variant="outline" onClick={onClear}>
                Clear filters
              </Button>
            )
          }
        >
          Loosen a filter to see more.
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      {states !== undefined && view === "board" ? (
        <Board
          columns={states.map((state) => ({
            stateId: state._id,
            issues: results.filter((issue) => issue.stateId === state._id).sort(byRank),
          }))}
          states={states}
          orgSlug={orgSlug}
          onMove={(args) => move(args).catch((error: unknown) => toast.error(errorMessage(error)))}
        />
      ) : (
        <div className="pb-6">
          {states !== undefined ? (
            <StateSections states={states} issues={results} orgSlug={orgSlug} />
          ) : (
            <IssueGroups issues={results} orgSlug={orgSlug} />
          )}
        </div>
      )}
      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <div className="px-8 pb-12">
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
