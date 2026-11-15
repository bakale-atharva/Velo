import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { getPlan } from "./lib/entitlements";
import { AI_DAILY_LIMIT, PLAN_FEATURES } from "./lib/plans";

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
