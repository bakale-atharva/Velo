"use client";

import { Plus } from "lucide-react";
import { ROW_MUTED, TABLE, TABLE_HEAD, TABLE_ROW } from "@/components/states/table-styles";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { Suspense, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { AssigneeAvatar } from "@/components/issues/assignee-avatar";
import { displayName, useWorkspaceLookups } from "@/components/issues/lookups";
import { TeamPageHeader } from "@/components/issues/team-page-header";
import { Progress } from "@/components/projects/progress";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { ProjectStatusTag } from "@/components/projects/project-status";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { formatDate } from "@/lib/dates";

const ROW =
  "grid grid-cols-[minmax(0,1fr)_130px] gap-4 md:grid-cols-[minmax(0,1fr)_130px_180px_100px_240px]";

function Projects() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const projects = useQuery(api.projects.list, {});
  const { memberById } = useWorkspaceLookups();
  const [creating, setCreating] = useState(false);

  if (projects === undefined) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <TeamPageHeader
        title="Projects"
        subtitle={projects.length === 0 ? undefined : `${projects.length} total`}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            New project
          </Button>
        }
      />
      <ProjectDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(projectId) => router.push(`/${orgSlug}/projects/${projectId}`)}
      />

      {projects.length === 0 ? (
        <div className="px-3 pt-8 md:px-6">
          <EmptyState
            title="No projects yet"
            action={<Button onClick={() => setCreating(true)}>New project</Button>}
          >
            A project groups issues from any team toward one goal, with a target date and progress.
          </EmptyState>
        </div>
      ) : (
        <div role="table" aria-label="Projects" className={TABLE}>
          <div role="row" className={`${ROW} ${TABLE_HEAD}`}>
            <span role="columnheader">Name</span>
            <span role="columnheader">Status</span>
            <span role="columnheader" className="hidden md:block">Lead</span>
            <span role="columnheader" className="hidden md:block">Target</span>
            <span role="columnheader" className="hidden md:block">Progress</span>
          </div>
          <div role="rowgroup" className="flex flex-col">
            {projects.map((project) => {
              const lead = project.leadId === null ? null : memberById.get(project.leadId);
              return (
                <Link
                  key={project._id}
                  role="row"
                  href={`/${orgSlug}/projects/${project._id}`}
                  className={`${ROW} ${TABLE_ROW} h-11`}
                >
                  <span role="cell" className="truncate text-[14px] font-medium">
                    {project.name}
                  </span>
                  <span role="cell">
                    <ProjectStatusTag status={project.status} />
                  </span>
                  <span role="cell" className="hidden min-w-0 items-center gap-2 text-[13px] md:flex">
                    {lead === null ? (
                      <span className={ROW_MUTED}>No lead</span>
                    ) : (
                      <>
                        <AssigneeAvatar member={lead} />
                        <span className="truncate">{displayName(lead)}</span>
                      </>
                    )}
                  </span>
                  <span role="cell" className="data hidden text-[12px] uppercase md:block">
                    {project.targetDate === null ? (
                      <span className={ROW_MUTED}>—</span>
                    ) : (
                      formatDate(project.targetDate)
                    )}
                  </span>
                  <span role="cell" className="hidden md:block">
                    <Progress completed={project.completedIssueCount} total={project.issueCount} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <Projects />
      </Suspense>
    </ErrorBoundary>
  );
}
