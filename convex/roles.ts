import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { logAudit } from "./lib/audit";
import { requireAdmin, type MemberInfo } from "./lib/auth";
import { requireFeature } from "./lib/entitlements";
import { appError } from "./lib/errors";
import { cleanText } from "./lib/input";
import { permissionValidator } from "./lib/permissions";
import schema from "./schema";

// Custom roles: admins only, and only on plans with `custom_roles`.

const MAX_ROLES = 50;
const MAX_NAME_LENGTH = 40;
const UNASSIGN_BATCH = 200;

const roleValidator = schema.doc("customRoles");

async function requireRoleAdmin(ctx: QueryCtx | MutationCtx) {
  const member = await requireAdmin(ctx);
  await requireFeature(ctx, member.orgId, "custom_roles");
  return member;
}

async function loadRole(
  ctx: MutationCtx,
  member: MemberInfo,
  roleId: Id<"customRoles">,
): Promise<Doc<"customRoles">> {
  const role = await ctx.db.get("customRoles", roleId);
  if (role === null || role.orgId !== member.orgId) {
    throw appError("NOT_FOUND");
  }
  return role;
}

async function assertNameFree(
  ctx: MutationCtx,
  orgId: string,
  name: string,
  except: Id<"customRoles"> | null,
) {
  const sameName = await ctx.db
    .query("customRoles")
    .withIndex("by_orgId_and_name", (q) => q.eq("orgId", orgId).eq("name", name))
    .unique();
  if (sameName !== null && sameName._id !== except) {
    throw appError("INVALID_INPUT");
  }
}

export const list = query({
  args: {},
  returns: v.array(roleValidator),
  handler: async (ctx) => {
    const { orgId } = await requireRoleAdmin(ctx);
    return await ctx.db
      .query("customRoles")
      .withIndex("by_orgId_and_name", (q) => q.eq("orgId", orgId))
      .take(MAX_ROLES);
  },
});

const MAX_MEMBERS = 500;

/** Which members hold a custom role, for the roles page. */
export const assignments = query({
  args: {},
  returns: v.array(v.object({ userId: v.string(), roleId: v.id("customRoles") })),
  handler: async (ctx) => {
    const { orgId } = await requireRoleAdmin(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .take(MAX_MEMBERS);
    return memberships.flatMap((m) =>
      m.customRoleId === undefined ? [] : [{ userId: m.userId, roleId: m.customRoleId }],
    );
  },
});

export const create = mutation({
  args: { name: v.string(), permissions: v.array(permissionValidator) },
  returns: v.id("customRoles"),
  handler: async (ctx, args) => {
    const member = await requireRoleAdmin(ctx);
    const { orgId } = member;
    const name = cleanText(args.name, MAX_NAME_LENGTH);
    await assertNameFree(ctx, orgId, name, null);
    const existing = await ctx.db
      .query("customRoles")
      .withIndex("by_orgId_and_name", (q) => q.eq("orgId", orgId))
      .take(MAX_ROLES);
    if (existing.length >= MAX_ROLES) {
      throw appError("LIMIT_REACHED");
    }
    const permissions = [...new Set(args.permissions)];
    const roleId = await ctx.db.insert("customRoles", { orgId, name, permissions });
    await logAudit(ctx, member, {
      action: "role.created",
      targetType: "customRole",
      targetId: roleId,
      metadata: { name, permissions: permissions.join(",") },
    });
    return roleId;
  },
});

export const update = mutation({
  args: {
    roleId: v.id("customRoles"),
    name: v.optional(v.string()),
    permissions: v.optional(v.array(permissionValidator)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireRoleAdmin(ctx);
    const role = await loadRole(ctx, member, args.roleId);
    const name =
      args.name === undefined ? role.name : cleanText(args.name, MAX_NAME_LENGTH);
    await assertNameFree(ctx, member.orgId, name, role._id);
    const permissions =
      args.permissions === undefined ? role.permissions : [...new Set(args.permissions)];
    await ctx.db.patch("customRoles", role._id, { name, permissions });
    await logAudit(ctx, member, {
      action: "role.updated",
      targetType: "customRole",
      targetId: role._id,
      metadata: { name, permissions: permissions.join(",") },
    });
    return null;
  },
});

/** Clears one batch of memberships still pointing at a deleted role. */
async function unassignRole(ctx: MutationCtx, roleId: Id<"customRoles">): Promise<boolean> {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_customRoleId", (q) => q.eq("customRoleId", roleId))
    .take(UNASSIGN_BATCH);
  for (const membership of memberships) {
    await ctx.db.patch("memberships", membership._id, { customRoleId: undefined });
  }
  return memberships.length === UNASSIGN_BATCH;
}

export const continueUnassign = internalMutation({
  args: { roleId: v.id("customRoles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (await unassignRole(ctx, args.roleId)) {
      await ctx.scheduler.runAfter(0, internal.roles.continueUnassign, args);
    }
    return null;
  },
});

/** Deletes a role; its members fall back to the member defaults. */
export const remove = mutation({
  args: { roleId: v.id("customRoles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireRoleAdmin(ctx);
    const role = await loadRole(ctx, member, args.roleId);
    await ctx.db.delete("customRoles", role._id);
    await logAudit(ctx, member, {
      action: "role.deleted",
      targetType: "customRole",
      targetId: role._id,
      metadata: { name: role.name },
    });
    if (await unassignRole(ctx, role._id)) {
      await ctx.scheduler.runAfter(0, internal.roles.continueUnassign, { roleId: role._id });
    }
    return null;
  },
});

/** Gives a member a custom role, or takes it away with `roleId: null`. */
export const assign = mutation({
  args: { userId: v.string(), roleId: v.union(v.id("customRoles"), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireRoleAdmin(ctx);
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_orgId_and_userId", (q) =>
        q.eq("orgId", member.orgId).eq("userId", args.userId),
      )
      .unique();
    if (membership === null) {
      throw appError("NOT_FOUND");
    }
    const role = args.roleId === null ? null : await loadRole(ctx, member, args.roleId);
    await ctx.db.patch("memberships", membership._id, {
      customRoleId: role === null ? undefined : role._id,
    });
    await logAudit(ctx, member, {
      action: role === null ? "role.unassigned" : "role.assigned",
      targetType: "member",
      targetId: args.userId,
      metadata: role === null ? {} : { roleId: role._id, name: role.name },
    });
    return null;
  },
});
