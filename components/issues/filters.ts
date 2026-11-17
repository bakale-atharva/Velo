"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { IssueFilter } from "@/convex/issueFilters";

export type { IssueFilter };
export type StateType = NonNullable<IssueFilter["stateTypes"]>[number];

// The filter lives in the query string so a filtered list can be shared,
// reloaded and saved as a view:
//   ?state=started,unstarted&assignee=user_1,none&priority=1,2
//   &label=<id>,<id>&project=<id>&cycle=<id>
// "none" in `assignee` means unassigned. The team comes from the page, so
// it is never in the URL.

const STATE_TYPES: StateType[] = ["backlog", "unstarted", "started", "completed", "canceled"];
const KEYS = ["state", "assignee", "priority", "label", "project", "cycle"] as const;

function list(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  return raw === null || raw === "" ? [] : raw.split(",").filter(Boolean);
}

/** The filter in a query string; fields that are absent stay undefined. */
export function parseFilter(params: URLSearchParams): IssueFilter {
  const filter: IssueFilter = {};
  const states = list(params, "state").filter((s): s is StateType =>
    STATE_TYPES.includes(s as StateType),
  );
  if (states.length > 0) filter.stateTypes = states;
  const assignees = list(params, "assignee").map((a) => (a === "none" ? null : a));
  if (assignees.length > 0) filter.assigneeIds = assignees;
  const priorities = list(params, "priority")
    .map(Number)
    .filter((p) => Number.isInteger(p) && p >= 0 && p <= 4);
  if (priorities.length > 0) filter.priorities = priorities;
  const labels = list(params, "label") as Id<"labels">[];
  if (labels.length > 0) filter.labelIds = labels;
  const project = params.get("project");
  if (project) filter.projectId = project as Id<"projects">;
  const cycle = params.get("cycle");
  if (cycle) filter.cycleId = cycle as Id<"cycles">;
  return filter;
}

/** Writes the filter into `params`, replacing any filter keys already there. */
export function writeFilter(params: URLSearchParams, filter: IssueFilter): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of KEYS) next.delete(key);
  const put = (key: string, values: readonly unknown[] | undefined) => {
    if (values !== undefined && values.length > 0) next.set(key, values.join(","));
  };
  put("state", filter.stateTypes);
  put("assignee", filter.assigneeIds?.map((a) => a ?? "none"));
  put("priority", filter.priorities);
  put("label", filter.labelIds);
  if (filter.projectId !== undefined) next.set("project", filter.projectId);
  if (filter.cycleId !== undefined) next.set("cycle", filter.cycleId);
  return next;
}

/** How many filter fields narrow the list (the team doesn't count). */
export function activeCount(filter: IssueFilter): number {
  return [
    filter.stateTypes?.length,
    filter.assigneeIds?.length,
    filter.priorities?.length,
    filter.labelIds?.length,
    filter.projectId === undefined ? 0 : 1,
    filter.cycleId === undefined ? 0 : 1,
    filter.creatorId === undefined ? 0 : 1,
  ].filter((n) => n !== undefined && n > 0).length;
}

/** The filter in the current URL, and a setter that rewrites the URL. */
export function useIssueFilter(): [IssueFilter, (filter: IssueFilter) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const key = params.toString();
  const filter = useMemo(() => parseFilter(new URLSearchParams(key)), [key]);
  const setFilter = useCallback(
    (next: IssueFilter) => {
      const query = writeFilter(new URLSearchParams(key), next).toString();
      router.replace(query === "" ? pathname : `${pathname}?${query}`, { scroll: false });
    },
    [key, pathname, router],
  );
  return [filter, setFilter];
}
