"use client";

import { useParams } from "next/navigation";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Suspense, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ProjectCharts } from "@/components/charts/project-charts";
import { AssigneeAvatar } from "@/components/issues/assignee-avatar";
import { IssueGroups } from "@/components/issues/issue-groups";
import { displayName, useWorkspaceLookups } from "@/components/issues/lookups";
import { Markdown } from "@/components/issues/markdown";
import { TeamPageHeader } from "@/components/issues/team-page-header";
import { ReportButton } from "@/components/assistant/report-dialog";
import { Progress } from "@/components/projects/progress";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { ProjectStatusTag, statusLabel } from "@/components/projects/project-status";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { formatDate } from "@/lib/dates";

const PAGE_SIZE = 100;

/** One labelled fact in the row under the header. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // Narrow work fields fold the strip into two columns ruled both ways; the last fact spans the row.
    <div className="grid content-between gap-3 border-r border-b border-border px-3 py-5 even:border-r-0 last:col-span-2 last:border-r-0 last:border-b-0 @3xl/main:border-b-0 @3xl/main:px-6 @3xl/main:even:border-r @3xl/main:last:col-span-1 @3xl/main:last:border-r-0">
      <dt className="signal-label">{label}</dt>
      <dd className="flex min-h-7 items-center gap-2 text-[14px]">{children}</dd>
    </div>
  );
}

function ProjectIssues({ project, orgSlug }: { project: Doc<"projects">; orgSlug: string }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.projects.listIssues,
    // Sub-issues live on their parent's page, not in the list.
    { projectId: project._id, topLevel: true },
    { initialNumItems: PAGE_SIZE },
  );
  if (status === "LoadingFirstPage") {
    return <PageSkeleton rows={5} />;
  }
  if (results.length === 0 && status === "Exhausted") {
    return (
      <div className="px-3 pt-8 @3xl/main:px-6">
        <EmptyState title="No issues in this project">
          Add issues from any team by setting their Project in the issue’s properties.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="pt-8 pb-12">
      <IssueGroups issues={results} orgSlug={orgSlug} />
      {status === "CanLoadMore" && (
        <div className="px-3 pt-2 @3xl/main:px-6">
          <Button variant="outline" onClick={() => loadMore(PAGE_SIZE)}>
            Load more issues
          </Button>
        </div>
      )}
      {status === "LoadingMore" && (
        <p className="px-3 pt-2 text-[13px] text-muted-foreground @3xl/main:px-6">Loading more…</p>
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
    <div className="flex flex-1 flex-col">
      <TeamPageHeader
        back={{ href: `/${orgSlug}/projects`, label: "Projects" }}
        title={project.name}
        subtitle={statusLabel(project.status)}
        actions={
          <>
            <ReportButton kind="project" id={project._id} subject={project.name} />
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit project
            </Button>
          </>
        }
      />
      <ProjectDialog project={project} open={editing} onOpenChange={setEditing} />

      <dl className="grid grid-cols-2 border-b border-rule @3xl/main:grid-cols-[minmax(140px,auto)_minmax(160px,auto)_minmax(120px,auto)_minmax(120px,auto)_minmax(200px,1fr)]">
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
          <span className="data text-[13px] uppercase">
            {project.startDate === null ? "—" : formatDate(project.startDate)}
          </span>
        </Fact>
        <Fact label="Target">
          <span className="data text-[13px] uppercase">
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
        <div className="max-w-3xl border-b border-border px-3 py-8 @3xl/main:px-6">
          <Markdown>{project.description}</Markdown>
        </div>
      )}

      <ProjectCharts projectId={project._id} />

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
