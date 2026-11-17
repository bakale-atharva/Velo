import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { logAudit } from "./lib/audit";
import { requireMember, type MemberInfo } from "./lib/auth";
import { appError } from "./lib/errors";
import { cleanText } from "./lib/input";
import { issueValidator, toPublicIssue } from "./lib/issueOps";
import { requirePermission } from "./lib/permissions";
import { filterVisibleIssues, withVisibleTeams } from "./lib/teamAccess";
import schema, { projectStatus } from "./schema";

// Changing projects needs `projects.manage`, which members have by default
// (a custom role can take it away).

const MAX_PROJECTS = 500;
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 50_000;
const DETACH_BATCH = 100;

const projectValidator = schema.doc("projects");
const nullableNumber = v.union(v.number(), v.null());

type DbCtx = QueryCtx | MutationCtx;

/** Loads a project of the member's org. */
export async function loadProject(
  ctx: DbCtx,
  member: MemberInfo,
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const project = await ctx.db.get("projects", projectId);
  if (project === null || project.orgId !== member.orgId) {
    throw appError("NOT_FOUND");
  }
  return project;
}

function cleanDescription(value: string): string {
  if (value.length > MAX_DESCRIPTION_LENGTH) {
    throw appError("INVALID_INPUT");
  }
  return value;
}

/** A lead must be a member of the org. */
async function assertLead(ctx: DbCtx, orgId: string, userId: string) {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_orgId_and_userId", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .unique();
  if (membership === null) {
    throw appError("INVALID_INPUT");
  }
}

function assertDates(startDate: number | null, targetDate: number | null) {
  for (const date of [startDate, targetDate]) {
    if (date !== null && !Number.isFinite(date)) {
      throw appError("INVALID_INPUT");
    }
  }
  if (startDate !== null && targetDate !== null && targetDate < startDate) {
    throw appError("INVALID_INPUT");
  }
}

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    status: v.optional(projectStatus),
    leadId: v.optional(v.union(v.string(), v.null())),
    startDate: v.optional(nullableNumber),
    targetDate: v.optional(nullableNumber),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const { orgId } = await requirePermission(ctx, "projects.manage");
    const name = cleanText(args.name, MAX_NAME_LENGTH);
    const description = cleanDescription(args.description ?? "");
    const leadId = args.leadId ?? null;
    if (leadId !== null) {
      await assertLead(ctx, orgId, leadId);
    }
    const startDate = args.startDate ?? null;
    const targetDate = args.targetDate ?? null;
    assertDates(startDate, targetDate);
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .take(MAX_PROJECTS);
    if (existing.length >= MAX_PROJECTS) {
      throw appError("LIMIT_REACHED");
    }
    return await ctx.db.insert("projects", {
      orgId,
      name,
      description,
      status: args.status ?? "planned",
      leadId,
      teamIds: [],
      startDate,
      targetDate,
      issueCount: 0,
      completedIssueCount: 0,
    });
  },
});

/** Changes the given fields; fields left out stay as they are. */
export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(projectStatus),
    leadId: v.optional(v.union(v.string(), v.null())),
    startDate: v.optional(nullableNumber),
    targetDate: v.optional(nullableNumber),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requirePermission(ctx, "projects.manage");
    const project = await loadProject(ctx, member, args.projectId);
    const leadId = args.leadId === undefined ? project.leadId : args.leadId;
    if (leadId !== null && leadId !== project.leadId) {
      await assertLead(ctx, member.orgId, leadId);
    }
    const startDate = args.startDate === undefined ? project.startDate : args.startDate;
    const targetDate = args.targetDate === undefined ? project.targetDate : args.targetDate;
    assertDates(startDate, targetDate);
    await ctx.db.patch("projects", project._id, {
      name: args.name === undefined ? project.name : cleanText(args.name, MAX_NAME_LENGTH),
      description:
        args.description === undefined
          ? project.description
          : cleanDescription(args.description),
      status: args.status ?? project.status,
      leadId,
      startDate,
      targetDate,
    });
    return null;
  },
});

/** Takes up to one batch of issues out of a deleted project. */
async function detachIssues(ctx: MutationCtx, projectId: Id<"projects">): Promise<boolean> {
  const issues = await ctx.db
    .query("issues")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
    .take(DETACH_BATCH);
  for (const issue of issues) {
    await ctx.db.patch("issues", issue._id, { projectId: null });
  }
  return issues.length === DETACH_BATCH;
}

export const continueDetach = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (await detachIssues(ctx, args.projectId)) {
      await ctx.scheduler.runAfter(0, internal.projects.continueDetach, args);
    }
    return null;
  },
});

/** Deletes a project. Its issues stay and lose their project. */
export const remove = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requirePermission(ctx, "projects.manage");
    const project = await loadProject(ctx, member, args.projectId);
    await ctx.db.delete("projects", project._id);
    await logAudit(ctx, member, {
      action: "project.deleted",
      targetType: "project",
      targetId: project._id,
      metadata: { name: project.name },
    });
    if (await detachIssues(ctx, project._id)) {
      await ctx.scheduler.runAfter(0, internal.projects.continueDetach, {
        projectId: project._id,
      });
    }
    return null;
  },
});

/** The active org's projects, oldest first. */
export const list = query({
  args: {},
  returns: v.array(projectValidator),
  handler: async (ctx) => {
    const member = await requireMember(ctx);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_orgId", (q) => q.eq("orgId", member.orgId))
      .take(MAX_PROJECTS);
    return await withVisibleTeams(ctx, member, projects);
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  returns: projectValidator,
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const project = await loadProject(ctx, member, args.projectId);
    const [visible] = await withVisibleTeams(ctx, member, [project]);
    return visible;
  },
});

/**
 * A project's issues, page by page. Archived issues and issues of private
 * teams the caller is not in are left out, so a page can be shorter than asked.
 */
export const listIssues = query({
  args: { projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(issueValidator),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const project = await loadProject(ctx, member, args.projectId);
    const result = await ctx.db
      .query("issues")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .paginate(args.paginationOpts);
    const open = result.page.filter((issue) => issue.archivedAt === null);
    const visible = await filterVisibleIssues(ctx, member, open);
    return { ...result, page: visible.map(toPublicIssue) };
  },
});
