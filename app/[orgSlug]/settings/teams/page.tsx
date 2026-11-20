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
        <ul className="flex flex-col border-t border-border">
          {teams.map((team) => (
            <li key={team._id}>
              <Link
                href={`/${orgSlug}/settings/teams/${team.key}`}
                className="group flex h-11 items-center gap-4 border-b border-border px-2 hover:bg-tile focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none"
              >
                <span className="data w-12 text-[12px] text-muted-foreground group-focus-visible:text-background">
                  {team.key}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{team.name}</span>
                {team.isPrivate && (
                  <span className="data inline-flex items-center gap-1 text-[11px] text-muted-foreground uppercase group-focus-visible:text-background">
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
