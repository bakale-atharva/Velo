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
