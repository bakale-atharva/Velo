import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const BACKFILL_BATCH = 200;

/**
 * One-off: sets `kind: "human"` on memberships written before B8 (all of
 * them came from Clerk). Runs in batches and reschedules itself until done.
 * Run with `npx convex run memberships:backfillKind`.
 */
export const backfillKind = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const result = await ctx.db
      .query("memberships")
      .paginate({ numItems: BACKFILL_BATCH, cursor: cursor ?? null });
    for (const membership of result.page) {
      if (membership.kind === undefined) {
        await ctx.db.patch("memberships", membership._id, { kind: "human" });
      }
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.memberships.backfillKind, {
        cursor: result.continueCursor,
      });
    }
    return null;
  },
});
