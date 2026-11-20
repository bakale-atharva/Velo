import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { agentMembership } from "../lib/agentAccess";

// The MCP endpoint's door. Every request's API key is checked here, in one
// transaction, before a token is signed for it: the key must exist and not
// be revoked, its agent must exist and be neither disabled nor deleting,
// and it still needs a membership. Revoking a key or disabling an agent
// therefore takes effect on the very next request.

const rateLimiter = new RateLimiter(components.rateLimiter, {
  mcpPerKey: { kind: "token bucket", rate: 120, period: MINUTE, capacity: 120 },
});

// Usage timestamps are written at most this often, to keep writes rare.
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

const vResult = v.union(
  v.object({
    ok: v.literal(true),
    caller: v.object({
      userId: v.string(),
      orgId: v.string(),
      orgSlug: v.string(),
      role: v.string(),
      agentId: v.id("agents"),
      agentName: v.string(),
    }),
  }),
  v.object({ ok: v.literal(false), reason: v.literal("INVALID_KEY") }),
  v.object({ ok: v.literal(false), reason: v.literal("RATE_LIMITED"), retryAfterMs: v.number() }),
);

export const authenticate = internalMutation({
  args: { keyHash: v.string() },
  returns: vResult,
  handler: async (ctx, { keyHash }) => {
    const invalid = { ok: false as const, reason: "INVALID_KEY" as const };
    const key = await ctx.db
      .query("agentKeys")
      .withIndex("by_hash", (q) => q.eq("hash", keyHash))
      .unique();
    if (key === null || key.revokedAt !== null) return invalid;
    const agent = await ctx.db.get("agents", key.agentId);
    if (
      agent === null ||
      agent.orgId !== key.orgId ||
      agent.disabledAt !== null ||
      agent.deletingAt !== null
    ) {
      return invalid;
    }
    const membership = await agentMembership(ctx, agent);
    if (membership === null) return invalid;

    const status = await rateLimiter.limit(ctx, "mcpPerKey", { key: key._id });
    if (!status.ok) {
      return { ok: false as const, reason: "RATE_LIMITED" as const, retryAfterMs: status.retryAfter };
    }

    const now = Date.now();
    if (key.lastUsedAt === null || now - key.lastUsedAt > TOUCH_INTERVAL_MS) {
      await ctx.db.patch("agentKeys", key._id, { lastUsedAt: now });
    }
    if (agent.lastActiveAt === null || now - agent.lastActiveAt > TOUCH_INTERVAL_MS) {
      await ctx.db.patch("agents", agent._id, { lastActiveAt: now });
    }

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", agent.orgId))
      .unique();
    return {
      ok: true as const,
      caller: {
        userId: agent.userId,
        orgId: agent.orgId,
        orgSlug: org?.slug ?? agent.orgId,
        role: membership.role,
        agentId: agent._id,
        agentName: agent.name,
      },
    };
  },
});
