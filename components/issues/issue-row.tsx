"use client";

import Link from "next/link";
import type { Doc } from "@/convex/_generated/dataModel";
import { AssigneeAvatar } from "./assignee-avatar";
import { useWorkspaceLookups } from "./lookups";
import { PriorityRamp } from "./priority-ramp";

type Issue = Omit<Doc<"issues">, "searchText">;

/**
 * One issue on the grid: identifier and priority in fixed columns, title,
 * labels as square tags, estimate and assignee aligned right.
 */
export function IssueRow({ issue, orgSlug }: { issue: Issue; orgSlug: string }) {
  const { labelById, memberById } = useWorkspaceLookups();
  const finished = issue.stateType === "completed" || issue.stateType === "canceled";
  return (
    <Link
      href={`/${orgSlug}/issue/${issue.identifier}`}
      // J/K selection and S/A/P/L act on the focused row (components/commands/shortcuts.tsx).
      data-issue-row=""
      data-identifier={issue.identifier}
      className="grid grid-cols-[72px_16px_minmax(0,1fr)_auto] items-center gap-3 px-8 py-2 hover:bg-card focus-visible:bg-card focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring"
    >
      <span className="text-xs text-muted-foreground tabular-nums">{issue.identifier}</span>
      <PriorityRamp priority={issue.priority} />
      <span className="flex min-w-0 items-center gap-2">
        <span className={`truncate text-[13px] ${finished ? "text-muted-foreground" : "font-medium"}`}>
          {issue.title}
        </span>
        {issue.labelIds.map((labelId) => {
          const label = labelById.get(labelId);
          return label === undefined ? null : (
            <span
              key={labelId}
              className="hidden shrink-0 items-center gap-1 rounded-[2px] border border-border px-1 text-[11px] leading-4 sm:inline-flex"
            >
              <span className="size-1.5 rounded-full" style={{ background: label.color }} aria-hidden />
              {label.name}
            </span>
          );
        })}
      </span>
      <span className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
        {issue.estimate !== null && <span>{issue.estimate} pt</span>}
        <AssigneeAvatar member={issue.assigneeId === null ? null : memberById.get(issue.assigneeId)} />
      </span>
    </Link>
  );
}
