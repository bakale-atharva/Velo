import { generateKeyBetween } from "fractional-indexing";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import schema from "../schema";
import type { MemberInfo } from "./auth";
import { appError } from "./errors";
import { cleanText } from "./input";
import { isTeamMember, requireTeamAccess } from "./teamAccess";

// Shared issue logic. Public functions in convex/issues.ts authenticate the
// caller and then call these; the assistant (B7) will reuse them.

type DbCtx = QueryCtx | MutationCtx;

const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 50_000;
const MAX_LABELS_PER_ISSUE = 20;
const MAX_PARENT_DEPTH = 20;
const MAX_STATES = 50;

/** An issue as returned to clients (without the search-only field). */
export const issueValidator = schema.doc("issues").omit("searchText");

export function toPublicIssue(issue: Doc<"issues">) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { searchText, ...rest } = issue;
  return rest;
}

/** Loads an issue the member may see, with its team. */
export async function loadIssue(
  ctx: DbCtx,
  member: MemberInfo,
  issueId: Id<"issues">,
): Promise<{ issue: Doc<"issues">; team: Doc<"teams"> }> {
  const issue = await ctx.db.get("issues", issueId);
  if (issue === null || issue.orgId !== member.orgId) {
    throw appError("NOT_FOUND");
  }
  const team = await requireTeamAccess(ctx, member, issue.teamId);
  return { issue, team };
}

function cleanDescription(value: string): string {
  if (value.length > MAX_DESCRIPTION_LENGTH) {
    throw appError("INVALID_INPUT");
  }
  return value;
}

function assertPriority(priority: number) {
  if (!Number.isInteger(priority) || priority < 0 || priority > 4) {
    throw appError("INVALID_INPUT");
  }
}

function assertEstimate(estimate: number | null) {
  if (estimate !== null && (!Number.isFinite(estimate) || estimate < 0)) {
    throw appError("INVALID_INPUT");
  }
}

function assertDueDate(dueDate: number | null) {
  if (dueDate !== null && !Number.isFinite(dueDate)) {
    throw appError("INVALID_INPUT");
  }
}

/** The state must belong to the issue's team. */
async function loadState(
  ctx: DbCtx,
  team: Doc<"teams">,
  stateId: Id<"workflowStates">,
): Promise<Doc<"workflowStates">> {
  const state = await ctx.db.get("workflowStates", stateId);
  if (state === null || state.orgId !== team.orgId) {
    throw appError("NOT_FOUND");
  }
  if (state.teamId !== team._id) {
    throw appError("INVALID_INPUT");
  }
  return state;
}

/** The first "unstarted" state, else the first "backlog", else the first. */
async function defaultState(
  ctx: DbCtx,
  team: Doc<"teams">,
): Promise<Doc<"workflowStates">> {
  const states = await ctx.db
    .query("workflowStates")
    .withIndex("by_teamId_and_position", (q) => q.eq("teamId", team._id))
    .take(MAX_STATES);
  const state =
    states.find((s) => s.type === "unstarted") ??
    states.find((s) => s.type === "backlog") ??
    states[0];
  if (state === undefined) {
    throw appError("INVALID_INPUT");
  }
  return state;
}

/** An assignee must be in the org, and in the team if the team is private. */
async function assertAssignee(ctx: DbCtx, team: Doc<"teams">, userId: string) {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_orgId_and_userId", (q) =>
      q.eq("orgId", team.orgId).eq("userId", userId),
    )
    .unique();
  if (membership === null) {
    throw appError("INVALID_INPUT");
  }
  if (team.isPrivate && !(await isTeamMember(ctx, team._id, userId))) {
    throw appError("INVALID_INPUT");
  }
}

async function cleanLabelIds(
  ctx: DbCtx,
  orgId: string,
  labelIds: Id<"labels">[],
): Promise<Id<"labels">[]> {
  const unique = [...new Set(labelIds)];
  if (unique.length > MAX_LABELS_PER_ISSUE) {
    throw appError("INVALID_INPUT");
  }
  for (const labelId of unique) {
    const label = await ctx.db.get("labels", labelId);
    if (label === null || label.orgId !== orgId) {
      throw appError("NOT_FOUND");
    }
  }
  return unique;
}

/**
 * A parent must be in the same team, and must not be the issue itself or one
 * of its descendants.
 */
async function loadParent(
  ctx: DbCtx,
  team: Doc<"teams">,
  issueId: Id<"issues"> | null,
  parentId: Id<"issues">,
): Promise<Doc<"issues">> {
  const parent = await ctx.db.get("issues", parentId);
  if (parent === null || parent.orgId !== team.orgId) {
    throw appError("NOT_FOUND");
  }
  if (parent.teamId !== team._id || parentId === issueId) {
    throw appError("INVALID_INPUT");
  }
  let ancestorId = parent.parentId;
  for (let depth = 0; ancestorId !== null; depth++) {
    if (ancestorId === issueId || depth >= MAX_PARENT_DEPTH) {
      throw appError("INVALID_INPUT");
    }
    const ancestor: Doc<"issues"> | null = await ctx.db.get("issues", ancestorId);
    ancestorId = ancestor === null ? null : ancestor.parentId;
  }
  return parent;
}

/** A rank after the last issue of a state column. */
async function rankAtEnd(
  ctx: DbCtx,
  teamId: Id<"teams">,
  stateId: Id<"workflowStates">,
): Promise<string> {
  const last = await ctx.db
    .query("issues")
    .withIndex("by_teamId_and_stateId_and_rank", (q) =>
      q.eq("teamId", teamId).eq("stateId", stateId),
    )
    .order("desc")
    .first();
  return generateKeyBetween(last === null ? null : last.rank, null);
}

/** A rank between two neighbours in a column (null = column edge). */
export function rankBetween(before: string | null, after: string | null): string {
  if (before !== null && after !== null && before >= after) {
    throw appError("INVALID_INPUT");
  }
  try {
    return generateKeyBetween(before, after);
  } catch {
    throw appError("INVALID_INPUT");
  }
}

/** `completedAt` is set while the issue sits in a "completed" state. */
function completedAtFor(
  issue: Doc<"issues"> | null,
  state: Doc<"workflowStates">,
): number | null {
  if (state.type !== "completed") {
    return null;
  }
  return issue?.completedAt ?? Date.now();
}

export type CreateIssueInput = {
  title: string;
  description?: string;
  stateId?: Id<"workflowStates">;
  priority?: number;
  assigneeId?: string | null;
  labelIds?: Id<"labels">[];
  estimate?: number | null;
  dueDate?: number | null;
  parentId?: Id<"issues"> | null;
};

/** Creates an issue in a team the member can access. */
export async function createIssue(
  ctx: MutationCtx,
  member: MemberInfo,
  team: Doc<"teams">,
  input: CreateIssueInput,
): Promise<Doc<"issues">> {
  if (team.archivedAt !== null) {
    throw appError("INVALID_INPUT");
  }
  const title = cleanText(input.title, MAX_TITLE_LENGTH);
  const description = cleanDescription(input.description ?? "");
  const priority = input.priority ?? 0;
  assertPriority(priority);
  const estimate = input.estimate ?? null;
  assertEstimate(estimate);
  const dueDate = input.dueDate ?? null;
  assertDueDate(dueDate);

  const state =
    input.stateId === undefined
      ? await defaultState(ctx, team)
      : await loadState(ctx, team, input.stateId);
  const assigneeId = input.assigneeId ?? null;
  if (assigneeId !== null) {
    await assertAssignee(ctx, team, assigneeId);
  }
  const labelIds = await cleanLabelIds(ctx, member.orgId, input.labelIds ?? []);
  const parentId = input.parentId ?? null;
  if (parentId !== null) {
    await loadParent(ctx, team, null, parentId);
  }

  // Reading and bumping the counter in one mutation keeps numbers sequential.
  const number = team.nextIssueNumber;
  await ctx.db.patch("teams", team._id, { nextIssueNumber: number + 1 });

  const issueId = await ctx.db.insert("issues", {
    orgId: member.orgId,
    teamId: team._id,
    number,
    identifier: `${team.key}-${number}`,
    title,
    description,
    stateId: state._id,
    stateType: state.type,
    priority,
    assigneeId,
    creatorId: member.userId,
    labelIds,
    estimate,
    parentId,
    rank: await rankAtEnd(ctx, team._id, state._id),
    dueDate,
    completedAt: completedAtFor(null, state),
    archivedAt: null,
    searchText: `${title}\n${description}`,
  });
  const issue = await ctx.db.get("issues", issueId);
  if (issue === null) {
    throw appError("NOT_FOUND");
  }
  return issue;
}

export type UpdateIssueInput = {
  title?: string;
  description?: string;
  stateId?: Id<"workflowStates">;
  priority?: number;
  assigneeId?: string | null;
  labelIds?: Id<"labels">[];
  estimate?: number | null;
  dueDate?: number | null;
  parentId?: Id<"issues"> | null;
};

/** Applies the given fields to an issue; fields left out stay as they are. */
export async function updateIssue(
  ctx: MutationCtx,
  member: MemberInfo,
  team: Doc<"teams">,
  issue: Doc<"issues">,
  input: UpdateIssueInput,
): Promise<void> {
  const patch: Partial<Doc<"issues">> = {};

  if (input.title !== undefined) {
    const title = cleanText(input.title, MAX_TITLE_LENGTH);
    if (title !== issue.title) {
      patch.title = title;
    }
  }
  if (input.description !== undefined) {
    const description = cleanDescription(input.description);
    if (description !== issue.description) {
      patch.description = description;
    }
  }
  if (input.stateId !== undefined && input.stateId !== issue.stateId) {
    const state = await loadState(ctx, team, input.stateId);
    patch.stateId = state._id;
    patch.stateType = state.type;
    patch.completedAt = completedAtFor(issue, state);
    patch.rank = await rankAtEnd(ctx, team._id, state._id);
  }
  if (input.priority !== undefined && input.priority !== issue.priority) {
    assertPriority(input.priority);
    patch.priority = input.priority;
  }
  if (input.assigneeId !== undefined && input.assigneeId !== issue.assigneeId) {
    if (input.assigneeId !== null) {
      await assertAssignee(ctx, team, input.assigneeId);
    }
    patch.assigneeId = input.assigneeId;
  }
  if (input.labelIds !== undefined) {
    const current = new Set(issue.labelIds);
    const next = new Set(input.labelIds);
    const same =
      next.size === current.size && [...next].every((id) => current.has(id));
    if (!same) {
      // Only labels being added are checked: the issue may still carry the
      // id of a label deleted since.
      const added = [...next].filter((id) => !current.has(id));
      await cleanLabelIds(ctx, member.orgId, added);
      if (next.size > MAX_LABELS_PER_ISSUE) {
        throw appError("INVALID_INPUT");
      }
      patch.labelIds = [...next];
    }
  }
  if (input.estimate !== undefined && input.estimate !== issue.estimate) {
    assertEstimate(input.estimate);
    patch.estimate = input.estimate;
  }
  if (input.dueDate !== undefined && input.dueDate !== issue.dueDate) {
    assertDueDate(input.dueDate);
    patch.dueDate = input.dueDate;
  }
  if (input.parentId !== undefined && input.parentId !== issue.parentId) {
    if (input.parentId !== null) {
      await loadParent(ctx, team, issue._id, input.parentId);
    }
    patch.parentId = input.parentId;
  }

  if (Object.keys(patch).length === 0) {
    return;
  }
  if (patch.title !== undefined || patch.description !== undefined) {
    patch.searchText = `${patch.title ?? issue.title}\n${
      patch.description ?? issue.description
    }`;
  }
  await ctx.db.patch("issues", issue._id, patch);
}

/** Moves an issue to a position in a state column (board drag and drop). */
export async function moveIssue(
  ctx: MutationCtx,
  team: Doc<"teams">,
  issue: Doc<"issues">,
  stateId: Id<"workflowStates">,
  beforeRank: string | null,
  afterRank: string | null,
): Promise<void> {
  const state = await loadState(ctx, team, stateId);
  const rank = rankBetween(beforeRank, afterRank);
  await ctx.db.patch("issues", issue._id, {
    stateId: state._id,
    stateType: state.type,
    completedAt: completedAtFor(issue, state),
    rank,
  });
}
