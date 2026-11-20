"use client";

import { usePaginatedQuery } from "convex/react";
import { Suspense } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { AssigneeAvatar } from "@/components/issues/assignee-avatar";
import { displayName, useWorkspaceLookups } from "@/components/issues/lookups";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { useAdminGate } from "@/components/settings/use-gate";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { UpgradePrompt } from "@/components/states/upgrade-prompt";

const PAGE_SIZE = 50;

const TIME = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type Entry = Doc<"auditLogs">;

/** "team.member_added" with its metadata → "added a member to Web". */
function describe(entry: Entry, nameOf: (userId: string) => string): string {
  const m = entry.metadata;
  const name = m.name ?? m.title ?? m.identifier ?? "";
  switch (entry.action) {
    case "team.created":
      return `created team ${name}${m.isPrivate === "true" ? " (private)" : ""}`;
    case "team.updated":
      return `updated team ${name}${m.isPrivate === "true" ? ", now private" : ""}`;
    case "team.archived":
      return `archived team ${name}`;
    case "team.unarchived":
      return `unarchived team ${name}`;
    case "team.deleted":
      return `deleted team ${name}${m.key ? ` (${m.key})` : ""}`;
    case "team.member_added":
      return `added ${nameOf(m.userId ?? "")} to a team`;
    case "team.member_removed":
      return `removed ${nameOf(m.userId ?? "")} from a team`;
    case "role.created":
      return `created role ${name}`;
    case "role.updated":
      return `changed role ${name}`;
    case "role.deleted":
      return `deleted role ${name}`;
    case "role.assigned":
      return `gave ${nameOf(entry.targetId)} the ${name} role`;
    case "role.unassigned":
      return `put ${nameOf(entry.targetId)} back on member defaults`;
    case "issue.deleted":
      return `deleted issue ${m.identifier ?? ""} ${m.title ? `“${m.title}”` : ""}`.trim();
    case "label.deleted":
      return `deleted label ${name}`;
    case "workflow_state.deleted":
      return `deleted workflow state ${name}`;
    case "project.deleted":
      return `deleted project ${name}`;
    case "view.shared":
      return `shared view ${name}`;
    case "view.unshared":
      return `stopped sharing view ${name}`;
    default:
      return `${entry.action.replace(/[._]/g, " ")}${name ? ` ${name}` : ""}`;
  }
}

function AuditLogBody() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.auditLogs.list,
    {},
    { initialNumItems: PAGE_SIZE },
  );
  const { memberById } = useWorkspaceLookups();
  const nameOf = (userId: string) => displayName(memberById.get(userId));

  if (status === "LoadingFirstPage") return <PageSkeleton rows={8} />;
  return (
    <SettingsPanel
      title="Audit log"
      description="Changes to teams, roles, sharing and deletions, newest first."
    >
      {results.length === 0 ? (
        <p className="px-3 text-[15px] text-muted-foreground">Nothing recorded yet.</p>
      ) : (
        <ol className="flex flex-col border-t border-border">
          {results.map((entry) => (
            <li
              key={entry._id}
              className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-3 border-b border-border px-2 py-2.5 hover:bg-tile sm:grid-cols-[24px_minmax(0,1fr)_150px]"
            >
              <AssigneeAvatar member={memberById.get(entry.actorId)} size={22} />
              <p className="min-w-0 text-[14px] leading-6">
                <span className="font-medium">{nameOf(entry.actorId)}</span> {describe(entry, nameOf)}
              </p>
              <time
                dateTime={new Date(entry._creationTime).toISOString()}
                className="data col-start-2 text-[11px] text-muted-foreground uppercase sm:col-start-auto sm:pt-1 sm:text-right"
              >
                {TIME.format(entry._creationTime)}
              </time>
            </li>
          ))}
        </ol>
      )}
      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <div className="mt-4 px-3">
          <Button variant="outline" disabled={status === "LoadingMore"} onClick={() => loadMore(PAGE_SIZE)}>
            {status === "LoadingMore" ? "Loading…" : "Load older entries"}
          </Button>
        </div>
      )}
    </SettingsPanel>
  );
}

function AuditLog() {
  const gate = useAdminGate("audit_log");
  if (gate === "loading") return <PageSkeleton rows={8} />;
  if (gate === "admins-only") {
    return <EmptyState title="The audit log is for admins">Ask a workspace admin if you need to know who changed something.</EmptyState>;
  }
  if (gate === "upgrade") return <UpgradePrompt feature="audit_log" />;
  return <AuditLogBody />;
}

export default function AuditLogSettingsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton rows={8} />}>
        <AuditLog />
      </Suspense>
    </ErrorBoundary>
  );
}
