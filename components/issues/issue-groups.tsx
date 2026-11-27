"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import { GROUP_PANEL } from "./issue-list";
import { IssueTreeList } from "./issue-tree";
import { StateHeading } from "./state-heading";

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
export function IssueGroups({
  issues,
  orgSlug,
  showDue = false,
}: {
  issues: Issue[];
  orgSlug: string;
  /** Keep each row's due date visible at every width. */
  showDue?: boolean;
}) {
  return (
    <>
      {GROUPS.map((group) => {
        const inGroup = issues.filter((issue) => issue.stateType === group.type);
        if (inGroup.length === 0) return null;
        return (
          <section key={group.type} aria-labelledby={`group-${group.type}`} className={GROUP_PANEL}>
            <div className="px-3 pt-5 pb-2 @3xl/main:px-6">
              <StateHeading
                id={`group-${group.type}`}
                name={group.name}
                count={inGroup.length}
                type={group.type}
              />
            </div>
            <IssueTreeList issues={inGroup} orgSlug={orgSlug} showDue={showDue} />
          </section>
        );
      })}
    </>
  );
}
