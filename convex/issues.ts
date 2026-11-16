import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { requireAdmin, requireMember } from "./lib/auth";
import { appError } from "./lib/errors";
import {
  createIssue,
  issueValidator,
  loadIssue,
  moveIssue,
  toPublicIssue,
  updateIssue,
} from "./lib/issueOps";
import { syncProjectCounts } from "./lib/projectCounts";
import { requireTeamAccess } from "./lib/teamAccess";

const MAX_STATES = 50;
const BOARD_COLUMN_SIZE = 200;
const MAX_SUB_ISSUES = 100;
const CLEANUP_BATCH = 100;

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
  },
  returns: v.object({ issueId: v.id("issues"), identifier: v.string() }),
  handler: async (ctx, { teamId, ...input }) => {
    const member = await requireMember(ctx);
    const team = await requireTeamAccess(ctx, member, teamId);
    const issue = await createIssue(ctx, member, team, input);
    return { issueId: issue._id, identifier: issue.identifier };
  },
});

/** An issue by its identifier, e.g. "ENG-12". */
export const get = query({
  args: { identifier: v.string() },
  returns: issueValidator,
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const issue = await ctx.db
      .query("issues")
      .withIndex("by_orgId_and_identifier", (q) =>
        q.eq("orgId", member.orgId).eq("identifier", args.identifier),
      )
      .unique();
    if (issue === null) {
      throw appError("NOT_FOUND");
    }
    await requireTeamAccess(ctx, member, issue.teamId);
    return toPublicIssue(issue);
  },
});

/**
 * A team's open (not archived) issues, page by page, ordered by rank within
 * each state. Pass `stateId` to read a single state.
 */
export const listByTeam = query({
  args: {
    teamId: v.id("teams"),
    stateId: v.optional(v.id("workflowStates")),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(issueValidator),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const team = await requireTeamAccess(ctx, member, args.teamId);
    const { stateId } = args;
    const result = await ctx.db
      .query("issues")
      .withIndex("by_teamId_and_stateId_and_rank", (q) =>
        stateId === undefined
          ? q.eq("teamId", team._id)
          : q.eq("teamId", team._id).eq("stateId", stateId),
      )
      // The index narrows to the team (and state); archived rows are a small
      // remainder dropped here so pages stay paginated by the database.
      .filter((q) => q.eq(q.field("archivedAt"), null))
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(toPublicIssue) };
  },
});

/** The board: every state of the team with its first 200 issues by rank. */
export const listForBoard = query({
  args: { teamId: v.id("teams") },
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
        const issues = await ctx.db
          .query("issues")
          .withIndex("by_teamId_and_stateId_and_rank", (q) =>
            q.eq("teamId", team._id).eq("stateId", state._id),
          )
          .filter((q) => q.eq(q.field("archivedAt"), null))
          .take(BOARD_COLUMN_SIZE);
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

/**
 * Detaches or deletes what pointed at a deleted issue, one batch per table. Returns
 * whether anything may be left.
 */
async function cleanUpAfterRemoval(
  ctx: MutationCtx,
  issueId: Id<"issues">,
): Promise<boolean> {
  const children = await ctx.db
    .query("issues")
    .withIndex("by_parentId", (q) => q.eq("parentId", issueId))
    .take(CLEANUP_BATCH);
  for (const child of children) {
    await ctx.db.patch("issues", child._id, { parentId: null });
  }
  const comments = await ctx.db
    .query("comments")
    .withIndex("by_issueId", (q) => q.eq("issueId", issueId))
    .take(CLEANUP_BATCH);
  for (const comment of comments) {
    await ctx.db.delete("comments", comment._id);
  }
  const activities = await ctx.db
    .query("activities")
    .withIndex("by_issueId", (q) => q.eq("issueId", issueId))
    .take(CLEANUP_BATCH);
  for (const activity of activities) {
    await ctx.db.delete("activities", activity._id);
  }
  return [children, comments, activities].some((rows) => rows.length === CLEANUP_BATCH);
}

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
 * Deletes an issue for good. Needs `issues.delete`: admins only until B6.
 * Its comments and activity go with it; its sub-issues stay and lose their parent.
 */
export const remove = mutation({
  args: { issueId: v.id("issues") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireAdmin(ctx);
    const { issue } = await loadIssue(ctx, member, args.issueId);
    await ctx.db.delete("issues", issue._id);
    await syncProjectCounts(ctx, issue, null);
    if (await cleanUpAfterRemoval(ctx, issue._id)) {
      await ctx.scheduler.runAfter(0, internal.issues.continueCleanup, {
        issueId: issue._id,
      });
    }
    return null;
  },
});
