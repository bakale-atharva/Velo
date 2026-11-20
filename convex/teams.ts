import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { logAudit } from "./lib/audit";
import { requireAdmin, requireMember } from "./lib/auth";
import { requireFeature } from "./lib/entitlements";
import { appError } from "./lib/errors";
import { cleanText } from "./lib/input";
import { requirePermission } from "./lib/permissions";
import { syncProjectCounts } from "./lib/projectCounts";
import { canAccessTeam, isTeamMember, requireTeamAccess } from "./lib/teamAccess";
import schema from "./schema";

// Managing teams needs the `teams.manage` permission (admins, and members
// whose custom role grants it).

const MAX_TEAMS = 200;
const MAX_TEAM_MEMBERS = 500;
const MAX_NAME_LENGTH = 80;

export const DEFAULT_STATES = [
  { name: "Backlog", type: "backlog", color: "#8b8f98" },
  { name: "Todo", type: "unstarted", color: "#c4c7cc" },
  { name: "In Progress", type: "started", color: "#e0a526" },
  { name: "Done", type: "completed", color: "#4c9f70" },
  { name: "Canceled", type: "canceled", color: "#6b6f76" },
] as const;

const teamValidator = schema.doc("teams");

async function addTeamMember(
  ctx: MutationCtx,
  orgId: string,
  teamId: Id<"teams">,
  userId: string,
) {
  if (!(await isTeamMember(ctx, teamId, userId))) {
    await ctx.db.insert("teamMembers", { orgId, teamId, userId });
  }
}

/** Creates a team with the five default workflow states. */
export const create = mutation({
  args: {
    name: v.string(),
    key: v.string(),
    isPrivate: v.optional(v.boolean()),
  },
  returns: v.id("teams"),
  handler: async (ctx, args) => {
    const member = await requirePermission(ctx, "teams.manage");
    const { orgId, userId } = member;
    const name = cleanText(args.name, MAX_NAME_LENGTH);
    if (!/^[A-Z]{2,5}$/.test(args.key)) {
      throw appError("INVALID_INPUT");
    }
    const isPrivate = args.isPrivate ?? false;
    if (isPrivate) {
      await requireFeature(ctx, orgId, "private_teams");
    }
    const sameKey = await ctx.db
      .query("teams")
      .withIndex("by_orgId_and_key", (q) => q.eq("orgId", orgId).eq("key", args.key))
      .unique();
    if (sameKey !== null) {
      throw appError("INVALID_INPUT");
    }
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .take(MAX_TEAMS);
    if (existing.length >= MAX_TEAMS) {
      throw appError("LIMIT_REACHED");
    }

    const teamId = await ctx.db.insert("teams", {
      orgId,
      name,
      key: args.key,
      isPrivate,
      nextIssueNumber: 1,
      archivedAt: null,
    });
    for (const [position, state] of DEFAULT_STATES.entries()) {
      await ctx.db.insert("workflowStates", { orgId, teamId, position, ...state });
    }
    await ctx.db.insert("teamMembers", { orgId, teamId, userId });
    await logAudit(ctx, member, {
      action: "team.created",
      targetType: "team",
      targetId: teamId,
      metadata: { name, key: args.key, isPrivate: String(isPrivate) },
    });
    return teamId;
  },
});

/** Teams of the active org the caller may see, oldest first. */
export const list = query({
  args: { includeArchived: v.optional(v.boolean()) },
  returns: v.array(teamValidator),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_orgId", (q) => q.eq("orgId", member.orgId))
      .take(MAX_TEAMS);
    const mine = await ctx.db
      .query("teamMembers")
      .withIndex("by_orgId_and_userId", (q) =>
        q.eq("orgId", member.orgId).eq("userId", member.userId),
      )
      .take(MAX_TEAMS);
    const myTeamIds = new Set(mine.map((row) => row.teamId));
    return teams.filter(
      (team) =>
        team.deletingAt == null &&
        (!team.isPrivate || myTeamIds.has(team._id)) &&
        (args.includeArchived === true || team.archivedAt === null),
    );
  },
});

/** A team by its key, e.g. "ENG". */
export const get = query({
  args: { key: v.string() },
  returns: teamValidator,
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const team = await ctx.db
      .query("teams")
      .withIndex("by_orgId_and_key", (q) =>
        q.eq("orgId", member.orgId).eq("key", args.key),
      )
      .unique();
    if (team === null || !(await canAccessTeam(ctx, member, team))) {
      throw appError("NOT_FOUND");
    }
    return team;
  },
});

/** Renames a team or changes its privacy. The key never changes. */
export const update = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    isPrivate: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requirePermission(ctx, "teams.manage");
    const team = await requireTeamAccess(ctx, member, args.teamId);
    const name =
      args.name === undefined ? team.name : cleanText(args.name, MAX_NAME_LENGTH);
    const isPrivate = args.isPrivate ?? team.isPrivate;
    if (isPrivate && !team.isPrivate) {
      await requireFeature(ctx, member.orgId, "private_teams");
      // Keep the admin who locks the team inside it.
      await addTeamMember(ctx, member.orgId, team._id, member.userId);
    }
    await ctx.db.patch("teams", team._id, { name, isPrivate });
    if (name !== team.name || isPrivate !== team.isPrivate) {
      await logAudit(ctx, member, {
        action: "team.updated",
        targetType: "team",
        targetId: team._id,
        metadata: { name, isPrivate: String(isPrivate) },
      });
    }
    return null;
  },
});

export const archive = mutation({
  args: { teamId: v.id("teams") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requirePermission(ctx, "teams.manage");
    const team = await requireTeamAccess(ctx, member, args.teamId);
    if (team.archivedAt === null) {
      await ctx.db.patch("teams", team._id, { archivedAt: Date.now() });
      await logAudit(ctx, member, {
        action: "team.archived",
        targetType: "team",
        targetId: team._id,
        metadata: { name: team.name },
      });
    }
    return null;
  },
});

/** Brings an archived team back to the sidebar; it takes new issues again. */
export const unarchive = mutation({
  args: { teamId: v.id("teams") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requirePermission(ctx, "teams.manage");
    const team = await requireTeamAccess(ctx, member, args.teamId);
    if (team.archivedAt !== null) {
      await ctx.db.patch("teams", team._id, { archivedAt: null });
      await logAudit(ctx, member, {
        action: "team.unarchived",
        targetType: "team",
        targetId: team._id,
        metadata: { name: team.name },
      });
    }
    return null;
  },
});

// Rows removed per scheduled step of a team deletion. Each issue also takes
// its comments, activities, suggestions and embedding with it.
const DELETE_ISSUES_PER_STEP = 25;
const DELETE_ROWS_PER_STEP = 200;
const MAX_ROWS_PER_ISSUE = 500;
const MAX_PROJECTS = 500;
const MAX_VIEWS = 1000;

/**
 * Permanently deletes an archived team and everything in it: issues with
 * their comments, activity and AI data, cycles, workflow states and
 * memberships. Saved views filtered to the team are deleted; projects lose
 * the team. Org admins only, and the caller must type the team key. The team
 * disappears at once; a scheduled job removes the rows in batches.
 */
export const remove = mutation({
  args: { teamId: v.id("teams"), confirmKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireAdmin(ctx);
    const team = await requireTeamAccess(ctx, member, args.teamId);
    if (team.archivedAt === null || args.confirmKey.trim() !== team.key) {
      throw appError("INVALID_INPUT");
    }
    await ctx.db.patch("teams", team._id, { deletingAt: Date.now() });
    await logAudit(ctx, member, {
      action: "team.deleted",
      targetType: "team",
      targetId: team._id,
      metadata: { name: team.name, key: team.key },
    });
    await ctx.scheduler.runAfter(0, internal.teams.deleteStep, { teamId: team._id });
    return null;
  },
});

/** Deletes the given rows of one table and returns how many. */
async function deleteSome<Table extends TableNames>(
  ctx: MutationCtx,
  rows: Doc<Table>[],
  table: Table,
) {
  for (const row of rows) {
    await ctx.db.delete(table, row._id);
  }
  return rows.length;
}

/**
 * One step of a team deletion. Works through the team's issues first, then
 * its cycles, states and memberships, then views and projects, then the team.
 * Schedules itself again until nothing is left.
 */
export const deleteStep = internalMutation({
  args: { teamId: v.id("teams") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const team = await ctx.db.get("teams", args.teamId);
    if (team === null || team.deletingAt == null) {
      return null;
    }
    const again = () => ctx.scheduler.runAfter(0, internal.teams.deleteStep, { teamId: team._id });

    // 1. Issues and the rows that hang off each one.
    const issues = await ctx.db
      .query("issues")
      .withIndex("by_orgId_and_teamId", (q) => q.eq("orgId", team.orgId).eq("teamId", team._id))
      .take(DELETE_ISSUES_PER_STEP);
    if (issues.length > 0) {
      for (const issue of issues) {
        const comments = await ctx.db
          .query("comments")
          .withIndex("by_issueId", (q) => q.eq("issueId", issue._id))
          .take(MAX_ROWS_PER_ISSUE);
        const activities = await ctx.db
          .query("activities")
          .withIndex("by_issueId", (q) => q.eq("issueId", issue._id))
          .take(MAX_ROWS_PER_ISSUE);
        const suggestions = await ctx.db
          .query("aiSuggestions")
          .withIndex("by_issueId", (q) => q.eq("issueId", issue._id))
          .take(MAX_ROWS_PER_ISSUE);
        const embeddings = await ctx.db
          .query("issueEmbeddings")
          .withIndex("by_issueId", (q) => q.eq("issueId", issue._id))
          .take(MAX_ROWS_PER_ISSUE);
        // Sub-issues in other teams keep living; they just lose their parent.
        const children = await ctx.db
          .query("issues")
          .withIndex("by_parentId", (q) => q.eq("parentId", issue._id))
          .take(MAX_ROWS_PER_ISSUE);
        for (const child of children) {
          if (child.teamId !== team._id) {
            await ctx.db.patch("issues", child._id, { parentId: null });
          }
        }
        await deleteSome(ctx, comments, "comments");
        await deleteSome(ctx, activities, "activities");
        await deleteSome(ctx, suggestions, "aiSuggestions");
        await deleteSome(ctx, embeddings, "issueEmbeddings");
        const full = [comments, activities, suggestions, embeddings, children].some(
          (rows) => rows.length === MAX_ROWS_PER_ISSUE,
        );
        // An issue with more rows than one step holds is finished next step.
        if (!full) {
          await ctx.db.delete("issues", issue._id);
          await syncProjectCounts(ctx, issue, null);
        }
      }
      await again();
      return null;
    }

    // 2. Cycles, workflow states and team memberships.
    const cycles = await ctx.db
      .query("cycles")
      .withIndex("by_teamId_and_number", (q) => q.eq("teamId", team._id))
      .take(DELETE_ROWS_PER_STEP);
    const states = await ctx.db
      .query("workflowStates")
      .withIndex("by_teamId_and_position", (q) => q.eq("teamId", team._id))
      .take(DELETE_ROWS_PER_STEP);
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId_and_userId", (q) => q.eq("teamId", team._id))
      .take(DELETE_ROWS_PER_STEP);
    const removed =
      (await deleteSome(ctx, cycles, "cycles")) +
      (await deleteSome(ctx, states, "workflowStates")) +
      (await deleteSome(ctx, members, "teamMembers"));
    if (removed > 0) {
      await again();
      return null;
    }

    // 3. Views filtered to the team, and the team's place in projects.
    const views = await ctx.db
      .query("savedViews")
      .withIndex("by_orgId_and_isShared", (q) => q.eq("orgId", team.orgId))
      .take(MAX_VIEWS);
    for (const view of views) {
      if (view.filter.teamId === team._id) {
        await ctx.db.delete("savedViews", view._id);
      }
    }
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_orgId", (q) => q.eq("orgId", team.orgId))
      .take(MAX_PROJECTS);
    for (const project of projects) {
      if (project.teamIds.includes(team._id)) {
        await ctx.db.patch("projects", project._id, {
          teamIds: project.teamIds.filter((id) => id !== team._id),
        });
      }
    }

    // 4. The team itself; its key is free again.
    await ctx.db.delete("teams", team._id);
    return null;
  },
});

/** User ids of a team's members. */
export const listMembers = query({
  args: { teamId: v.id("teams") },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const team = await requireTeamAccess(ctx, member, args.teamId);
    const rows = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId_and_userId", (q) => q.eq("teamId", team._id))
      .take(MAX_TEAM_MEMBERS);
    return rows.map((row) => row.userId);
  },
});

export const addMember = mutation({
  args: { teamId: v.id("teams"), userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requirePermission(ctx, "teams.manage");
    const team = await requireTeamAccess(ctx, member, args.teamId);
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_orgId_and_userId", (q) =>
        q.eq("orgId", member.orgId).eq("userId", args.userId),
      )
      .unique();
    if (membership === null) {
      throw appError("NOT_FOUND");
    }
    await addTeamMember(ctx, member.orgId, team._id, args.userId);
    await logAudit(ctx, member, {
      action: "team.member_added",
      targetType: "team",
      targetId: team._id,
      metadata: { userId: args.userId },
    });
    return null;
  },
});

export const removeMember = mutation({
  args: { teamId: v.id("teams"), userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requirePermission(ctx, "teams.manage");
    const team = await requireTeamAccess(ctx, member, args.teamId);
    const row = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId_and_userId", (q) =>
        q.eq("teamId", team._id).eq("userId", args.userId),
      )
      .unique();
    if (row === null) {
      return null;
    }
    if (team.isPrivate) {
      // A private team with no members could never be opened again.
      const members = await ctx.db
        .query("teamMembers")
        .withIndex("by_teamId_and_userId", (q) => q.eq("teamId", team._id))
        .take(2);
      if (members.length < 2) {
        throw appError("INVALID_INPUT");
      }
    }
    await ctx.db.delete("teamMembers", row._id);
    await logAudit(ctx, member, {
      action: "team.member_removed",
      targetType: "team",
      targetId: team._id,
      metadata: { userId: args.userId },
    });
    return null;
  },
});
