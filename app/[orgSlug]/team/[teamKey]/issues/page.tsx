"use client";

import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateIssueDialog } from "@/components/issues/create-issue-dialog";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { IssueBoard } from "@/components/issues/issue-board";
import { IssueList } from "@/components/issues/issue-list";
import { TeamPageHeader } from "@/components/issues/team-page-header";
import { useTeamFromUrl } from "@/components/issues/use-team";
import { useIssueView, ViewToggle } from "@/components/issues/view-toggle";

function TeamIssues() {
  const { orgSlug, team, states } = useTeamFromUrl();
  const [view, setView] = useIssueView();
  const [creating, setCreating] = useState(false);
  if (team === undefined || states === undefined) {
    return <PageSkeleton />;
  }
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
      <CreateIssueDialog team={team} states={states} open={creating} onOpenChange={setCreating} />
      {view === "board" ? (
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
