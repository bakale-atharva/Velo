"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { TeamInsights } from "@/components/charts/team-insights";
import { TeamPageHeader, teamNav } from "@/components/issues/team-page-header";
import { useTeamFromUrl } from "@/components/issues/use-team";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";

function TeamInsightsPage() {
  const pathname = usePathname();
  const { orgSlug, teamKey, team } = useTeamFromUrl();
  if (team === undefined) {
    return <PageSkeleton />;
  }
  return (
    <div className="flex flex-1 flex-col">
      <TeamPageHeader title={team.name} subtitle={team.key} nav={teamNav(orgSlug, teamKey, pathname)} />
      <TeamInsights teamId={team._id} />
    </div>
  );
}

export default function Page() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <TeamInsightsPage />
      </Suspense>
    </ErrorBoundary>
  );
}
