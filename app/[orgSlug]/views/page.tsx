"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { Suspense } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { activeCount } from "@/components/issues/filters";
import { displayName, useWorkspaceLookups } from "@/components/issues/lookups";
import { TeamPageHeader } from "@/components/issues/team-page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";

function ViewRow({ view, orgSlug, owner }: { view: Doc<"savedViews">; orgSlug: string; owner?: string }) {
  const count = activeCount(view.filter);
  return (
    <Link
      href={`/${orgSlug}/views/${view._id}`}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 px-8 py-3 hover:bg-card focus-visible:bg-card focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_160px_120px]"
    >
      <span className="truncate text-[13px] font-medium">{view.name}</span>
      <span className="hidden truncate text-xs text-muted-foreground sm:block">
        {owner ?? (view.isShared ? "Shared with workspace" : "Only you")}
      </span>
      <span className="text-right text-xs text-muted-foreground tabular-nums">
        {count} {count === 1 ? "filter" : "filters"} · {view.layout}
      </span>
    </Link>
  );
}

function Section({ title, children, count }: { title: string; count: number; children: React.ReactNode }) {
  const id = `views-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="mt-6">
      <h2
        id={id}
        className="mx-8 flex items-baseline justify-between border-b-2 border-rule pb-1 text-[13px] font-semibold"
      >
        {title}
        <span className="text-xs font-normal text-muted-foreground tabular-nums">{count}</span>
      </h2>
      <ul className="divide-y divide-border">{children}</ul>
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
    <div className="flex min-h-svh flex-col">
      <TeamPageHeader title="Views" />
      {views.length === 0 ? (
        <div className="px-8 py-6">
          <EmptyState title="No saved views">
            Filter a team’s issues, then choose Save view to keep that filter here.
          </EmptyState>
        </div>
      ) : (
        <div className="pb-12">
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
