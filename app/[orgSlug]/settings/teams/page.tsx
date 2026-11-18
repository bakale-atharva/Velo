"use client";

import { ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { Suspense } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { NewTeamDialog } from "@/components/teams/new-team-dialog";
import { usePermission } from "@/components/views/use-permission";

function Teams() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const teams = useQuery(api.teams.list, { includeArchived: true });
  const canManage = usePermission("teams.manage");
  if (teams === undefined) {
    return <PageSkeleton rows={5} />;
  }
  return (
    <SettingsPanel
      title="Teams"
      description="Each team has its own issues, workflow states and cycles. Private teams you’re not in aren’t listed."
      actions={canManage === true ? <NewTeamDialog trigger={<Button variant="outline">New team</Button>} /> : undefined}
    >
      {teams.length === 0 ? (
        <p className="px-3 text-[15px] text-muted-foreground">No teams yet.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {teams.map((team) => (
            <li key={team._id}>
              <Link
                href={`/${orgSlug}/settings/teams/${team.key}`}
                className="flex items-center gap-3 rounded-[14px] px-3 py-3 hover:bg-tile focus-visible:bg-tile focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              >
                <span className="inline-flex h-7 min-w-12 items-center justify-center rounded-lg bg-chip px-2 text-[13px] font-medium text-muted-foreground">
                  {team.key}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{team.name}</span>
                {team.isPrivate && (
                  <span className="inline-flex items-center gap-1 text-[13px] text-muted-foreground">
                    <Lock className="size-3.5" aria-hidden />
                    Private
                  </span>
                )}
                {team.archivedAt !== null && (
                  <span className="text-[13px] text-muted-foreground">Archived</span>
                )}
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SettingsPanel>
  );
}

export default function TeamsSettingsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton rows={5} />}>
        <Teams />
      </Suspense>
    </ErrorBoundary>
  );
}
