"use client";

import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateIssueDialog } from "@/components/issues/create-issue-dialog";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { FilterBar } from "@/components/issues/filter-bar";
import { FilteredIssues } from "@/components/issues/filtered-issues";
import { activeCount, useIssueFilter } from "@/components/issues/filters";
import { IssueBoard } from "@/components/issues/issue-board";
import { IssueList } from "@/components/issues/issue-list";
import { TeamPageHeader } from "@/components/issues/team-page-header";
import { useTeamFromUrl } from "@/components/issues/use-team";
import { useIssueView, ViewToggle } from "@/components/issues/view-toggle";

function TeamIssues() {
  const { orgSlug, team, states } = useTeamFromUrl();
  const [view, setView] = useIssueView();
  const [filter, setFilter] = useIssueFilter();
  const [creating, setCreating] = useState(false);
  if (team === undefined || states === undefined) {
    return <PageSkeleton />;
  }
  const filtering = activeCount(filter) > 0;
  return (
    <div className="flex min-h-svh flex-col">
      <TeamPageHeader
        title={team.name}
        subtitle={view === "board" ? "Board" : "Issues"}
        actions={
          <>
            <ViewToggle view={view} onChange={setView} />
            <Button onClick={() => setCreating(true)}>New issue</Button>
          </>
        }
      />
      <FilterBar filter={filter} onChange={setFilter} teamId={team._id} />
      <CreateIssueDialog team={team} states={states} open={creating} onOpenChange={setCreating} />
      {filtering ? (
        <FilteredIssues
          filter={{ ...filter, teamId: team._id }}
          states={states}
          view={view}
          orgSlug={orgSlug}
          onClear={() => setFilter({})}
        />
      ) : view === "board" ? (
        <IssueBoard teamId={team._id} states={states} orgSlug={orgSlug} />
      ) : (
        <IssueList teamId={team._id} states={states} orgSlug={orgSlug} />
      )}
    </div>
  );
}

export default function TeamIssuesPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <TeamIssues />
      </Suspense>
    </ErrorBoundary>
  );
}
