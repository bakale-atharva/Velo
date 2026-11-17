"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Suspense, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { AssigneeAvatar } from "@/components/issues/assignee-avatar";
import { IssueGroups } from "@/components/issues/issue-groups";
import { displayName, useWorkspaceLookups } from "@/components/issues/lookups";
import { Markdown } from "@/components/issues/markdown";
import { TeamPageHeader } from "@/components/issues/team-page-header";
import { Progress } from "@/components/projects/progress";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { ProjectStatusTag } from "@/components/projects/project-status";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { formatDate } from "@/lib/dates";

const PAGE_SIZE = 100;

/** One labelled fact in the row under the header. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-h-5 items-center gap-2 text-[13px]">{children}</dd>
    </div>
  );
}

function ProjectIssues({ project, orgSlug }: { project: Doc<"projects">; orgSlug: string }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.projects.listIssues,
    { projectId: project._id },
    { initialNumItems: PAGE_SIZE },
  );
  if (status === "LoadingFirstPage") {
    return <PageSkeleton rows={5} />;
  }
  if (results.length === 0 && status === "Exhausted") {
    return (
      <div className="px-8 py-6">
        <EmptyState title="No issues in this project">
          Add issues from any team by setting their Project in the issue’s properties.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="pb-12">
      <IssueGroups issues={results} orgSlug={orgSlug} />
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

function ProjectDetail() {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>();
  const project = useQuery(api.projects.get, { projectId: projectId as Id<"projects"> });
  const { memberById } = useWorkspaceLookups();
  const [editing, setEditing] = useState(false);

  if (project === undefined) {
    return <PageSkeleton />;
  }
  const lead = project.leadId === null ? null : memberById.get(project.leadId);

  return (
    <div className="flex min-h-svh flex-col">
      <nav aria-label="Breadcrumb" className="px-8 pt-4 text-xs text-muted-foreground">
        <Link href={`/${orgSlug}/projects`} className="hover:text-foreground hover:underline">
          Projects
        </Link>
      </nav>
      <TeamPageHeader
        title={project.name}
        actions={
          <Button variant="outline" onClick={() => setEditing(true)}>
            Edit project
          </Button>
        }
      />
      <ProjectDialog project={project} open={editing} onOpenChange={setEditing} />

      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 border-b border-border px-8 py-4 md:grid-cols-[auto_auto_auto_auto_minmax(200px,1fr)]">
        <Fact label="Status">
          <ProjectStatusTag status={project.status} />
        </Fact>
        <Fact label="Lead">
          {lead === null ? (
            <span className="text-muted-foreground">No lead</span>
          ) : (
            <>
              <AssigneeAvatar member={lead} />
              {displayName(lead)}
            </>
          )}
        </Fact>
        <Fact label="Start">
          <span className="tabular-nums">
            {project.startDate === null ? "—" : formatDate(project.startDate)}
          </span>
        </Fact>
        <Fact label="Target">
          <span className="tabular-nums">
            {project.targetDate === null ? "—" : formatDate(project.targetDate)}
          </span>
        </Fact>
        <Fact label="Progress">
          <Progress
            className="w-full"
            completed={project.completedIssueCount}
            total={project.issueCount}
          />
        </Fact>
      </dl>

      {project.description.trim() !== "" && (
        <div className="max-w-3xl px-8 pt-6">
          <Markdown>{project.description}</Markdown>
        </div>
      )}

      <ProjectIssues project={project} orgSlug={orgSlug} />
    </div>
  );
}

export default function ProjectPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <ProjectDetail />
      </Suspense>
    </ErrorBoundary>
  );
}
