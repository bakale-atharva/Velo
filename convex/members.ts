import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import { requireMember } from "./lib/auth";

const MAX_MEMBERS = 500;

const memberValidator = v.object({
  userId: v.string(),
  role: v.string(),
  // Profile fields are null until the user's own webhook event has synced.
  name: v.union(v.string(), v.null()),
  email: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
});

async function loadProfile(ctx: QueryCtx, userId: string) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", userId))
    .unique();
  return {
    name: user?.name ?? null,
    email: user?.email ?? null,
    imageUrl: user?.imageUrl ?? null,
  };
}

/** Members of the caller's active organization. */
export const list = query({
  args: {},
  returns: v.array(memberValidator),
  handler: async (ctx) => {
    const { orgId } = await requireMember(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_orgId_and_userId", (q) => q.eq("orgId", orgId))
      .take(MAX_MEMBERS);
    return await Promise.all(
      memberships.map(async (m) => ({
        userId: m.userId,
        role: m.role,
        ...(await loadProfile(ctx, m.userId)),
      })),
    );
  },
});

/** The caller as a member of the active organization. */
export const me = query({
  args: {},
  returns: memberValidator.extend({ orgId: v.string() }),
  handler: async (ctx) => {
    const { userId, orgId, role } = await requireMember(ctx);
    // The token's role is authoritative for this request; the synced row
    // may lag behind a role change by a few seconds.
    return { userId, orgId, role, ...(await loadProfile(ctx, userId)) };
  },
});
