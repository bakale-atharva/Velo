import { DAY, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components } from "../_generated/api";
import { internalMutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { requireMember, type MemberInfo } from "../lib/auth";
import { getPlan, requireFeature } from "../lib/entitlements";
import { appError } from "../lib/errors";
import { AI_DAILY_LIMIT } from "../lib/plans";

// Who may use the assistant, and how much. Every assistant entry point goes
// through requireAi: an active member, an org whose plan has `ai_assistant`,
// and a request left in the org's daily allowance (AI_DAILY_LIMIT per plan,
// a fixed 24-hour window shared by the whole org).

const rateLimiter = new RateLimiter(components.rateLimiter);
const LIMIT_NAME = "aiDaily";

function dailyConfig(limit: number) {
  return { kind: "fixed window" as const, rate: limit, period: DAY };
}

async function dailyLimit(ctx: QueryCtx | MutationCtx, orgId: string): Promise<number> {
  return AI_DAILY_LIMIT[await getPlan(ctx, orgId)];
}

/**
 * `requireMember`, then FEATURE_NOT_IN_PLAN without `ai_assistant`, then one
 * request taken from the org's daily allowance (LIMIT_REACHED when spent).
 */
export async function requireAi(ctx: MutationCtx): Promise<MemberInfo> {
  const member = await requireMember(ctx);
  await requireFeature(ctx, member.orgId, "ai_assistant");
  const limit = await dailyLimit(ctx, member.orgId);
  const status = await rateLimiter.limit(ctx, LIMIT_NAME, {
    key: member.orgId,
    config: dailyConfig(limit),
  });
  if (!status.ok) {
    throw appError("LIMIT_REACHED");
  }
  return member;
}

/** `requireMember` + the feature check, without using up a request. */
export async function requireAiAccess(ctx: QueryCtx | MutationCtx): Promise<MemberInfo> {
  const member = await requireMember(ctx);
  await requireFeature(ctx, member.orgId, "ai_assistant");
  return member;
}

const vMember = v.object({ userId: v.string(), orgId: v.string(), role: v.string() });

/**
 * For actions, which have no db: runs requireAi as the calling user (auth
 * carries into ctx.runMutation) and returns who they are.
 */
export const begin = internalMutation({
  args: {},
  returns: vMember,
  handler: async (ctx) => await requireAi(ctx),
});

/**
 * For background work with no signed-in user (suggestions on a new issue,
 * embeddings): takes one request from the org's allowance if its plan has
 * the assistant. False means skip quietly.
 */
export const consumeForOrg = internalMutation({
  args: { orgId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const plan = await getPlan(ctx, args.orgId);
    const limit = AI_DAILY_LIMIT[plan];
    if (limit === 0) return false;
    const status = await rateLimiter.limit(ctx, LIMIT_NAME, {
      key: args.orgId,
      config: dailyConfig(limit),
    });
    return status.ok;
  },
});

/** Requests used today by the active org, and its daily allowance. */
export const usage = query({
  args: {},
  returns: v.object({ used: v.number(), limit: v.number() }),
  handler: async (ctx) => {
    const member = await requireMember(ctx);
    const limit = await dailyLimit(ctx, member.orgId);
    if (limit === 0) {
      return { used: 0, limit: 0 };
    }
    const { value } = await rateLimiter.getValue(ctx, LIMIT_NAME, {
      key: member.orgId,
      config: dailyConfig(limit),
    });
    return { used: Math.min(limit, Math.max(0, Math.round(limit - value))), limit };
  },
});
