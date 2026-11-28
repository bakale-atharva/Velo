import { env, type MutationCtx, type QueryCtx } from "../_generated/server";
import { appError } from "./errors";
import {
  FREE_PLAN,
  isPlanSlug,
  PLAN_FEATURES,
  PRIORITY_PLAN,
  type Feature,
  type PlanSlug,
} from "./plans";

type DbCtx = QueryCtx | MutationCtx;

/** Org ids in `PRIORITY_ORG_IDS` (comma-separated, spaces ignored). */
export function isPriorityOrg(orgId: string, list: string | undefined = env.PRIORITY_ORG_IDS): boolean {
  if (list === undefined) return false;
  return list
    .split(",")
    .map((id) => id.trim())
    .some((id) => id !== "" && id === orgId);
}

/**
 * The org's plan. A priority org (deployment env `PRIORITY_ORG_IDS`) always
 * has the top plan. Otherwise it is read from the webhook-synced
 * `subscriptions` table (never from the session token): no row, a status
 * other than "active", or an unknown slug all mean the free plan.
 */
export async function getPlan(ctx: DbCtx, orgId: string): Promise<PlanSlug> {
  if (isPriorityOrg(orgId)) {
    return PRIORITY_PLAN;
  }
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
