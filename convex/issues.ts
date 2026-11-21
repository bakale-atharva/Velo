import {
  paginationOptsValidator,
  paginationResultValidator,
  type PaginationOptions,
  type PaginationResult,
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { loadCycle } from "./cycles";
import { assertFilter, issueFilter, matchesFilter, type IssueFilter } from "./issueFilters";
import { logActivity } from "./lib/activity";
import { requireMember, type MemberInfo } from "./lib/auth";
import { hasFeature } from "./lib/entitlements";
import { appError } from "./lib/errors";
import { cleanUpAfterRemoval, deleteIssueForGood } from "./lib/issueDeletion";
import {
  createIssue,
  issueValidator,
  loadIssue,
  moveIssue,
  toPublicIssue,
  updateIssue,
} from "./lib/issueOps";
import { requirePermission } from "./lib/permissions";
import { syncProjectCounts } from "./lib/projectCounts";
import { filterVisibleIssues, requireTeamAccess } from "./lib/teamAccess";
import { loadProject } from "./projects";

const MAX_STATES = 50;
const BOARD_COLUMN_SIZE = 200;
const MAX_SUB_ISSUES = 100;

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());

export const create = mutation({
  args: {
    teamId: v.id("teams"),
    title: v.string(),
    description: v.optional(v.string()),
    stateId: v.optional(v.id("workflowStates")),
    priority: v.optional(v.number()),
    assigneeId: v.optional(nullableString),
    labelIds: v.optional(v.array(v.id("labels"))),
    estimate: v.optional(nullableNumber),
    dueDate: v.optional(nullableNumber),
    parentId: v.optional(v.union(v.id("issues"), v.null())),
    projectId: v.optional(v.union(v.id("projects"), v.null())),
    cycleId: v.optional(v.union(v.id("cycles"), v.null())),
  },
  returns: v.object({ issueId: v.id("issues"), identifier: v.string() }),
  handler: async (ctx, { teamId, ...input }) => {
    const member = await requireMember(ctx);
    const team = await requireTeamAccess(ctx, member, teamId);
    const issue = await createIssue(ctx, member, team, input);
    if (await hasFeature(ctx, member.orgId, "ai_assistant")) {
      await ctx.scheduler.runAfter(0, internal.ai.suggestions.suggestForIssue, { issueId: issue._id });
    }
    return { issueId: issue._id, identifier: issue.identifier };
  },
});

/** An issue by its identifier, e.g. "ENG-12". */
export const get = query({
  // An identifier (ENG-12) or the issue's id.
  args: { identifier: v.string() },
  returns: issueValidator,
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const ref = args.identifier.trim();
    const issueId = ctx.db.normalizeId("issues", ref);
    const issue =
      issueId !== null
        ? await ctx.db.get("issues", issueId)
        : await ctx.db
            .query("issues")
            .withIndex("by_orgId_and_identifier", (q) =>
              q.eq("orgId", member.orgId).eq("identifier", ref.toUpperCase()),
            )
            .unique();
    if (issue === null || issue.orgId !== member.orgId) {
      throw appError("NOT_FOUND");
    }
    await requireTeamAccess(ctx, member, issue.teamId);
    return toPublicIssue(issue);
  },
});

/** `topLevel: true` leaves sub-issues out (they show on their parent's page). */
const topLevelArg = v.optional(v.boolean());

/** Drops sub-issues when only top-level issues were asked for. */
function keepTopLevel<I extends { parentId: Id<"issues"> | null }>(issues: I[], topLevel: boolean | undefined): I[] {
  return topLevel === true ? issues.filter((issue) => issue.parentId === null) : issues;
}

/** A team's open issues in one state by rank, optionally top-level only. */
function teamStateQuery(
  ctx: QueryCtx,
  teamId: Id<"teams">,
  stateId: Id<"workflowStates"> | undefined,
  topLevel: boolean | undefined,
) {
  const issues = ctx.db.query("issues");
  if (topLevel === true) {
    return issues.withIndex("by_teamId_and_archivedAt_and_parentId_and_stateId_and_rank", (q) => {
      const top = q.eq("teamId", teamId).eq("archivedAt", null).eq("parentId", null);
      return stateId === undefined ? top : top.eq("stateId", stateId);
    });
  }
  return issues.withIndex("by_teamId_and_archivedAt_and_stateId_and_rank", (q) => {
    const open = q.eq("teamId", teamId).eq("archivedAt", null);
    return stateId === undefined ? open : open.eq("stateId", stateId);
  });
}

/**
 * A team's open (not archived) issues, page by page, ordered by rank within
 * each state. Pass `stateId` to read a single state.
 */
export const listByTeam = query({
  args: {
    teamId: v.id("teams"),
    stateId: v.optional(v.id("workflowStates")),
    topLevel: topLevelArg,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(issueValidator),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const team = await requireTeamAccess(ctx, member, args.teamId);
    const result = await teamStateQuery(ctx, team._id, args.stateId, args.topLevel).paginate(
      args.paginationOpts,
    );
    return { ...result, page: result.page.map(toPublicIssue) };
  },
});

/**
 * One page of issues read through the most selective index the filter
 * allows: cycle, then project, then a single assignee, then team, else the
 * whole org. The other conditions are applied by the caller.
 */
async function pageForFilter(
  ctx: QueryCtx,
  member: MemberInfo,
  filter: IssueFilter,
  paginationOpts: PaginationOptions,
): Promise<PaginationResult<Doc<"issues">>> {
  const issues = ctx.db.query("issues");
  if (filter.cycleId !== undefined) {
    const { cycle } = await loadCycle(ctx, member, filter.cycleId);
    return await issues
      .withIndex("by_cycleId", (q) => q.eq("cycleId", cycle._id))
      .paginate(paginationOpts);
  }
  if (filter.projectId !== undefined) {
    const project = await loadProject(ctx, member, filter.projectId);
    return await issues
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .paginate(paginationOpts);
  }
  if (filter.assigneeIds !== undefined && filter.assigneeIds.length === 1) {
    const assigneeId = filter.assigneeIds[0];
    return await issues
      .withIndex("by_orgId_and_assigneeId", (q) =>
        q.eq("orgId", member.orgId).eq("assigneeId", assigneeId),
      )
      .paginate(paginationOpts);
  }
  const { teamId } = filter;
  return await issues
    .withIndex("by_orgId_and_teamId", (q) =>
      teamId === undefined
        ? q.eq("orgId", member.orgId)
        : q.eq("orgId", member.orgId).eq("teamId", teamId),
    )
    .paginate(paginationOpts);
}

/**
 * Open (not archived) issues of the org matching a filter, page by page.
 * Conditions the index cannot apply are applied to each page, so a page can
 * be shorter than asked; keep loading while `isDone` is false. Issues of
 * private teams the caller is not in are left out.
 */
export const listFiltered = query({
  args: { filter: issueFilter, topLevel: topLevelArg, paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(issueValidator),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const { filter } = args;
    assertFilter(filter);
    if (filter.teamId !== undefined) {
      await requireTeamAccess(ctx, member, filter.teamId);
    }
    const result = await pageForFilter(ctx, member, filter, args.paginationOpts);
    const matching = keepTopLevel(result.page, args.topLevel).filter(
      (issue) => issue.orgId === member.orgId && issue.archivedAt === null && matchesFilter(issue, filter),
    );
    const visible = await filterVisibleIssues(ctx, member, matching);
    return { ...result, page: visible.map(toPublicIssue) };
  },
});

const MY_ISSUES_LIMIT = 300;
// Order of state types on "My issues": work in flight first, finished last.
const STATE_ORDER: Record<Doc<"issues">["stateType"], number> = {
  started: 0,
  unstarted: 1,
  backlog: 2,
  completed: 3,
  canceled: 4,
};

/**
 * Issues assigned to the caller (up to 300, archived left out): open states
 * first, then by priority (urgent first, none last), newest first within that.
 */
export const listMine = query({
  args: {},
  returns: v.array(issueValidator),
  handler: async (ctx) => {
    const member = await requireMember(ctx);
    const assigned = await ctx.db
      .query("issues")
      .withIndex("by_orgId_and_assigneeId", (q) =>
        q.eq("orgId", member.orgId).eq("assigneeId", member.userId),
      )
      .order("desc")
      .take(MY_ISSUES_LIMIT);
    const open = assigned.filter((issue) => issue.archivedAt === null);
    const visible = await filterVisibleIssues(ctx, member, open);
    const priorityRank = (priority: number) => (priority === 0 ? 5 : priority);
    return visible
      .sort(
        (a, b) =>
          STATE_ORDER[a.stateType] - STATE_ORDER[b.stateType] ||
          priorityRank(a.priority) - priorityRank(b.priority) ||
          b._creationTime - a._creationTime,
      )
      .map(toPublicIssue);
  },
});

/** The board: every state of the team with its first 200 issues by rank. */
export const listForBoard = query({
  args: { teamId: v.id("teams"), topLevel: topLevelArg },
  returns: v.array(
    v.object({ stateId: v.id("workflowStates"), issues: v.array(issueValidator) }),
  ),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const team = await requireTeamAccess(ctx, member, args.teamId);
    const states = await ctx.db
      .query("workflowStates")
      .withIndex("by_teamId_and_position", (q) => q.eq("teamId", team._id))
      .take(MAX_STATES);
    return await Promise.all(
      states.map(async (state) => {
        const issues = await teamStateQuery(ctx, team._id, state._id, args.topLevel).take(
          BOARD_COLUMN_SIZE,
        );
        return { stateId: state._id, issues: issues.map(toPublicIssue) };
      }),
    );
  },
});

export const listSubIssues = query({
  args: { issueId: v.id("issues") },
  returns: v.array(issueValidator),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const { issue } = await loadIssue(ctx, member, args.issueId);
    // Sub-issues share the parent's team, so the parent's access check covers them.
    const children = await ctx.db
      .query("issues")
      .withIndex("by_parentId", (q) => q.eq("parentId", issue._id))
      .take(MAX_SUB_ISSUES);
    return children.filter((child) => child.archivedAt === null).map(toPublicIssue);
  },
});

/** Changes the given fields; fields left out stay as they are. */
export const update = mutation({
  args: {
    issueId: v.id("issues"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    stateId: v.optional(v.id("workflowStates")),
    priority: v.optional(v.number()),
    assigneeId: v.optional(nullableString),
    labelIds: v.optional(v.array(v.id("labels"))),
    estimate: v.optional(nullableNumber),
    dueDate: v.optional(nullableNumber),
    parentId: v.optional(v.union(v.id("issues"), v.null())),
    projectId: v.optional(v.union(v.id("projects"), v.null())),
    cycleId: v.optional(v.union(v.id("cycles"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, { issueId, ...input }) => {
    const member = await requireMember(ctx);
    const { issue, team } = await loadIssue(ctx, member, issueId);
    await updateIssue(ctx, member, team, issue, input);
    return null;
  },
});

/**
 * Board drag and drop: puts the issue in `stateId` between the issues ranked
 * `beforeRank` (above it) and `afterRank` (below it); null means column edge.
 */
export const move = mutation({
  args: {
    issueId: v.id("issues"),
    stateId: v.id("workflowStates"),
    beforeRank: nullableString,
    afterRank: nullableString,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const { issue, team } = await loadIssue(ctx, member, args.issueId);
    await moveIssue(ctx, member, team, issue, args.stateId, args.beforeRank, args.afterRank);
    return null;
  },
});

export const archive = mutation({
  args: { issueId: v.id("issues") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const { issue } = await loadIssue(ctx, member, args.issueId);
    if (issue.archivedAt === null) {
      const archivedAt = Date.now();
      await ctx.db.patch("issues", issue._id, { archivedAt });
      await syncProjectCounts(ctx, issue, { ...issue, archivedAt });
      await logActivity(ctx, {
        orgId: member.orgId,
        issueId: issue._id,
        actorId: member.userId,
        type: "archived",
      });
    }
    return null;
  },
});

export const continueCleanup = internalMutation({
  args: { issueId: v.id("issues") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (await cleanUpAfterRemoval(ctx, args.issueId)) {
      await ctx.scheduler.runAfter(0, internal.issues.continueCleanup, args);
    }
    return null;
  },
});

/**
 * Deletes an issue for good. Needs `issues.delete`.
 * Its comments and activity go with it; its sub-issues stay and lose their parent.
 */
export const remove = mutation({
  args: { issueId: v.id("issues") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requirePermission(ctx, "issues.delete");
    const { issue } = await loadIssue(ctx, member, args.issueId);
    await deleteIssueForGood(ctx, member, issue);
    return null;
  },
});
