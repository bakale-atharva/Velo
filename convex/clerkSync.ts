import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, type MutationCtx } from "./_generated/server";

// Rows deleted per transaction when removing many memberships at once.
const DELETE_BATCH = 500;

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function skip(kind: string, data: Json, missing: string[]) {
  console.warn(
    `Clerk webhook ${kind}: skipped, missing ${missing.join(", ")}; ` +
      `payload keys: ${Object.keys(data).join(", ")}`,
  );
}

function stripOrgPrefix(role: string): string {
  return role.replace(/^org:/, "");
}

/**
 * Applies one verified Clerk webhook event. Called only by the HTTP action in
 * `http.ts` after the signature has been checked; `data` is Clerk's payload.
 * Replayed deliveries (same svix-id) are ignored.
 */
export const handleEvent = internalMutation({
  args: { svixId: v.string(), type: v.string(), data: v.any() },
  returns: v.null(),
  handler: async (ctx, { svixId, type, data }) => {
    const seen = await ctx.db
      .query("webhookEvents")
      .withIndex("by_svixId", (q) => q.eq("svixId", svixId))
      .unique();
    if (seen !== null) {
      return null;
    }
    await ctx.db.insert("webhookEvents", { svixId });

    const payload = asObject(data);
    if (payload === null) {
      console.warn(`Clerk webhook ${type} (${svixId}): payload is not an object`);
      return null;
    }

    switch (type) {
      case "user.created":
      case "user.updated":
        await upsertUser(ctx, payload);
        break;
      case "user.deleted":
        await deleteUser(ctx, payload);
        break;
      case "organization.created":
      case "organization.updated":
        await upsertOrganization(ctx, payload);
        break;
      case "organization.deleted":
        await deleteOrganization(ctx, payload);
        break;
      case "organizationMembership.created":
      case "organizationMembership.updated":
        await upsertMembership(ctx, payload);
        break;
      case "organizationMembership.deleted":
        await deleteMembership(ctx, payload);
        break;
      default:
        // Other event types are not synced in this phase.
        console.warn(`Clerk webhook ${type} (${svixId}): event type not handled`);
        break;
    }
    return null;
  },
});

/** Continues deleting an organization's memberships in batches. */
export const deleteOrgMemberships = internalMutation({
  args: { orgId: v.string() },
  returns: v.null(),
  handler: async (ctx, { orgId }) => {
    await deleteMembershipsOfOrg(ctx, orgId);
    return null;
  },
});

async function upsertUser(ctx: MutationCtx, data: Json) {
  const clerkId = str(data.id);
  if (clerkId === null) {
    skip("user", data, ["id"]);
    return;
  }

  const emails = Array.isArray(data.email_addresses)
    ? data.email_addresses.map(asObject).filter((e): e is Json => e !== null)
    : [];
  const primaryId = str(data.primary_email_address_id);
  const primary = emails.find((e) => e.id === primaryId) ?? emails[0];
  const email = (primary && str(primary.email_address)) ?? "";

  const fullName = [str(data.first_name), str(data.last_name)]
    .filter((part): part is string => part !== null)
    .join(" ");
  const name = fullName || str(data.username) || email;

  const fields = {
    clerkId,
    email,
    name,
    imageUrl: str(data.image_url),
  };

  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .unique();
  if (existing === null) {
    await ctx.db.insert("users", fields);
  } else {
    await ctx.db.patch("users", existing._id, fields);
  }
}

async function deleteUser(ctx: MutationCtx, data: Json) {
  const clerkId = str(data.id);
  if (clerkId === null) return;

  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .unique();
  if (existing !== null) {
    await ctx.db.delete("users", existing._id);
  }

  // A user belongs to few organizations; one bounded batch covers them.
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_userId", (q) => q.eq("userId", clerkId))
    .take(DELETE_BATCH);
  for (const membership of memberships) {
    await ctx.db.delete("memberships", membership._id);
  }
}

async function upsertOrganization(ctx: MutationCtx, data: Json) {
  const clerkOrgId = str(data.id);
  const name = str(data.name);
  const slug = str(data.slug);
  if (clerkOrgId === null || name === null || slug === null) {
    skip("organization", data, [
      ...(clerkOrgId === null ? ["id"] : []),
      ...(name === null ? ["name"] : []),
      ...(slug === null ? ["slug"] : []),
    ]);
    return;
  }

  const fields = {
    clerkOrgId,
    name,
    slug,
    imageUrl: data.has_image === true ? str(data.image_url) : null,
  };

  const existing = await ctx.db
    .query("organizations")
    .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", clerkOrgId))
    .unique();
  if (existing === null) {
    await ctx.db.insert("organizations", fields);
  } else {
    await ctx.db.patch("organizations", existing._id, fields);
  }
}

async function deleteOrganization(ctx: MutationCtx, data: Json) {
  const clerkOrgId = str(data.id);
  if (clerkOrgId === null) return;

  const existing = await ctx.db
    .query("organizations")
    .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", clerkOrgId))
    .unique();
  if (existing !== null) {
    await ctx.db.delete("organizations", existing._id);
  }
  await deleteMembershipsOfOrg(ctx, clerkOrgId);
}

async function deleteMembershipsOfOrg(ctx: MutationCtx, orgId: string) {
  const batch = await ctx.db
    .query("memberships")
    .withIndex("by_orgId_and_userId", (q) => q.eq("orgId", orgId))
    .take(DELETE_BATCH);
  for (const membership of batch) {
    await ctx.db.delete("memberships", membership._id);
  }
  if (batch.length === DELETE_BATCH) {
    await ctx.scheduler.runAfter(0, internal.clerkSync.deleteOrgMemberships, {
      orgId,
    });
  }
}

function readMembership(data: Json) {
  const orgId = str(asObject(data.organization)?.id);
  const userId = str(asObject(data.public_user_data)?.user_id);
  const role = str(data.role);
  return { orgId, userId, role };
}

async function upsertMembership(ctx: MutationCtx, data: Json) {
  const { orgId, userId, role } = readMembership(data);
  if (orgId === null || userId === null || role === null) {
    skip("organizationMembership", data, [
      ...(orgId === null ? ["organization.id"] : []),
      ...(userId === null ? ["public_user_data.user_id"] : []),
      ...(role === null ? ["role"] : []),
    ]);
    return;
  }

  const fields = { orgId, userId, role: stripOrgPrefix(role) };
  const existing = await ctx.db
    .query("memberships")
    .withIndex("by_orgId_and_userId", (q) =>
      q.eq("orgId", orgId).eq("userId", userId),
    )
    .unique();
  if (existing === null) {
    await ctx.db.insert("memberships", fields);
  } else {
    await ctx.db.patch("memberships", existing._id, fields);
  }
}

async function deleteMembership(ctx: MutationCtx, data: Json) {
  const { orgId, userId } = readMembership(data);
  if (orgId === null || userId === null) return;

  const existing = await ctx.db
    .query("memberships")
    .withIndex("by_orgId_and_userId", (q) =>
      q.eq("orgId", orgId).eq("userId", userId),
    )
    .unique();
  if (existing !== null) {
    await ctx.db.delete("memberships", existing._id);
  }
}
