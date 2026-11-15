import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMember } from "./lib/auth";
import schema from "./schema";

/** The caller's active organization, or null until the webhook has synced it. */
export const current = query({
  args: {},
  returns: v.union(schema.doc("organizations"), v.null()),
  handler: async (ctx) => {
    const { orgId } = await requireMember(ctx);
    return await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", orgId))
      .unique();
  },
});
