import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { requireMember, type MemberInfo } from "./lib/auth";
import { appError } from "./lib/errors";
import { cleanText } from "./lib/input";
import { loadIssue } from "./lib/issueOps";
import schema from "./schema";

const MAX_BODY_LENGTH = 20_000;

/** Loads a comment on an issue the member may see. */
async function loadComment(
  ctx: MutationCtx,
  member: MemberInfo,
  commentId: Id<"comments">,
): Promise<Doc<"comments">> {
  const comment = await ctx.db.get("comments", commentId);
  if (comment === null || comment.orgId !== member.orgId) {
    throw appError("NOT_FOUND");
  }
  await loadIssue(ctx, member, comment.issueId);
  return comment;
}

/** Comment activities carry what happened to the comment in `to`. */
async function logCommentActivity(
  ctx: MutationCtx,
  member: MemberInfo,
  issueId: Id<"issues">,
  what: "created" | "edited" | "deleted",
) {
  await logActivity(ctx, {
    orgId: member.orgId,
    issueId,
    actorId: member.userId,
    type: "comment",
    to: what,
  });
}

/** An issue's comments, oldest first. */
export const list = query({
  args: { issueId: v.id("issues"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("comments")),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const { issue } = await loadIssue(ctx, member, args.issueId);
    return await ctx.db
      .query("comments")
      .withIndex("by_issueId", (q) => q.eq("issueId", issue._id))
      .paginate(args.paginationOpts);
  },
});

export const create = mutation({
  args: { issueId: v.id("issues"), body: v.string() },
  returns: v.id("comments"),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const { issue } = await loadIssue(ctx, member, args.issueId);
    const commentId = await ctx.db.insert("comments", {
      orgId: member.orgId,
      issueId: issue._id,
      authorId: member.userId,
      body: cleanText(args.body, MAX_BODY_LENGTH),
      editedAt: null,
    });
    await logCommentActivity(ctx, member, issue._id, "created");
    return commentId;
  },
});

/** Only the author can edit a comment. */
export const update = mutation({
  args: { commentId: v.id("comments"), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const comment = await loadComment(ctx, member, args.commentId);
    if (comment.authorId !== member.userId) {
      throw appError("FORBIDDEN");
    }
    const body = cleanText(args.body, MAX_BODY_LENGTH);
    if (body !== comment.body) {
      await ctx.db.patch("comments", comment._id, { body, editedAt: Date.now() });
      await logCommentActivity(ctx, member, comment.issueId, "edited");
    }
    return null;
  },
});

/** The author or an admin can delete a comment. */
export const remove = mutation({
  args: { commentId: v.id("comments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const comment = await loadComment(ctx, member, args.commentId);
    if (comment.authorId !== member.userId && member.role !== "admin") {
      throw appError("FORBIDDEN");
    }
    await ctx.db.delete("comments", comment._id);
    await logCommentActivity(ctx, member, comment.issueId, "deleted");
    return null;
  },
});
