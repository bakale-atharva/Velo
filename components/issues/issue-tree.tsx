"use client";

import { useQuery } from "convex/react";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { IssueRow } from "./issue-row";

type Issue = Omit<Doc<"issues">, "searchText">;

// The toggle slot every tree row reserves, so ids line up whether or not a
// row has sub-issues; each level of nesting steps in by STEP more.
const SLOT = 20;
const STEP = 16;
const MAX_INDENT_DEPTH = 6;
// The counts query takes at most 200 issues at a time.
const COUNT_BATCH = 200;

/** Sub-issue counts for a set of rows, keyed by issue id. Missing means none. */
export function useSubIssueCounts(issues: Issue[]): Map<Id<"issues">, number> {
  const ids = issues.slice(0, COUNT_BATCH).map((issue) => issue._id);
  const counts = useQuery(api.issues.subIssueCounts, ids.length === 0 ? "skip" : { issueIds: ids });
  return new Map((counts ?? []).map((row) => [row.issueId, row.count]));
}

/**
 * An issue row with an expand toggle when it has sub-issues. The toggle sits
 * in a slot left of the id, outside the row's link, so opening it never
 * navigates. Open, it lists the sub-issues as rows of their own, one step in,
 * and any of them with sub-issues gets a toggle too.
 */
export function IssueTreeRow({
  issue,
  orgSlug,
  count,
  showDue = false,
  depth = 0,
}: {
  issue: Issue;
  orgSlug: string;
  /** How many sub-issues it has; 0 hides the toggle. */
  count: number;
  showDue?: boolean;
  depth?: number;
}) {
  const [open, setOpen] = useState(false);
  const offset = Math.min(depth, MAX_INDENT_DEPTH) * STEP;
  const childrenId = `sub-${issue._id}`;
  return (
    <>
      <div className="relative">
        <IssueRow issue={issue} orgSlug={orgSlug} showDue={showDue} indent={SLOT + offset} />
        {count > 0 && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? childrenId : undefined}
            aria-label={`${open ? "Hide" : "Show"} ${count}${count >= 50 ? "+" : ""} sub-issue${count === 1 ? "" : "s"} of ${issue.identifier}`}
            title={`${count}${count >= 50 ? "+" : ""} sub-issue${count === 1 ? "" : "s"}`}
            onClick={() => setOpen((value) => !value)}
            style={{ "--toggle-offset": `${offset}px` } as React.CSSProperties}
            className="absolute top-1/2 left-[calc(0.75rem+var(--toggle-offset)-2px)] grid size-5 -translate-y-1/2 place-items-center text-muted-foreground hover:text-foreground focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-ring peer-focus-visible:text-background @3xl/main:left-[calc(1.5rem+var(--toggle-offset)-2px)]"
          >
            <ChevronRight aria-hidden className={`size-3.5 transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
          </button>
        )}
      </div>
      {open && count > 0 && (
        <SubIssueBranch id={childrenId} parentId={issue._id} orgSlug={orgSlug} showDue={showDue} depth={depth + 1} />
      )}
    </>
  );
}

/** An opened row's sub-issues, oldest first, each a tree row of its own. */
function SubIssueBranch({
  id,
  parentId,
  orgSlug,
  showDue,
  depth,
}: {
  id: string;
  parentId: Id<"issues">;
  orgSlug: string;
  showDue: boolean;
  depth: number;
}) {
  const children = useQuery(api.issues.listSubIssues, { issueId: parentId });
  const counts = useSubIssueCounts(children ?? []);
  const indent = Math.min(depth, MAX_INDENT_DEPTH) * STEP + SLOT;
  if (children === undefined) {
    return (
      <div
        id={id}
        style={{ "--row-indent": `${indent}px` } as React.CSSProperties}
        className="data flex h-10 items-center border-b border-border pl-[calc(0.75rem+var(--row-indent))] text-[11px] tracking-[0.08em] text-muted-foreground uppercase @3xl/main:pl-[calc(1.5rem+var(--row-indent))]"
      >
        Loading…
      </div>
    );
  }
  return (
    <ul id={id} aria-label="Sub-issues" className="flex flex-col">
      {children.map((child) => (
        <li key={child._id}>
          <IssueTreeRow
            issue={child}
            orgSlug={orgSlug}
            count={counts.get(child._id) ?? 0}
            showDue={showDue}
            depth={depth}
          />
        </li>
      ))}
    </ul>
  );
}

/** A flat list of issues as tree rows: one counts query for the whole list. */
export function IssueTreeList({
  issues,
  orgSlug,
  showDue = false,
  className = "flex flex-col pb-2",
}: {
  issues: Issue[];
  orgSlug: string;
  showDue?: boolean;
  className?: string;
}) {
  const counts = useSubIssueCounts(issues);
  return (
    <ul className={className}>
      {issues.map((issue) => (
        <li key={issue._id}>
          <IssueTreeRow issue={issue} orgSlug={orgSlug} count={counts.get(issue._id) ?? 0} showDue={showDue} />
        </li>
      ))}
    </ul>
  );
}
