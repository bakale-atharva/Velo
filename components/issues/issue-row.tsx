"use client";

import Link from "next/link";
import type { Doc } from "@/convex/_generated/dataModel";
import { AssigneeAvatar } from "./assignee-avatar";
import { DuePill } from "./due-pill";
import { useNow } from "./use-now";
import { useWorkspaceLookups } from "./lookups";
import { PriorityRamp } from "./priority-ramp";
import { SignalFlash } from "./signal-flash";
import { StageGauge } from "./state-heading";

type Issue = Omit<Doc<"issues">, "searchText">;

/**
 * One issue as a table row: id, stage gauge, priority, title with labels,
 * then due date, estimate and assignee in fixed columns. The focused row
 * (J/K or Tab) is the active path and inverts. The due date shows only on
 * wide work fields unless `showDue` keeps it at every width.
 */
export function IssueRow({
  issue,
  orgSlug,
  showDue = false,
}: {
  issue: Issue;
  orgSlug: string;
  showDue?: boolean;
}) {
  const { labelById, memberById } = useWorkspaceLookups();
  const finished = issue.stateType === "completed" || issue.stateType === "canceled";
  const now = useNow();
  return (
    <Link
      href={`/${orgSlug}/issue/${issue.identifier}`}
      // J/K selection and S/A/P/L act on the focused row (components/commands/shortcuts.tsx).
      data-issue-row=""
      data-identifier={issue.identifier}
      // Narrow work fields drop the stage gauge (the section heading already names the state)
      // and tighten the id column, so the title keeps its room.
      className="group relative grid h-11 grid-cols-[minmax(52px,auto)_14px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 hover:bg-tile focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none @xl/main:h-10 @xl/main:grid-cols-[84px_56px_14px_minmax(0,1fr)_auto] @xl/main:gap-4 @3xl/main:px-6"
    >
      <span className="data text-[12px] text-muted-foreground group-focus-visible:text-background">
        {issue.identifier}
      </span>
      <span className="hidden @xl/main:contents">
        <StageGauge type={issue.stateType} />
      </span>
      <PriorityRamp priority={issue.priority} />
      <span className="flex min-w-0 items-center gap-3">
        <span className={`truncate text-[14px] ${finished ? "text-muted-foreground group-focus-visible:text-background" : ""}`}>
          {issue.title}
        </span>
        {issue.labelIds.map((labelId) => {
          const label = labelById.get(labelId);
          return label === undefined ? null : (
            <span
              key={labelId}
              className="data hidden shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground group-focus-visible:text-background @xl/main:inline-flex"
            >
              <span className="size-[7px]" style={{ background: label.color }} aria-hidden />
              {label.name}
            </span>
          );
        })}
      </span>
      <span className="data flex items-center gap-5 text-[12px] text-muted-foreground group-focus-visible:text-background">
        {issue.dueDate !== null && (
          <span className={showDue ? "inline" : "hidden @3xl/main:inline"}>
            <DuePill dueDate={issue.dueDate} finished={finished} now={now} />
          </span>
        )}
        <span className="hidden w-8 text-right @xl/main:inline">{issue.estimate === null ? "—" : `${issue.estimate}p`}</span>
        <AssigneeAvatar member={issue.assigneeId === null ? null : memberById.get(issue.assigneeId)} size={22} />
      </span>
      <SignalFlash
        signature={[issue.title, issue.stateId, issue.priority, issue.assigneeId, issue.estimate, issue.dueDate, issue.labelIds.join()].join("|")}
      />
    </Link>
  );
}
