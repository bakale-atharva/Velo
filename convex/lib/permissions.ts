import { v, type Infer } from "convex/values";

// Velo's own permissions (not Clerk custom roles). Clerk "admin" always has
// every permission. Other members get MEMBER_DEFAULTS, unless the org's plan
// has `custom_roles` and the member was given a custom role, whose list then
// replaces the defaults.

export const PERMISSIONS = [
  "issues.delete",
  "teams.manage",
  "labels.manage",
  "projects.manage",
  "cycles.manage",
  "views.share",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const permissionValidator = v.union(
  v.literal("issues.delete"),
  v.literal("teams.manage"),
  v.literal("labels.manage"),
  v.literal("projects.manage"),
  v.literal("cycles.manage"),
  v.literal("views.share"),
);

// Keeps the validator and the list in step at compile time.
const sameList: Permission extends Infer<typeof permissionValidator> ? true : false = true;
void sameList;

export const MEMBER_DEFAULTS: readonly Permission[] = [
  "projects.manage",
  "cycles.manage",
  "views.share",
];
