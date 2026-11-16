import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { assertFilter, issueFilter } from "./issueFilters";
import { requireMember, type MemberInfo } from "./lib/auth";
import { appError } from "./lib/errors";
import { cleanText } from "./lib/input";
import schema, { viewGroupBy, viewLayout } from "./schema";

// Sharing a view with the org needs `views.share`, which every member has by
// default (custom roles can take it away in B6). Only the owner edits a view;
// the owner or an admin deletes it.

const MAX_VIEWS = 200;
const MAX_NAME_LENGTH = 80;

const viewValidator = schema.doc("savedViews");

type DbCtx = QueryCtx | MutationCtx;

/** A view the member may see: their own, or one shared with their org. */
async function loadVisibleView(
  ctx: DbCtx,
  member: MemberInfo,
  viewId: Id<"savedViews">,
): Promise<Doc<"savedViews">> {
  const view = await ctx.db.get("savedViews", viewId);
  if (
    view === null ||
    view.orgId !== member.orgId ||
    (!view.isShared && view.ownerId !== member.userId)
  ) {
    throw appError("NOT_FOUND");
  }
  return view;
}

/** The caller's views, then views others shared with the org; each by age. */
export const list = query({
  args: {},
  returns: v.array(viewValidator),
  handler: async (ctx) => {
    const member = await requireMember(ctx);
    const mine = await ctx.db
      .query("savedViews")
      .withIndex("by_orgId_and_ownerId", (q) =>
        q.eq("orgId", member.orgId).eq("ownerId", member.userId),
      )
      .take(MAX_VIEWS);
    const shared = await ctx.db
      .query("savedViews")
      .withIndex("by_orgId_and_isShared", (q) =>
        q.eq("orgId", member.orgId).eq("isShared", true),
      )
      .take(MAX_VIEWS);
    return [...mine, ...shared.filter((view) => view.ownerId !== member.userId)];
  },
});

export const get = query({
  args: { viewId: v.id("savedViews") },
  returns: viewValidator,
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    return await loadVisibleView(ctx, member, args.viewId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    filter: issueFilter,
    isShared: v.optional(v.boolean()),
    layout: v.optional(viewLayout),
    groupBy: v.optional(viewGroupBy),
  },
  returns: v.id("savedViews"),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const name = cleanText(args.name, MAX_NAME_LENGTH);
    assertFilter(args.filter);
    const existing = await ctx.db
      .query("savedViews")
      .withIndex("by_orgId_and_ownerId", (q) =>
        q.eq("orgId", member.orgId).eq("ownerId", member.userId),
      )
      .take(MAX_VIEWS);
    if (existing.length >= MAX_VIEWS) {
      throw appError("LIMIT_REACHED");
    }
    return await ctx.db.insert("savedViews", {
      orgId: member.orgId,
      ownerId: member.userId,
      name,
      isShared: args.isShared ?? false,
      filter: args.filter,
      layout: args.layout ?? "list",
      groupBy: args.groupBy ?? "state",
    });
  },
});

/** Changes the given fields of one of the caller's own views. */
export const update = mutation({
  args: {
    viewId: v.id("savedViews"),
    name: v.optional(v.string()),
    filter: v.optional(issueFilter),
    isShared: v.optional(v.boolean()),
    layout: v.optional(viewLayout),
    groupBy: v.optional(viewGroupBy),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const view = await loadVisibleView(ctx, member, args.viewId);
    if (view.ownerId !== member.userId) {
      throw appError("FORBIDDEN");
    }
    if (args.filter !== undefined) {
      assertFilter(args.filter);
    }
    await ctx.db.patch("savedViews", view._id, {
      name: args.name === undefined ? view.name : cleanText(args.name, MAX_NAME_LENGTH),
      filter: args.filter ?? view.filter,
      isShared: args.isShared ?? view.isShared,
      layout: args.layout ?? view.layout,
      groupBy: args.groupBy ?? view.groupBy,
    });
    return null;
  },
});

/** Deletes a view: its owner may, and so may an admin if it is shared. */
export const remove = mutation({
  args: { viewId: v.id("savedViews") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const view = await loadVisibleView(ctx, member, args.viewId);
    if (view.ownerId !== member.userId && member.role !== "admin") {
      throw appError("FORBIDDEN");
    }
    await ctx.db.delete("savedViews", view._id);
    return null;
  },
});
