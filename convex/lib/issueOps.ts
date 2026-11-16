import { generateKeyBetween } from "fractional-indexing";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import schema from "../schema";
import { logActivity, type ActivityType } from "./activity";
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
  return { ...rest, projectId: issue.projectId ?? null };
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

const MAX_PROJECT_TEAMS = 50;

/**
 * The project an issue of `team` is being put in. The team joins the
 * project's teams if it is not one of them yet.
 */
async function loadProjectForIssue(
  ctx: MutationCtx,
  team: Doc<"teams">,
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const project = await ctx.db.get("projects", projectId);
  if (project === null || project.orgId !== team.orgId) {
    throw appError("NOT_FOUND");
  }
  if (!project.teamIds.includes(team._id)) {
    if (project.teamIds.length >= MAX_PROJECT_TEAMS) {
      throw appError("LIMIT_REACHED");
    }
    await ctx.db.patch("projects", project._id, {
      teamIds: [...project.teamIds, team._id],
    });
  }
  return project;
}

async function projectName(ctx: DbCtx, projectId: Id<"projects"> | null) {
  const project = projectId === null ? null : await ctx.db.get("projects", projectId);
  return project === null ? null : project.name;
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

/** Whether the assistant made the change on the member's behalf (B7). */
export type WriteOptions = { viaAssistant?: boolean };

async function stateName(ctx: DbCtx, stateId: Id<"workflowStates">) {
  const state = await ctx.db.get("workflowStates", stateId);
  return state === null ? null : state.name;
}

/** Label names for the activity log; labels deleted since are skipped. */
async function labelNames(ctx: DbCtx, labelIds: Id<"labels">[]) {
  const names: string[] = [];
  for (const labelId of labelIds) {
    const label = await ctx.db.get("labels", labelId);
    if (label !== null) {
      names.push(label.name);
    }
  }
  return names.length === 0 ? null : names.sort().join(", ");
}

async function issueIdentifier(ctx: DbCtx, issueId: Id<"issues"> | null) {
  const issue = issueId === null ? null : await ctx.db.get("issues", issueId);
  return issue === null ? null : issue.identifier;
}

const text = (value: number | null) => (value === null ? null : String(value));

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
  projectId?: Id<"projects"> | null;
};

/** Creates an issue in a team the member can access. */
export async function createIssue(
  ctx: MutationCtx,
  member: MemberInfo,
  team: Doc<"teams">,
  input: CreateIssueInput,
  options: WriteOptions = {},
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
  const projectId = input.projectId ?? null;
  if (projectId !== null) {
    await loadProjectForIssue(ctx, team, projectId);
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
    projectId,
    rank: await rankAtEnd(ctx, team._id, state._id),
    dueDate,
    completedAt: completedAtFor(null, state),
    archivedAt: null,
    searchText: `${title}\n${description}`,
  });
  await logActivity(ctx, {
    orgId: member.orgId,
    issueId,
    actorId: member.userId,
    viaAssistant: options.viaAssistant,
    type: "created",
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
  projectId?: Id<"projects"> | null;
};

/** Applies the given fields to an issue; fields left out stay as they are. */
export async function updateIssue(
  ctx: MutationCtx,
  member: MemberInfo,
  team: Doc<"teams">,
  issue: Doc<"issues">,
  input: UpdateIssueInput,
  options: WriteOptions = {},
): Promise<void> {
  const patch: Partial<Doc<"issues">> = {};
  // One activity per changed field.
  const changes: { type: ActivityType; from: string | null; to: string | null }[] = [];

  if (input.title !== undefined) {
    const title = cleanText(input.title, MAX_TITLE_LENGTH);
    if (title !== issue.title) {
      patch.title = title;
      changes.push({ type: "title", from: issue.title, to: title });
    }
  }
  if (input.description !== undefined) {
    const description = cleanDescription(input.description);
    if (description !== issue.description) {
      patch.description = description;
      // Bodies are long; the feed only says that the description changed.
      changes.push({ type: "description", from: null, to: null });
    }
  }
  if (input.stateId !== undefined && input.stateId !== issue.stateId) {
    const state = await loadState(ctx, team, input.stateId);
    patch.stateId = state._id;
    patch.stateType = state.type;
    patch.completedAt = completedAtFor(issue, state);
    patch.rank = await rankAtEnd(ctx, team._id, state._id);
    changes.push({
      type: "state",
      from: await stateName(ctx, issue.stateId),
      to: state.name,
    });
  }
  if (input.priority !== undefined && input.priority !== issue.priority) {
    assertPriority(input.priority);
    patch.priority = input.priority;
    changes.push({
      type: "priority",
      from: String(issue.priority),
      to: String(input.priority),
    });
  }
  if (input.assigneeId !== undefined && input.assigneeId !== issue.assigneeId) {
    if (input.assigneeId !== null) {
      await assertAssignee(ctx, team, input.assigneeId);
    }
    patch.assigneeId = input.assigneeId;
    changes.push({ type: "assignee", from: issue.assigneeId, to: input.assigneeId });
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
      changes.push({
        type: "labels",
        from: await labelNames(ctx, issue.labelIds),
        to: await labelNames(ctx, patch.labelIds),
      });
    }
  }
  if (input.estimate !== undefined && input.estimate !== issue.estimate) {
    assertEstimate(input.estimate);
    patch.estimate = input.estimate;
    changes.push({
      type: "estimate",
      from: text(issue.estimate),
      to: text(input.estimate),
    });
  }
  if (input.dueDate !== undefined && input.dueDate !== issue.dueDate) {
    assertDueDate(input.dueDate);
    patch.dueDate = input.dueDate;
    changes.push({ type: "dueDate", from: text(issue.dueDate), to: text(input.dueDate) });
  }
  if (input.parentId !== undefined && input.parentId !== issue.parentId) {
    if (input.parentId !== null) {
      await loadParent(ctx, team, issue._id, input.parentId);
    }
    patch.parentId = input.parentId;
    changes.push({
      type: "parent",
      from: await issueIdentifier(ctx, issue.parentId),
      to: await issueIdentifier(ctx, input.parentId),
    });
  }
  const currentProjectId = issue.projectId ?? null;
  if (input.projectId !== undefined && input.projectId !== currentProjectId) {
    const project =
      input.projectId === null
        ? null
        : await loadProjectForIssue(ctx, team, input.projectId);
    patch.projectId = input.projectId;
    changes.push({
      type: "project",
      from: await projectName(ctx, currentProjectId),
      to: project === null ? null : project.name,
    });
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
  for (const change of changes) {
    await logActivity(ctx, {
      orgId: member.orgId,
      issueId: issue._id,
      actorId: member.userId,
      viaAssistant: options.viaAssistant,
      ...change,
    });
  }
}

/** Moves an issue to a position in a state column (board drag and drop). */
export async function moveIssue(
  ctx: MutationCtx,
  member: MemberInfo,
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
  // Reordering inside a column is not a change worth a feed entry.
  if (state._id !== issue.stateId) {
    await logActivity(ctx, {
      orgId: member.orgId,
      issueId: issue._id,
      actorId: member.userId,
      type: "state",
      from: await stateName(ctx, issue.stateId),
      to: state.name,
    });
  }
}
