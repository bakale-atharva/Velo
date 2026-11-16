import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { getPlan } from "./lib/entitlements";
import { AI_DAILY_LIMIT, PLAN_FEATURES } from "./lib/plans";
import { seatUsage } from "./lib/seats";

/** Seats used by the active organization and its plan's limit (null = unlimited). */
export const seats = query({
  args: {},
  returns: v.object({ used: v.number(), limit: v.union(v.number(), v.null()) }),
  handler: async (ctx) => {
    const { orgId } = await requireMember(ctx);
    return await seatUsage(ctx, orgId);
  },
});

/** The active organization's plan, its features and its AI daily limit. */
export const currentPlan = query({
  args: {},
  returns: v.object({
    planSlug: v.string(),
    features: v.array(v.string()),
    aiDailyLimit: v.number(),
  }),
  handler: async (ctx) => {
    const { orgId } = await requireMember(ctx);
    const planSlug = await getPlan(ctx, orgId);
    return {
      planSlug,
      features: [...PLAN_FEATURES[planSlug]],
      aiDailyLimit: AI_DAILY_LIMIT[planSlug],
    };
  },
});
