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
      <nav
        aria-label="Breadcrumb"
        className="data flex h-11 items-center gap-2 border-b border-rule px-3 text-[12px] text-muted-foreground md:px-6"
      >
        <Link href={`/${orgSlug}/team/${teamKey}/issues`} className="hover:text-foreground">
          {teamKey}
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-foreground">{issue.identifier}</span>
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
