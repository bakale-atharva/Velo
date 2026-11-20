import { v, type Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireMember, type MemberInfo } from "./auth";
import { hasFeature } from "./entitlements";
import { appError } from "./errors";

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
  // Create, edit and delete any agent of the org (agents themselves manage
  // only their own subtree; see convex/lib/agentAccess.ts).
  "agents.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const permissionValidator = v.union(
  v.literal("issues.delete"),
  v.literal("teams.manage"),
  v.literal("labels.manage"),
  v.literal("projects.manage"),
  v.literal("cycles.manage"),
  v.literal("views.share"),
  v.literal("agents.manage"),
);

// Keeps the validator and the list in step at compile time.
const sameList: Permission extends Infer<typeof permissionValidator> ? true : false = true;
void sameList;

export const MEMBER_DEFAULTS: readonly Permission[] = [
  "projects.manage",
  "cycles.manage",
  "views.share",
];

type DbCtx = QueryCtx | MutationCtx;

/** The permissions a member has right now. */
export async function permissionsOf(
  ctx: DbCtx,
  member: MemberInfo,
): Promise<readonly Permission[]> {
  if (member.role === "admin") {
    return PERMISSIONS;
  }
  // Custom roles stop applying when the plan loses the feature.
  if (!(await hasFeature(ctx, member.orgId, "custom_roles"))) {
    return MEMBER_DEFAULTS;
  }
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_orgId_and_userId", (q) =>
      q.eq("orgId", member.orgId).eq("userId", member.userId),
    )
    .unique();
  const roleId = membership?.customRoleId;
  if (roleId === undefined) {
    return MEMBER_DEFAULTS;
  }
  const role = await ctx.db.get("customRoles", roleId);
  if (role === null || role.orgId !== member.orgId) {
    return MEMBER_DEFAULTS;
  }
  return role.permissions;
}

export async function hasPermission(
  ctx: DbCtx,
  member: MemberInfo,
  permission: Permission,
): Promise<boolean> {
  return (await permissionsOf(ctx, member)).includes(permission);
}

/** `requireMember`, then FORBIDDEN unless the member has the permission. */
export async function requirePermission(
  ctx: DbCtx,
  permission: Permission,
): Promise<MemberInfo> {
  const member = await requireMember(ctx);
  if (!(await hasPermission(ctx, member, permission))) {
    throw appError("FORBIDDEN");
  }
  return member;
}
