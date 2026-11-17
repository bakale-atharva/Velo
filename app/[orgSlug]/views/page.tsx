"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { Suspense } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { activeCount } from "@/components/issues/filters";
import { displayName, useWorkspaceLookups } from "@/components/issues/lookups";
import { StateHeading } from "@/components/issues/state-heading";
import { TeamPageHeader } from "@/components/issues/team-page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";

function ViewRow({ view, orgSlug, owner }: { view: Doc<"savedViews">; orgSlug: string; owner?: string }) {
  const count = activeCount(view.filter);
  return (
    <Link
      href={`/${orgSlug}/views/${view._id}`}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[14px] px-3 py-3 hover:bg-tile focus-visible:bg-tile focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_180px_140px]"
    >
      <span className="truncate text-[15px] font-medium">{view.name}</span>
      <span className="hidden truncate text-[13px] text-muted-foreground sm:block">
        {owner ?? (view.isShared ? "Shared with workspace" : "Only you")}
      </span>
      <span className="text-right text-[13px] text-muted-foreground tabular-nums">
        {count} {count === 1 ? "filter" : "filters"} · {view.layout}
      </span>
    </Link>
  );
}

function Section({ title, children, count }: { title: string; count: number; children: React.ReactNode }) {
  const id = `views-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="panel mx-3 mb-4 p-3 md:mx-6">
      <div className="px-3 pt-2 pb-3">
        <StateHeading id={id} name={title} count={count} color="var(--state-started)" />
      </div>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </section>
  );
}

function Views() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const views = useQuery(api.savedViews.list, {});
  const me = useQuery(api.members.me, {});
  const { memberById } = useWorkspaceLookups();

  if (views === undefined || me === undefined) {
    return <PageSkeleton />;
  }
  const mine = views.filter((view) => view.ownerId === me.userId);
  const shared = views.filter((view) => view.ownerId !== me.userId);

  return (
    <div className="flex flex-1 flex-col">
      <TeamPageHeader title="Views" subtitle={views.length === 0 ? undefined : `${views.length} saved`} />
      {views.length === 0 ? (
        <div className="px-3 pt-8 md:px-6">
          <EmptyState title="No saved views">
            Filter a team’s issues, then choose Save view to keep that filter here.
          </EmptyState>
        </div>
      ) : (
        <div className="pt-8 pb-12">
          {mine.length > 0 && (
            <Section title="My views" count={mine.length}>
              {mine.map((view) => (
                <li key={view._id}>
                  <ViewRow view={view} orgSlug={orgSlug} />
                </li>
              ))}
            </Section>
          )}
          {shared.length > 0 && (
            <Section title="Shared with workspace" count={shared.length}>
              {shared.map((view) => (
                <li key={view._id}>
                  <ViewRow
                    view={view}
                    orgSlug={orgSlug}
                    owner={`By ${displayName(memberById.get(view.ownerId))}`}
                  />
                </li>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

export default function ViewsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <Views />
      </Suspense>
    </ErrorBoundary>
  );
}
