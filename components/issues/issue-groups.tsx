"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import { IssueRow } from "./issue-row";

type Issue = Omit<Doc<"issues">, "searchText">;
type StateType = Doc<"issues">["stateType"];

// Work in hand first, finished last.
const GROUPS: { type: StateType; name: string }[] = [
  { type: "started", name: "In progress" },
  { type: "unstarted", name: "Todo" },
  { type: "backlog", name: "Backlog" },
  { type: "completed", name: "Done" },
  { type: "canceled", name: "Canceled" },
];

/**
 * Issues from any number of teams, grouped by state type (teams name their
 * states differently, so the type is what they share). Each group is headed
 * by its name and count on a state-coloured rule.
 */
export function IssueGroups({ issues, orgSlug }: { issues: Issue[]; orgSlug: string }) {
  return (
    <>
      {GROUPS.map((group) => {
        const inGroup = issues.filter((issue) => issue.stateType === group.type);
        if (inGroup.length === 0) return null;
        return (
          <section key={group.type} aria-labelledby={`group-${group.type}`} className="mt-6">
            <h2
              id={`group-${group.type}`}
              className="mx-8 flex items-baseline justify-between border-b-2 pb-1 text-[13px] font-semibold"
              style={{ borderColor: `var(--state-${group.type})` }}
            >
              {group.name}
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {inGroup.length}
              </span>
            </h2>
            <ul className="divide-y divide-border">
              {inGroup.map((issue) => (
                <li key={issue._id}>
                  <IssueRow issue={issue} orgSlug={orgSlug} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
