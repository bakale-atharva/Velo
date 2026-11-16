import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { appError } from "./lib/errors";
import { cleanColor, cleanText } from "./lib/input";
import { requirePermission } from "./lib/permissions";
import schema from "./schema";

// Labels belong to the whole org. Changing them needs `labels.manage`.

const MAX_LABELS = 500;
const MAX_NAME_LENGTH = 40;

async function assertNameFree(
  ctx: MutationCtx,
  orgId: string,
  name: string,
  except: Id<"labels"> | null,
) {
  const sameName = await ctx.db
    .query("labels")
    .withIndex("by_orgId_and_name", (q) => q.eq("orgId", orgId).eq("name", name))
    .unique();
  if (sameName !== null && sameName._id !== except) {
    throw appError("INVALID_INPUT");
  }
}

async function loadLabel(
  ctx: MutationCtx,
  orgId: string,
  labelId: Id<"labels">,
): Promise<Doc<"labels">> {
  const label = await ctx.db.get("labels", labelId);
  if (label === null || label.orgId !== orgId) {
    throw appError("NOT_FOUND");
  }
  return label;
}

/** The active org's labels, by name. */
export const list = query({
  args: {},
  returns: v.array(schema.doc("labels")),
  handler: async (ctx) => {
    const { orgId } = await requireMember(ctx);
    return await ctx.db
      .query("labels")
      .withIndex("by_orgId_and_name", (q) => q.eq("orgId", orgId))
      .take(MAX_LABELS);
  },
});

export const create = mutation({
  args: { name: v.string(), color: v.string() },
  returns: v.id("labels"),
  handler: async (ctx, args) => {
    const { orgId } = await requirePermission(ctx, "labels.manage");
    const name = cleanText(args.name, MAX_NAME_LENGTH);
    const color = cleanColor(args.color);
    await assertNameFree(ctx, orgId, name, null);
    const existing = await ctx.db
      .query("labels")
      .withIndex("by_orgId_and_name", (q) => q.eq("orgId", orgId))
      .take(MAX_LABELS);
    if (existing.length >= MAX_LABELS) {
      throw appError("LIMIT_REACHED");
    }
    return await ctx.db.insert("labels", { orgId, name, color });
  },
});

export const update = mutation({
  args: {
    labelId: v.id("labels"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requirePermission(ctx, "labels.manage");
    const label = await loadLabel(ctx, orgId, args.labelId);
    const name =
      args.name === undefined ? label.name : cleanText(args.name, MAX_NAME_LENGTH);
    const color = args.color === undefined ? label.color : cleanColor(args.color);
    await assertNameFree(ctx, orgId, name, label._id);
    await ctx.db.patch("labels", label._id, { name, color });
    return null;
  },
});

/**
 * Deletes a label. Issues that carried it keep its id in `labelIds`; readers
 * skip ids that no longer resolve.
 */
export const remove = mutation({
  args: { labelId: v.id("labels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requirePermission(ctx, "labels.manage");
    const label = await loadLabel(ctx, orgId, args.labelId);
    await ctx.db.delete("labels", label._id);
    return null;
  },
});
