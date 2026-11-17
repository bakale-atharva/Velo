"use client";

import { CirclePlus } from "lucide-react";
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
  "grid grid-cols-[minmax(0,1fr)_130px] items-center gap-4 px-3 md:grid-cols-[minmax(0,1fr)_130px_180px_100px_240px]";

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
          <Button size="lg" className="h-11 px-5 text-[15px]" onClick={() => setCreating(true)}>
            <CirclePlus aria-hidden />
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
        <div role="table" aria-label="Projects" className="panel mx-3 mt-8 mb-12 p-3 md:mx-6">
          <div
            role="row"
            className={`${ROW} pt-1 pb-3 text-[13px] font-medium text-muted-foreground`}
          >
            <span role="columnheader">Name</span>
            <span role="columnheader">Status</span>
            <span role="columnheader" className="hidden md:block">Lead</span>
            <span role="columnheader" className="hidden md:block">Target</span>
            <span role="columnheader" className="hidden md:block">Progress</span>
          </div>
          <div role="rowgroup" className="flex flex-col gap-0.5">
            {projects.map((project) => {
              const lead = project.leadId === null ? null : memberById.get(project.leadId);
              return (
                <Link
                  key={project._id}
                  role="row"
                  href={`/${orgSlug}/projects/${project._id}`}
                  className={`${ROW} rounded-[14px] py-3 hover:bg-tile focus-visible:bg-tile focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring`}
                >
                  <span role="cell" className="truncate text-[15px] font-medium">
                    {project.name}
                  </span>
                  <span role="cell">
                    <ProjectStatusTag status={project.status} />
                  </span>
                  <span role="cell" className="hidden min-w-0 items-center gap-2 text-[14px] md:flex">
                    {lead === null ? (
                      <span className="text-muted-foreground">No lead</span>
                    ) : (
                      <>
                        <AssigneeAvatar member={lead} />
                        <span className="truncate">{displayName(lead)}</span>
                      </>
                    )}
                  </span>
                  <span role="cell" className="hidden text-[14px] tabular-nums md:block">
                    {project.targetDate === null ? (
                      <span className="text-muted-foreground">—</span>
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
