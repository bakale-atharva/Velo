import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getPlan } from "./entitlements";
import { SEAT_LIMIT } from "./plans";

type DbCtx = QueryCtx | MutationCtx;

// Upper bound when counting members of an unlimited plan for display.
const MAX_COUNTED_MEMBERS = 1000;

/**
 * Whether a member may use the workspace under the org's seat limit.
 *
 * Clerk lets anyone be invited; Velo decides access. Admins always get in.
 * Other members get in if they are among the earliest `limit` members by join
 * order. A member whose membership row has not synced yet is the newest, so
 * they get in only while the org has a free seat.
 */
export async function hasSeat(
  ctx: DbCtx,
  orgId: string,
  userId: string,
  role: string,
): Promise<boolean> {
  if (role === "admin") {
    return true;
  }
  const limit = SEAT_LIMIT[await getPlan(ctx, orgId)];
  if (limit === null) {
    return true;
  }
  const seated = await ctx.db
    .query("memberships")
    .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
    .take(limit);
  return seated.length < limit || seated.some((m) => m.userId === userId);
}

/** Members counted against the plan's seat limit (`null` = unlimited). */
export async function seatUsage(
  ctx: DbCtx,
  orgId: string,
): Promise<{ used: number; limit: number | null }> {
  const limit = SEAT_LIMIT[await getPlan(ctx, orgId)];
  const members = await ctx.db
    .query("memberships")
    .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
    .take(MAX_COUNTED_MEMBERS);
  return { used: members.length, limit };
}
