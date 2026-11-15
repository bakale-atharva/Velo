// Plan slugs and feature slugs match the Clerk Billing Organization Plans
// recorded in docs/billing-config.md.

export const PLAN_FEATURES = {
  free_org: [],
  pro: ["ai_assistant"],
  business: ["ai_assistant", "custom_roles", "audit_log", "private_teams"],
  enterprise: ["ai_assistant", "custom_roles", "audit_log", "private_teams"],
} as const;

export const AI_DAILY_LIMIT = {
  free_org: 0,
  pro: 100,
  business: 500,
  enterprise: 2000,
} as const;

// Members allowed per org, enforced in Convex (not Clerk; see
// docs/billing-config.md). `null` means unlimited. Pro's 20 is a hard cap
// because Clerk cannot bill per-seat overage.
export const SEAT_LIMIT = {
  free_org: 3,
  pro: 20,
  business: null,
  enterprise: null,
} as const;

export type PlanSlug = keyof typeof PLAN_FEATURES;
export type Feature = (typeof PLAN_FEATURES)[PlanSlug][number];

export const FREE_PLAN: PlanSlug = "free_org";

export function isPlanSlug(slug: string): slug is PlanSlug {
  return Object.hasOwn(PLAN_FEATURES, slug);
}
