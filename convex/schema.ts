import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Tenant key: every tenant table stores the Clerk organization id ("org_...")
// in `orgId`. Users are referenced by Clerk user id ("user_...").
export const stateType = v.union(
  v.literal("backlog"),
  v.literal("unstarted"),
  v.literal("started"),
  v.literal("completed"),
  v.literal("canceled"),
);

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.union(v.string(), v.null()),
  }).index("by_clerkId", ["clerkId"]),

  organizations: defineTable({
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    imageUrl: v.union(v.string(), v.null()),
  })
    .index("by_clerkOrgId", ["clerkOrgId"])
    .index("by_slug", ["slug"]),

  memberships: defineTable({
    orgId: v.string(),
    userId: v.string(),
    // Clerk role with the "org:" prefix stripped, e.g. "admin", "member".
    role: v.string(),
  })
    .index("by_orgId_and_userId", ["orgId", "userId"])
    // Members of an org in join order (seat limits seat the earliest).
    .index("by_orgId", ["orgId"])
    .index("by_userId", ["userId"]),

  // One row per organization: its Clerk Billing subscription as last reported
  // by webhook. `planSlug` is the slug of the active item ("free_org" if none).
  subscriptions: defineTable({
    orgId: v.string(),
    clerkSubscriptionId: v.string(),
    planSlug: v.string(),
    // Clerk status, snake_case: "active", "past_due", "canceled", ...
    status: v.string(),
    // Clerk's `updated_at` (ms); older deliveries are ignored.
    updatedAt: v.number(),
  }).index("by_orgId", ["orgId"]),

  // A team inside an org. Issues are numbered per team: "<key>-<number>".
  teams: defineTable({
    orgId: v.string(),
    name: v.string(),
    // 2-5 uppercase letters, unique within the org.
    key: v.string(),
    isPrivate: v.boolean(),
    nextIssueNumber: v.number(),
    archivedAt: v.union(v.number(), v.null()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_and_key", ["orgId", "key"]),

  // Who belongs to a team. Only private teams use it to restrict access.
  teamMembers: defineTable({
    orgId: v.string(),
    teamId: v.id("teams"),
    userId: v.string(),
  })
    .index("by_teamId_and_userId", ["teamId", "userId"])
    .index("by_orgId_and_userId", ["orgId", "userId"]),

  workflowStates: defineTable({
    orgId: v.string(),
    teamId: v.id("teams"),
    name: v.string(),
    type: stateType,
    color: v.string(),
    position: v.number(),
  }).index("by_teamId_and_position", ["teamId", "position"]),

  labels: defineTable({
    orgId: v.string(),
    name: v.string(),
    color: v.string(),
  }).index("by_orgId_and_name", ["orgId", "name"]),

  // Processed Clerk webhook deliveries, for idempotency.
  webhookEvents: defineTable({
    svixId: v.string(),
  }).index("by_svixId", ["svixId"]),
});
