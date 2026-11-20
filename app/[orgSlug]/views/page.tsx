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
import { ROW_MUTED, TABLE_ROW } from "@/components/states/table-styles";

function ViewRow({ view, orgSlug, owner }: { view: Doc<"savedViews">; orgSlug: string; owner?: string }) {
  const count = activeCount(view.filter);
  return (
    <Link
      href={`/${orgSlug}/views/${view._id}`}
      className={`${TABLE_ROW} grid h-11 grid-cols-[minmax(0,1fr)_auto] gap-4 sm:grid-cols-[minmax(0,1fr)_200px_160px]`}
    >
      <span className="truncate text-[14px] font-medium">{view.name}</span>
      <span className={`hidden truncate text-[13px] sm:block ${ROW_MUTED}`}>
        {owner ?? (view.isShared ? "Shared with workspace" : "Only you")}
      </span>
      <span className={`data text-right text-[12px] uppercase ${ROW_MUTED}`}>
        {count} {count === 1 ? "filter" : "filters"} · {view.layout}
      </span>
    </Link>
  );
}

function Section({ title, children, count }: { title: string; count: number; children: React.ReactNode }) {
  const id = `views-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="border-t border-rule first:border-t-0">
      <div className="px-3 pt-5 pb-2 md:px-6">
        <StateHeading id={id} name={title} count={count} />
      </div>
      <ul className="flex flex-col pb-2">{children}</ul>
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
