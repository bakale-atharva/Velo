import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { logAudit } from "./audit";
import type { MemberInfo } from "./auth";
import { syncProjectCounts } from "./projectCounts";

// Deleting an issue for good, shared by issues.remove and the project
// deletion that takes its issues with it.

const CLEANUP_BATCH = 100;

/**
 * Detaches or deletes what pointed at a deleted issue, one batch per table.
 * Returns whether anything may be left.
 */
export async function cleanUpAfterRemoval(ctx: MutationCtx, issueId: Id<"issues">): Promise<boolean> {
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

/**
 * Deletes one issue with its comments and activity, recorded in the audit log
 * under `member`. Its sub-issues stay and lose their parent. The caller has
 * already checked that `member` may delete it.
 */
export async function deleteIssueForGood(
  ctx: MutationCtx,
  member: MemberInfo,
  issue: Doc<"issues">,
  metadata: Record<string, string> = {},
): Promise<void> {
  await ctx.db.delete("issues", issue._id);
  await syncProjectCounts(ctx, issue, null);
  await logAudit(ctx, member, {
    action: "issue.deleted",
    targetType: "issue",
    targetId: issue._id,
    metadata: { identifier: issue.identifier, title: issue.title, ...metadata },
  });
  if (await cleanUpAfterRemoval(ctx, issue._id)) {
    await ctx.scheduler.runAfter(0, internal.issues.continueCleanup, { issueId: issue._id });
  }
}
