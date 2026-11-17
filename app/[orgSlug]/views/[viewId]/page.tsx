"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterBar } from "@/components/issues/filter-bar";
import { FilteredIssues } from "@/components/issues/filtered-issues";
import type { IssueFilter } from "@/components/issues/filters";
import { TeamPageHeader } from "@/components/issues/team-page-header";
import { ViewToggle } from "@/components/issues/view-toggle";
import { usePermission } from "@/components/views/use-permission";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { errorMessage } from "@/lib/errors";

/** Same filter regardless of key order. */
function sameFilter(a: IssueFilter, b: IssueFilter): boolean {
  const norm = (f: IssueFilter) =>
    JSON.stringify(Object.keys(f).sort().map((k) => [k, f[k as keyof IssueFilter]]));
  return norm(a) === norm(b);
}

function ViewBody({ view, orgSlug, isOwner, isAdmin }: {
  view: Doc<"savedViews">;
  orgSlug: string;
  isOwner: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const update = useMutation(api.savedViews.update);
  const remove = useMutation(api.savedViews.remove);
  const mayShare = usePermission("views.share");
  const { teamId, ...saved } = view.filter;
  const [filter, setFilter] = useState<IssueFilter>(saved);
  const [layout, setLayout] = useState(view.layout);
  const [confirming, setConfirming] = useState(false);
  const team = useQuery(api.teams.list, {})?.find((t) => t._id === teamId);
  const states = useQuery(api.workflowStates.list, teamId === undefined ? "skip" : { teamId });

  const dirty = !sameFilter(filter, saved) || layout !== view.layout;
  const full: IssueFilter = teamId === undefined ? filter : { ...filter, teamId };

  async function save(patch: { isShared?: boolean } = {}) {
    try {
      await update({ viewId: view._id, filter: full, layout, ...patch });
      toast.success(patch.isShared === undefined ? "View saved" : patch.isShared ? "View shared" : "View unshared");
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  async function destroy() {
    try {
      await remove({ viewId: view._id });
      toast.success(`Deleted ${view.name}`);
      router.push(`/${orgSlug}/views`);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  const mayDelete = isOwner || (isAdmin && view.isShared);
  return (
    <div className="flex min-h-svh flex-col">
      <nav aria-label="Breadcrumb" className="px-8 pt-4 text-xs text-muted-foreground">
        <Link href={`/${orgSlug}/views`} className="hover:text-foreground hover:underline">
          Views
        </Link>
      </nav>
      <TeamPageHeader
        title={view.name}
        subtitle={team === undefined ? undefined : `in ${team.key}`}
        actions={
          <>
            {teamId !== undefined && <ViewToggle view={layout} onChange={setLayout} />}
            {isOwner && mayShare === true && (
              <Button variant="outline" onClick={() => save({ isShared: !view.isShared })}>
                {view.isShared ? "Unshare" : "Share"}
              </Button>
            )}
            {mayDelete && (
              <Button variant="outline" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            )}
          </>
        }
      />
      <FilterBar
        filter={filter}
        onChange={setFilter}
        teamId={teamId}
        actions={
          isOwner && dirty ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilter(saved);
                  setLayout(view.layout);
                }}
              >
                Revert
              </Button>
              <Button size="sm" onClick={() => save()}>
                Save changes
              </Button>
            </>
          ) : undefined
        }
      />
      {teamId !== undefined && states === undefined ? (
        <PageSkeleton />
      ) : (
        <FilteredIssues
          filter={full}
          orgSlug={orgSlug}
          states={states}
          view={layout}
          onClear={() => setFilter({})}
        />
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {view.name}?</DialogTitle>
            <DialogDescription>
              {view.isShared
                ? "It disappears for everyone in the workspace. Issues aren’t affected."
                : "Issues aren’t affected."}{" "}
              This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Keep view
            </Button>
            <Button variant="destructive" onClick={destroy}>
              Delete view
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ViewDetail() {
  const { orgSlug, viewId } = useParams<{ orgSlug: string; viewId: string }>();
  const view = useQuery(api.savedViews.get, { viewId: viewId as Id<"savedViews"> });
  const me = useQuery(api.members.me, {});
  if (view === undefined || me === undefined) {
    return <PageSkeleton />;
  }
  return (
    <ViewBody
      // A different view starts from its own saved filter.
      key={view._id}
      view={view}
      orgSlug={orgSlug}
      isOwner={view.ownerId === me.userId}
      isAdmin={me.role === "admin"}
    />
  );
}

export default function ViewPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <ViewDetail />
      </Suspense>
    </ErrorBoundary>
  );
}
