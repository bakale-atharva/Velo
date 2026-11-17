"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { IssueGroups } from "@/components/issues/issue-groups";
import { MemberStack } from "@/components/issues/member-stack";
import { TeamPageHeader } from "@/components/issues/team-page-header";

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
    <div className="flex flex-1 flex-col">
      <TeamPageHeader
        title="My issues"
        subtitle={issues.length === 0 ? undefined : `${open} open`}
        actions={<MemberStack />}
      />
      {issues.length === 0 ? (
        <div className="px-3 pt-8 md:px-6">
          <EmptyState title="Nothing assigned to you">
            Issues you are assigned to in any team show up here.
          </EmptyState>
        </div>
      ) : (
        <div className="pt-8 pb-12">
          <IssueGroups issues={issues} orgSlug={orgSlug} />
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
