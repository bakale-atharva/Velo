import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { loadIssue } from "./lib/issueOps";
import schema from "./schema";

/** An issue's activity feed, newest first. */
export const listForIssue = query({
  args: { issueId: v.id("issues"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("activities")),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const { issue } = await loadIssue(ctx, member, args.issueId);
    return await ctx.db
      .query("activities")
      .withIndex("by_issueId", (q) => q.eq("issueId", issue._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
