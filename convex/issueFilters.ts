import { v, type Infer } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { appError } from "./lib/errors";
import { stateType } from "./schema";

// The filter shared by issue lists, saved views (`savedViews.filter`) and the
// command palette. Every field narrows the result; fields left out match all.
// `assigneeIds` may include null for "unassigned".

export const issueFilter = v.object({
  teamId: v.optional(v.id("teams")),
  stateTypes: v.optional(v.array(stateType)),
  stateIds: v.optional(v.array(v.id("workflowStates"))),
  assigneeIds: v.optional(v.array(v.union(v.string(), v.null()))),
  labelIds: v.optional(v.array(v.id("labels"))),
  priorities: v.optional(v.array(v.number())),
  projectId: v.optional(v.id("projects")),
  cycleId: v.optional(v.id("cycles")),
  creatorId: v.optional(v.string()),
});

export type IssueFilter = Infer<typeof issueFilter>;

const MAX_VALUES = 50;

/** Refuses filters with oversized value lists. */
export function assertFilter(filter: IssueFilter) {
  const lists = [
    filter.stateTypes,
    filter.stateIds,
    filter.assigneeIds,
    filter.labelIds,
    filter.priorities,
  ];
  if (lists.some((list) => list !== undefined && list.length > MAX_VALUES)) {
    throw appError("INVALID_INPUT");
  }
}

function within<T>(values: T[] | undefined, value: T): boolean {
  return values === undefined || values.length === 0 || values.includes(value);
}

/** Whether an issue passes every condition of the filter. */
export function matchesFilter(issue: Doc<"issues">, filter: IssueFilter): boolean {
  return (
    (filter.teamId === undefined || issue.teamId === filter.teamId) &&
    within(filter.stateTypes, issue.stateType) &&
    within(filter.stateIds, issue.stateId) &&
    within(filter.assigneeIds, issue.assigneeId) &&
    within(filter.priorities, issue.priority) &&
    (filter.labelIds === undefined ||
      filter.labelIds.length === 0 ||
      filter.labelIds.some((id) => issue.labelIds.includes(id))) &&
    (filter.projectId === undefined || (issue.projectId ?? null) === filter.projectId) &&
    (filter.cycleId === undefined || (issue.cycleId ?? null) === filter.cycleId) &&
    (filter.creatorId === undefined || issue.creatorId === filter.creatorId)
  );
}
