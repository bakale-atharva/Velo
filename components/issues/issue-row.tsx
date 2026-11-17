"use client";

import Link from "next/link";
import type { Doc } from "@/convex/_generated/dataModel";
import { AssigneeAvatar } from "./assignee-avatar";
import { DuePill } from "./due-pill";
import { useNow } from "./use-now";
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
  const now = useNow();
  return (
    <Link
      href={`/${orgSlug}/issue/${issue.identifier}`}
      // J/K selection and S/A/P/L act on the focused row (components/commands/shortcuts.tsx).
      data-issue-row=""
      data-identifier={issue.identifier}
      className="grid grid-cols-[auto_16px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] px-3 py-2.5 hover:bg-tile focus-visible:bg-tile focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      <span className="inline-flex h-7 min-w-[72px] items-center justify-center rounded-lg bg-chip px-2 text-[13px] font-medium text-muted-foreground tabular-nums">
        {issue.identifier}
      </span>
      <PriorityRamp priority={issue.priority} />
      <span className="flex min-w-0 items-center gap-2">
        <span className={`truncate text-[15px] ${finished ? "text-muted-foreground" : "font-medium"}`}>
          {issue.title}
        </span>
        {issue.labelIds.map((labelId) => {
          const label = labelById.get(labelId);
          return label === undefined ? null : (
            <span
              key={labelId}
              className="hidden h-6 shrink-0 items-center gap-1.5 rounded-full border border-rule bg-panel px-2.5 text-[12px] sm:inline-flex"
            >
              <span className="size-2 rounded-full" style={{ background: label.color }} aria-hidden />
              {label.name}
            </span>
          );
        })}
      </span>
      <span className="flex items-center gap-3 text-[13px] text-muted-foreground tabular-nums">
        {issue.dueDate !== null && (
          <span className="hidden md:inline">
            <DuePill dueDate={issue.dueDate} finished={finished} now={now} fill="var(--panel)" />
          </span>
        )}
        {issue.estimate !== null && <span>{issue.estimate} pt</span>}
        <AssigneeAvatar member={issue.assigneeId === null ? null : memberById.get(issue.assigneeId)} size={26} />
      </span>
    </Link>
  );
}
