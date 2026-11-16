import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError } from "./errors";
import {
  FREE_PLAN,
  isPlanSlug,
  PLAN_FEATURES,
  type Feature,
  type PlanSlug,
} from "./plans";

type DbCtx = QueryCtx | MutationCtx;

/**
 * The org's plan, read from the webhook-synced `subscriptions` table (never
 * from the session token). No row, a status other than "active", or an
 * unknown slug all mean the free plan.
 */
export async function getPlan(ctx: DbCtx, orgId: string): Promise<PlanSlug> {
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
    .unique();
  if (subscription === null || subscription.status !== "active") {
    return FREE_PLAN;
  }
  return isPlanSlug(subscription.planSlug) ? subscription.planSlug : FREE_PLAN;
}

export function planHasFeature(plan: PlanSlug, feature: Feature): boolean {
  return (PLAN_FEATURES[plan] as readonly Feature[]).includes(feature);
}

export async function hasFeature(
  ctx: DbCtx,
  orgId: string,
  feature: Feature,
): Promise<boolean> {
  return planHasFeature(await getPlan(ctx, orgId), feature);
}

export async function requireFeature(
  ctx: DbCtx,
  orgId: string,
  feature: Feature,
): Promise<void> {
  if (!(await hasFeature(ctx, orgId, feature))) {
    throw appError("FEATURE_NOT_IN_PLAN");
  }
}
