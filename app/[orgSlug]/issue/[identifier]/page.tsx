"use client";

import { useQuery } from "convex/react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { IssueDetail } from "@/components/issues/issue-detail";
import { IssueTimeline } from "@/components/issues/issue-timeline";

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
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 px-3 pt-8 text-[13px] text-muted-foreground md:px-6">
        <Link
          href={`/${orgSlug}/team/${teamKey}/issues`}
          className="inline-flex h-8 items-center rounded-lg bg-muted px-3 hover:bg-secondary hover:text-foreground"
        >
          {teamKey}
        </Link>
        <ChevronRight className="size-4" aria-hidden />
        <span className="inline-flex h-8 items-center rounded-lg bg-chip px-3 font-medium text-foreground tabular-nums">
          {issue.identifier}
        </span>
      </nav>
      <IssueDetail issue={issue} states={states} orgSlug={orgSlug}>
        <IssueTimeline issueId={issue._id} />
      </IssueDetail>
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
