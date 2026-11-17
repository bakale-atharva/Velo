"use client";

import { CirclePlus } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateIssueDialog } from "@/components/issues/create-issue-dialog";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { FilterBar } from "@/components/issues/filter-bar";
import { FilteredIssues } from "@/components/issues/filtered-issues";
import { activeCount, useIssueFilter } from "@/components/issues/filters";
import { IssueBoard } from "@/components/issues/issue-board";
import { IssueList } from "@/components/issues/issue-list";
import { MemberStack } from "@/components/issues/member-stack";
import { PageSection, TeamPageHeader, teamNav } from "@/components/issues/team-page-header";
import { useTeamFromUrl } from "@/components/issues/use-team";
import { useIssueView, ViewToggle } from "@/components/issues/view-toggle";
import { SaveViewDialog } from "@/components/views/save-view-dialog";

function TeamIssues() {
  const pathname = usePathname();
  const { orgSlug, team, states } = useTeamFromUrl();
  const [view, setView] = useIssueView();
  const [filter, setFilter] = useIssueFilter();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  if (team === undefined || states === undefined) {
    return <PageSkeleton />;
  }
  const filtering = activeCount(filter) > 0;
  return (
    <div className="flex flex-1 flex-col">
      <TeamPageHeader
        title={team.name}
        subtitle={team.key}
        nav={teamNav(orgSlug, team.key, pathname)}
        actions={<MemberStack />}
      />
      <PageSection
        title={filtering ? "Filtered issues" : view === "board" ? "Board" : "All issues"}
        controls={
          <>
            <ViewToggle view={view} onChange={setView} />
            <span aria-hidden className="mx-1 hidden h-7 w-px bg-rule sm:block" />
            <Button size="lg" className="h-11 px-5 text-[15px]" onClick={() => setCreating(true)}>
              <CirclePlus aria-hidden />
              New issue
            </Button>
            <div className="ml-auto">
              <FilterBar
                filter={filter}
                onChange={setFilter}
                teamId={team._id}
                actions={
                  filtering ? (
                    <Button variant="outline" className="h-10 rounded-xl" onClick={() => setSaving(true)}>
                      Save view
                    </Button>
                  ) : undefined
                }
              />
            </div>
          </>
        }
      >
        <SaveViewDialog
          filter={{ ...filter, teamId: team._id }}
          layout={view}
          orgSlug={orgSlug}
          open={saving}
          onOpenChange={setSaving}
        />
        <CreateIssueDialog team={team} states={states} open={creating} onOpenChange={setCreating} />
        <div className="-mx-3 flex flex-1 flex-col pt-6 md:-mx-6">
          {filtering ? (
            <FilteredIssues
              filter={{ ...filter, teamId: team._id }}
              states={states}
              view={view}
              orgSlug={orgSlug}
              onClear={() => setFilter({})}
            />
          ) : view === "board" ? (
            <IssueBoard teamId={team._id} states={states} orgSlug={orgSlug} />
          ) : (
            <IssueList teamId={team._id} states={states} orgSlug={orgSlug} />
          )}
        </div>
      </PageSection>
    </div>
  );
}

export default function TeamIssuesPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <TeamIssues />
      </Suspense>
    </ErrorBoundary>
  );
}
