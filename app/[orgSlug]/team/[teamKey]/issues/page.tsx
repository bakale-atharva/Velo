"use client";

import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { IssueList } from "@/components/issues/issue-list";
import { TeamPageHeader } from "@/components/issues/team-page-header";
import { useTeamFromUrl } from "@/components/issues/use-team";

function TeamIssues() {
  const { orgSlug, team, states } = useTeamFromUrl();
  if (team === undefined || states === undefined) {
    return <PageSkeleton />;
  }
  return (
    <>
      <TeamPageHeader title={team.name} subtitle="Issues" />
      <IssueList teamId={team._id} states={states} orgSlug={orgSlug} />
    </>
  );
}

export default function TeamIssuesPage() {
  return (
    <ErrorBoundary>
      <TeamIssues />
    </ErrorBoundary>
  );
}
