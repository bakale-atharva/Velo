import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { requireFeature } from "./lib/entitlements";
import schema from "./schema";

/** The org's audit log, newest first. Admins only, on plans with `audit_log`. */
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("auditLogs")),
  handler: async (ctx, args) => {
    const { orgId } = await requireAdmin(ctx);
    await requireFeature(ctx, orgId, "audit_log");
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
