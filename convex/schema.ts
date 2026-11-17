import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { permissionValidator } from "./lib/permissions";

// Tenant key: every tenant table stores the Clerk organization id ("org_...")
// in `orgId`. Users are referenced by Clerk user id ("user_...").
export const stateType = v.union(
  v.literal("backlog"),
  v.literal("unstarted"),
  v.literal("started"),
  v.literal("completed"),
  v.literal("canceled"),
);

export const activityType = v.union(
  v.literal("created"),
  v.literal("title"),
  v.literal("description"),
  v.literal("state"),
  v.literal("priority"),
  v.literal("assignee"),
  v.literal("labels"),
  v.literal("estimate"),
  v.literal("dueDate"),
  v.literal("parent"),
  v.literal("project"),
  v.literal("cycle"),
  v.literal("comment"),
  v.literal("archived"),
);

export const projectStatus = v.union(
  v.literal("planned"),
  v.literal("started"),
  v.literal("paused"),
  v.literal("completed"),
  v.literal("canceled"),
);

export const cycleStatus = v.union(
  v.literal("upcoming"),
  v.literal("active"),
  v.literal("completed"),
);

// Issue list filter (see convex/issueFilters.ts). `assigneeIds` may include
// null for "unassigned".
export const issueFilter = v.object({
  teamId: v.optional(v.id("teams")),
  stateTypes: v.optional(v.array(stateType)),
  stateIds: v.optional(v.array(v.id("workflowStates"))),
  assigneeIds: v.optional(v.array(v.union(v.string(), v.null()))),
  labelIds: v.optional(v.array(v.id("labels"))),
  priorities: v.optional(v.array(v.number())),
  projectId: v.optional(v.id("projects")),
  cycleId: v.optional(v.id("cycles")),
  creatorId: v.optional(v.string()),
});

export const viewLayout = v.union(v.literal("list"), v.literal("board"));
export const viewGroupBy = v.union(
  v.literal("state"),
  v.literal("assignee"),
  v.literal("priority"),
  v.literal("project"),
  v.literal("none"),
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
    // Velo custom role (B6); applies only while the plan has `custom_roles`.
    customRoleId: v.optional(v.id("customRoles")),
  })
    .index("by_orgId_and_userId", ["orgId", "userId"])
    .index("by_customRoleId", ["customRoleId"])
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

  // A named set of Velo permissions an admin can give members (Business+).
  customRoles: defineTable({
    orgId: v.string(),
    name: v.string(),
    permissions: v.array(permissionValidator),
  }).index("by_orgId_and_name", ["orgId", "name"]),

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

  issues: defineTable({
    orgId: v.string(),
    teamId: v.id("teams"),
    // Sequential per team; `identifier` is "<team key>-<number>".
    number: v.number(),
    identifier: v.string(),
    title: v.string(),
    // Markdown.
    description: v.string(),
    stateId: v.id("workflowStates"),
    // Copy of the state's type, so lists can tell open from done.
    stateType: stateType,
    // 0 none, 1 urgent, 2 high, 3 medium, 4 low.
    priority: v.number(),
    assigneeId: v.union(v.string(), v.null()),
    creatorId: v.string(),
    labelIds: v.array(v.id("labels")),
    estimate: v.union(v.number(), v.null()),
    parentId: v.union(v.id("issues"), v.null()),
    // Optional because issues written before B4 lack it; absent means none.
    projectId: v.optional(v.union(v.id("projects"), v.null())),
    // Optional for the same reason; absent means no cycle.
    cycleId: v.optional(v.union(v.id("cycles"), v.null())),
    // Order within a state column (fractional-indexing key).
    rank: v.string(),
    // Timestamps in ms.
    dueDate: v.union(v.number(), v.null()),
    completedAt: v.union(v.number(), v.null()),
    archivedAt: v.union(v.number(), v.null()),
    // Title and description, for full-text search (B5).
    searchText: v.string(),
  })
    .index("by_teamId_and_number", ["teamId", "number"])
    .index("by_teamId_and_stateId_and_rank", ["teamId", "stateId", "rank"])
    // Lists and the board skip archived issues without scanning them.
    .index("by_teamId_and_archivedAt_and_stateId_and_rank", [
      "teamId",
      "archivedAt",
      "stateId",
      "rank",
    ])
    .index("by_orgId_and_assigneeId", ["orgId", "assigneeId"])
    .index("by_parentId", ["parentId"])
    .index("by_orgId_and_identifier", ["orgId", "identifier"])
    .index("by_projectId", ["projectId"])
    .index("by_cycleId", ["cycleId"])
    .index("by_orgId_and_teamId", ["orgId", "teamId"])
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["orgId", "teamId"],
    }),

  // A body of work across one or more teams of the org.
  projects: defineTable({
    orgId: v.string(),
    name: v.string(),
    // Markdown.
    description: v.string(),
    status: projectStatus,
    leadId: v.union(v.string(), v.null()),
    // Teams with issues in the project; grows as issues are added.
    teamIds: v.array(v.id("teams")),
    // Timestamps in ms.
    startDate: v.union(v.number(), v.null()),
    targetDate: v.union(v.number(), v.null()),
    // Progress, kept by the issue mutations (convex/lib/projectCounts.ts).
    issueCount: v.number(),
    completedIssueCount: v.number(),
  }).index("by_orgId", ["orgId"]),

  // A team's time-boxed iteration. Cycles of a team never overlap.
  // `convex/cycles.ts` `rollover` moves cycles through their statuses.
  cycles: defineTable({
    orgId: v.string(),
    teamId: v.id("teams"),
    // Sequential per team.
    number: v.number(),
    name: v.string(),
    // Timestamps in ms; the cycle covers [startsAt, endsAt).
    startsAt: v.number(),
    endsAt: v.number(),
    status: cycleStatus,
  })
    .index("by_teamId_and_startsAt", ["teamId", "startsAt"])
    .index("by_teamId_and_number", ["teamId", "number"])
    .index("by_status_and_startsAt", ["status", "startsAt"])
    .index("by_status_and_endsAt", ["status", "endsAt"]),

  // A named issue filter. Private to its owner unless shared with the org.
  savedViews: defineTable({
    orgId: v.string(),
    ownerId: v.string(),
    name: v.string(),
    isShared: v.boolean(),
    filter: issueFilter,
    layout: viewLayout,
    groupBy: viewGroupBy,
  })
    .index("by_orgId_and_ownerId", ["orgId", "ownerId"])
    .index("by_orgId_and_isShared", ["orgId", "isShared"]),

  comments: defineTable({
    orgId: v.string(),
    issueId: v.id("issues"),
    authorId: v.string(),
    // Markdown.
    body: v.string(),
    editedAt: v.union(v.number(), v.null()),
  }).index("by_issueId", ["issueId"]),

  // One row per change to an issue. `from` / `to` hold readable values
  // (state name, label names, parent identifier, user id, ...).
  activities: defineTable({
    orgId: v.string(),
    issueId: v.id("issues"),
    // Clerk user id, or "system" for scheduled jobs.
    actorId: v.string(),
    viaAssistant: v.boolean(),
    type: activityType,
    from: v.union(v.string(), v.null()),
    to: v.union(v.string(), v.null()),
  }).index("by_issueId", ["issueId"]),

  // Org-level changes (teams, roles, deletions, sharing). Always written, so
  // the history exists if the org upgrades; readable only with `audit_log`.
  auditLogs: defineTable({
    orgId: v.string(),
    actorId: v.string(),
    // e.g. "team.created", "role.assigned", "issue.deleted".
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    metadata: v.record(v.string(), v.string()),
  }).index("by_orgId", ["orgId"]),

  // Processed Clerk webhook deliveries, for idempotency.
  webhookEvents: defineTable({
    svixId: v.string(),
  }).index("by_svixId", ["svixId"]),
});
