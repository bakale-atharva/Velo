"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { IssueDetail } from "@/components/issues/issue-detail";

function IssuePage() {
  const { orgSlug, identifier } = useParams<{ orgSlug: string; identifier: string }>();
  const issue = useQuery(api.issues.get, { identifier: decodeURIComponent(identifier) });
  const states = useQuery(api.workflowStates.list, issue ? { teamId: issue.teamId } : "skip");
  if (issue === undefined || states === undefined) {
    return <PageSkeleton rows={4} />;
  }
  const teamKey = issue.identifier.split("-")[0];
  return (
    <>
      <nav aria-label="Breadcrumb" className="border-b border-border px-8 py-3 text-xs text-muted-foreground">
        <Link href={`/${orgSlug}/team/${teamKey}/issues`} className="hover:text-foreground hover:underline">
          {teamKey}
        </Link>
        <span aria-hidden> / </span>
        <span className="text-foreground tabular-nums">{issue.identifier}</span>
      </nav>
      <IssueDetail issue={issue} states={states} orgSlug={orgSlug} />
    </>
  );
}

export default function IssueDetailPage() {
  return (
    <ErrorBoundary>
      <IssuePage />
    </ErrorBoundary>
  );
}
