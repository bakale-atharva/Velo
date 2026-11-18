// Display names for the plan slugs in convex/lib/plans.ts.
const PLAN_NAMES: Record<string, string> = {
  free_org: "Free",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

export function planName(slug: string): string {
  return PLAN_NAMES[slug] ?? slug;
}

const FEATURE_NAMES: Record<string, string> = {
  ai_assistant: "AI assistant",
  custom_roles: "Custom roles",
  audit_log: "Audit log",
  private_teams: "Private teams",
};

export function featureName(slug: string): string {
  return FEATURE_NAMES[slug] ?? slug;
}

import type { Permission } from "@/convex/lib/permissions";

/** Same list and order as PERMISSIONS in convex/lib/permissions.ts. */
export const ALL_PERMISSIONS: Permission[] = [
  "issues.delete",
  "teams.manage",
  "labels.manage",
  "projects.manage",
  "cycles.manage",
  "views.share",
];

const PERMISSION_NAMES: Record<string, string> = {
  "issues.delete": "Delete issues",
  "teams.manage": "Manage teams and workflows",
  "labels.manage": "Manage labels",
  "projects.manage": "Manage projects",
  "cycles.manage": "Manage cycles",
  "views.share": "Share views",
};

export function permissionName(slug: string): string {
  return PERMISSION_NAMES[slug] ?? slug;
}
