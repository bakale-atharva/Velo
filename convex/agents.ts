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
import { logActivity } from "./lib/activity";
import { AGENT_USER_PREFIX } from "./lib/agentIds";
import {
  MAX_AGENTS_PER_ORG,
  agentMembership,
  canManageAgent,
  isMaster,
  loadAgent,
  requireAgentCreator,
  requireManagedAgent,
} from "./lib/agentAccess";
import { logAudit } from "./lib/audit";
import { requireMember, type MemberInfo } from "./lib/auth";
import { appError } from "./lib/errors";
import { cleanText } from "./lib/input";
import { canAccessTeam, isTeamMember, requireTeamAccess } from "./lib/teamAccess";
import { agentRuntime } from "./schema";

// Agents are org members (B8), in two levels: workspace admins create
// master agents (admins that can create agents), and a master's agents are
// members that can't (see convex/lib/agentAccess.ts). Every function works
// the same whether a person (Clerk token) or an agent (Velo-signed token,
// B9) calls it.

type DbCtx = QueryCtx | MutationCtx;

const MAX_NAME = 80;
const MAX_DESCRIPTION = 2000;
const MAX_MODEL = 100;
const MAX_IMAGE_URL = 2048;
const MAX_METADATA_KEYS = 20;
const MAX_METADATA_KEY = 40;
const MAX_METADATA_VALUE = 500;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_TEAMS_PER_AGENT = 200;
const STEP_BATCH = 100;

const agentValidator = v.object({
  _id: v.id("agents"),
  _creationTime: v.number(),
  userId: v.string(),
  name: v.string(),
  // The uploaded photo if there is one, else the URL it was given.
  imageUrl: v.union(v.string(), v.null()),
  description: v.string(),
  model: v.union(v.string(), v.null()),
  runtime: agentRuntime,
  metadata: v.record(v.string(), v.string()),
  parentAgentId: v.union(v.id("agents"), v.null()),
  createdBy: v.string(),
  // Created by a person: an admin that can create agents.
  isMaster: v.boolean(),
  // "admin" for masters, "member" for their agents (for MCP; the UI never
  // shows it).
  role: v.string(),
  disabledAt: v.union(v.number(), v.null()),
  lastActiveAt: v.union(v.number(), v.null()),
  // Teams the agent is in that the caller can see.
  teamIds: v.array(v.id("teams")),
  // Whether the caller may change this agent's settings, keys and teams.
  canManage: v.boolean(),
});

// --- Input checks -----------------------------------------------------------

function cleanDescription(value: string): string {
  const text = value.trim();
  if (text.length > MAX_DESCRIPTION) throw appError("INVALID_INPUT");
  return text;
}

function cleanModel(value: string | null): string | null {
  if (value === null) return null;
  const text = value.trim();
  if (text.length > MAX_MODEL) throw appError("INVALID_INPUT");
  return text === "" ? null : text;
}

function cleanImageUrl(value: string | null): string | null {
  if (value === null || value.trim() === "") return null;
  const text = value.trim();
  if (text.length > MAX_IMAGE_URL) throw appError("INVALID_INPUT");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw appError("INVALID_INPUT");
  }
  if (url.protocol !== "https:") throw appError("INVALID_INPUT");
  return url.toString();
}

function cleanMetadata(value: Record<string, string>): Record<string, string> {
  const entries = Object.entries(value);
  if (entries.length > MAX_METADATA_KEYS) throw appError("INVALID_INPUT");
  const result: Record<string, string> = {};
  for (const [key, raw] of entries) {
    if (key.length > MAX_METADATA_KEY || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(key)) {
      throw appError("INVALID_INPUT");
    }
    if (raw.length > MAX_METADATA_VALUE) throw appError("INVALID_INPUT");
    result[key] = raw;
  }
  return result;
}

/** A fresh "agent_..." user id (Math.random is a seeded strong PRNG here). */
function newAgentUserId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 24; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return AGENT_USER_PREFIX + id;
}

// --- Reading ----------------------------------------------------------------

async function imageOf(ctx: DbCtx, agent: Doc<"agents">): Promise<string | null> {
  if (agent.imageStorageId !== null) {
    return (await ctx.storage.getUrl(agent.imageStorageId)) ?? agent.imageUrl;
  }
  return agent.imageUrl;
}

async function toView(ctx: QueryCtx, member: MemberInfo, agent: Doc<"agents">) {
  const membership = await agentMembership(ctx, agent);
  const rows = await ctx.db
    .query("teamMembers")
    .withIndex("by_orgId_and_userId", (q) =>
      q.eq("orgId", agent.orgId).eq("userId", agent.userId),
    )
    .take(MAX_TEAMS_PER_AGENT);
  const teamIds: Id<"teams">[] = [];
  for (const row of rows) {
    const team = await ctx.db.get("teams", row.teamId);
    if (team !== null && (await canAccessTeam(ctx, member, team))) {
      teamIds.push(team._id);
    }
  }
  return {
    _id: agent._id,
    _creationTime: agent._creationTime,
    userId: agent.userId,
    name: agent.name,
    imageUrl: await imageOf(ctx, agent),
    description: agent.description,
    model: agent.model,
    runtime: agent.runtime,
    metadata: agent.metadata,
    parentAgentId: agent.parentAgentId,
    createdBy: agent.createdBy,
    isMaster: isMaster(agent),
    role: membership?.role ?? "member",
    disabledAt: agent.disabledAt,
    lastActiveAt: agent.lastActiveAt,
    teamIds,
    canManage: await canManageAgent(ctx, member, agent),
  };
}

/** Agents of the caller's org, oldest first. */
export const list = query({
  args: {},
  returns: v.array(agentValidator),
  handler: async (ctx) => {
    const member = await requireMember(ctx);
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_orgId", (q) => q.eq("orgId", member.orgId))
      .take(MAX_AGENTS_PER_ORG);
    const live = agents.filter((a) => a.deletingAt === null);
    return await Promise.all(live.map((agent) => toView(ctx, member, agent)));
  },
});

export const get = query({
  args: { agentId: v.id("agents") },
  returns: agentValidator,
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const agent = await loadAgent(ctx, member, args.agentId);
    if (agent.deletingAt !== null) throw appError("NOT_FOUND");
    return await toView(ctx, member, agent);
  },
});

// --- Teams ------------------------------------------------------------------

async function joinTeam(
  ctx: MutationCtx,
  member: MemberInfo,
  agent: Doc<"agents">,
  teamId: Id<"teams">,
) {
  const team = await requireTeamAccess(ctx, member, teamId);
  if (team.archivedAt !== null) throw appError("INVALID_INPUT");
  if (!(await isTeamMember(ctx, team._id, agent.userId))) {
    await ctx.db.insert("teamMembers", {
      orgId: member.orgId,
      teamId: team._id,
      userId: agent.userId,
    });
  }
  return team;
}

/**
 * Adds an agent the caller manages to a team the caller can see. Needs no
 * `teams.manage`: managing the agent is enough.
 */
export const addToTeam = mutation({
  args: { agentId: v.id("agents"), teamId: v.id("teams") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const agent = await requireManagedAgent(ctx, member, args.agentId);
    if (agent.deletingAt !== null) throw appError("NOT_FOUND");
    const team = await joinTeam(ctx, member, agent, args.teamId);
    await logAudit(ctx, member, {
      action: "team.member_added",
      targetType: "team",
      targetId: team._id,
      metadata: { userId: agent.userId },
    });
    return null;
  },
});

export const removeFromTeam = mutation({
  args: { agentId: v.id("agents"), teamId: v.id("teams") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const agent = await requireManagedAgent(ctx, member, args.agentId);
    const team = await requireTeamAccess(ctx, member, args.teamId);
    const row = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId_and_userId", (q) =>
        q.eq("teamId", team._id).eq("userId", agent.userId),
      )
      .unique();
    if (row === null) return null;
    if (team.isPrivate) {
      // A private team with no members could never be opened again.
      const members = await ctx.db
        .query("teamMembers")
        .withIndex("by_teamId_and_userId", (q) => q.eq("teamId", team._id))
        .take(2);
      if (members.length < 2) throw appError("INVALID_INPUT");
    }
    await ctx.db.delete("teamMembers", row._id);
    await logAudit(ctx, member, {
      action: "team.member_removed",
      targetType: "team",
      targetId: team._id,
      metadata: { userId: agent.userId },
    });
    return null;
  },
});

// --- Create and update -------------------------------------------------------

/**
 * Creates an agent member. A workspace admin creates a master agent (role
 * admin); a master creates one of its agents (role member, below it).
 * The role is never taken from the caller.
 */
export const create = mutation({
  args: {
    name: v.string(),
    imageUrl: v.optional(v.union(v.string(), v.null())),
    description: v.optional(v.string()),
    model: v.optional(v.union(v.string(), v.null())),
    runtime: v.optional(agentRuntime),
    metadata: v.optional(v.record(v.string(), v.string())),
    teamIds: v.optional(v.array(v.id("teams"))),
  },
  returns: v.id("agents"),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const parent = await requireAgentCreator(ctx, member);
    const role = parent === null ? "admin" : "member";
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_orgId", (q) => q.eq("orgId", member.orgId))
      .take(MAX_AGENTS_PER_ORG);
    if (existing.length >= MAX_AGENTS_PER_ORG) {
      throw appError("LIMIT_REACHED");
    }
    const teamIds = args.teamIds ?? [];
    if (teamIds.length > MAX_TEAMS_PER_AGENT) throw appError("INVALID_INPUT");

    const name = cleanText(args.name, MAX_NAME);
    const imageUrl = cleanImageUrl(args.imageUrl ?? null);
    const userId = newAgentUserId();
    const agentId = await ctx.db.insert("agents", {
      orgId: member.orgId,
      userId,
      name,
      imageUrl,
      imageStorageId: null,
      description: cleanDescription(args.description ?? ""),
      model: cleanModel(args.model ?? null),
      runtime: args.runtime ?? "other",
      metadata: cleanMetadata(args.metadata ?? {}),
      parentAgentId: parent?._id ?? null,
      createdBy: member.userId,
      disabledAt: null,
      deletingAt: null,
      lastActiveAt: null,
    });
    // Mirror row so names and avatars resolve like any member's.
    await ctx.db.insert("users", {
      clerkId: userId,
      email: "",
      name,
      imageUrl,
      isAgent: true,
    });
    await ctx.db.insert("memberships", {
      orgId: member.orgId,
      userId,
      role,
      kind: "agent",
    });
    const agent = (await ctx.db.get("agents", agentId))!;
    for (const teamId of teamIds) {
      await joinTeam(ctx, member, agent, teamId);
    }
    await logAudit(ctx, member, {
      action: "agent.created",
      targetType: "agent",
      targetId: agentId,
      metadata: { name, userId, role },
    });
    return agentId;
  },
});

async function syncMirror(ctx: MutationCtx, agent: Doc<"agents">) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", agent.userId))
    .unique();
  const fields = { name: agent.name, imageUrl: await imageOf(ctx, agent) };
  if (user === null) {
    await ctx.db.insert("users", { clerkId: agent.userId, email: "", isAgent: true, ...fields });
  } else {
    await ctx.db.patch("users", user._id, fields);
  }
}

/** Loads an agent the caller may edit the profile of (itself, or managed). */
async function requireProfileEditor(
  ctx: MutationCtx,
  member: MemberInfo,
  agentId: Id<"agents">,
): Promise<{ agent: Doc<"agents"> }> {
  const agent = await loadAgent(ctx, member, agentId);
  if (agent.deletingAt !== null) throw appError("NOT_FOUND");
  if (agent.userId !== member.userId && !(await canManageAgent(ctx, member, agent))) {
    throw appError("FORBIDDEN");
  }
  return { agent };
}

/**
 * Changes an agent's profile (name, photo URL, description, model,
 * runtime, metadata): the agent itself, or whoever manages it. Its role
 * follows from its level and never changes.
 */
export const update = mutation({
  args: {
    agentId: v.id("agents"),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.union(v.string(), v.null())),
    description: v.optional(v.string()),
    model: v.optional(v.union(v.string(), v.null())),
    runtime: v.optional(agentRuntime),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const { agent } = await requireProfileEditor(ctx, member, args.agentId);

    const patch: Partial<Doc<"agents">> = {};
    const changed: string[] = [];
    if (args.name !== undefined) {
      patch.name = cleanText(args.name, MAX_NAME);
      changed.push("name");
    }
    if (args.imageUrl !== undefined) {
      patch.imageUrl = cleanImageUrl(args.imageUrl);
      // A new URL (or clearing the photo) replaces any uploaded photo.
      if (agent.imageStorageId !== null) {
        await ctx.storage.delete(agent.imageStorageId);
        patch.imageStorageId = null;
      }
      changed.push("image");
    }
    if (args.description !== undefined) {
      patch.description = cleanDescription(args.description);
      changed.push("description");
    }
    if (args.model !== undefined) {
      patch.model = cleanModel(args.model);
      changed.push("model");
    }
    if (args.runtime !== undefined) {
      patch.runtime = args.runtime;
      changed.push("runtime");
    }
    if (args.metadata !== undefined) {
      patch.metadata = cleanMetadata(args.metadata);
      changed.push("metadata");
    }
    if (changed.length === 0) return null;

    await ctx.db.patch("agents", agent._id, patch);
    await syncMirror(ctx, { ...agent, ...patch });
    await logAudit(ctx, member, {
      action: "agent.updated",
      targetType: "agent",
      targetId: agent._id,
      metadata: { fields: changed.join(",") },
    });
    return null;
  },
});

/** Upload URL for an agent photo; then call `setAvatar` with the storage id. */
export const generateAvatarUploadUrl = mutation({
  args: { agentId: v.id("agents") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    await requireProfileEditor(ctx, member, args.agentId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setAvatar = mutation({
  args: { agentId: v.id("agents"), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const { agent } = await requireProfileEditor(ctx, member, args.agentId);
    if (agent.imageStorageId === args.storageId) return null;
    // Photo URLs contain their storage id, so anyone in the org can see the
    // ids of other agents' photos. Refuse them: attaching one would let a
    // later photo change delete another agent's file.
    const owner = await ctx.db
      .query("agents")
      .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", args.storageId))
      .first();
    if (owner !== null) throw appError("INVALID_INPUT");
    const file = await ctx.db.system.get("_storage", args.storageId);
    if (
      file === null ||
      file.size > MAX_AVATAR_BYTES ||
      !(file.contentType ?? "").startsWith("image/")
    ) {
      if (file !== null) await ctx.storage.delete(args.storageId);
      throw appError("INVALID_INPUT");
    }
    if (agent.imageStorageId !== null) {
      await ctx.storage.delete(agent.imageStorageId);
    }
    await ctx.db.patch("agents", agent._id, { imageStorageId: args.storageId });
    await syncMirror(ctx, { ...agent, imageStorageId: args.storageId });
    await logAudit(ctx, member, {
      action: "agent.updated",
      targetType: "agent",
      targetId: agent._id,
      metadata: { fields: "image" },
    });
    return null;
  },
});

// --- Disable, enable, delete -------------------------------------------------

async function setDisabled(ctx: MutationCtx, agentId: Id<"agents">, disabled: boolean) {
  const member = await requireMember(ctx);
  const agent = await requireManagedAgent(ctx, member, agentId);
  if (agent.deletingAt !== null) throw appError("NOT_FOUND");
  await ctx.db.patch("agents", agent._id, { disabledAt: disabled ? Date.now() : null });
  await logAudit(ctx, member, {
    action: disabled ? "agent.disabled" : "agent.enabled",
    targetType: "agent",
    targetId: agent._id,
    metadata: { name: agent.name },
  });
}

/** A disabled agent's keys stop working and it can't manage other agents. */
export const disable = mutation({
  args: { agentId: v.id("agents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setDisabled(ctx, args.agentId, true);
    return null;
  },
});

export const enable = mutation({
  args: { agentId: v.id("agents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setDisabled(ctx, args.agentId, false);
    return null;
  },
});

/** The agent and every agent below it (bounded by the org's agent limit). */
async function subtree(ctx: DbCtx, root: Doc<"agents">): Promise<Doc<"agents">[]> {
  const result: Doc<"agents">[] = [root];
  for (let i = 0; i < result.length && result.length < MAX_AGENTS_PER_ORG; i++) {
    const children = await ctx.db
      .query("agents")
      .withIndex("by_parentAgentId", (q) => q.eq("parentAgentId", result[i]._id))
      .take(MAX_AGENTS_PER_ORG);
    result.push(...children.filter((c) => c.orgId === root.orgId));
  }
  return result;
}

/**
 * Deletes an agent and every agent below it. They disappear at once (keys
 * stop working); scheduled steps unassign their issues and remove their rows.
 * Refused when it would leave a private team with no members.
 */
export const remove = mutation({
  args: { agentId: v.id("agents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const root = await requireManagedAgent(ctx, member, args.agentId);
    if (root.deletingAt !== null) return null;
    const agents = await subtree(ctx, root);
    const leaving = new Set(agents.map((a) => a.userId));

    const checked = new Set<Id<"teams">>();
    for (const agent of agents) {
      const rows = await ctx.db
        .query("teamMembers")
        .withIndex("by_orgId_and_userId", (q) =>
          q.eq("orgId", agent.orgId).eq("userId", agent.userId),
        )
        .take(MAX_TEAMS_PER_AGENT);
      for (const row of rows) {
        if (checked.has(row.teamId)) continue;
        checked.add(row.teamId);
        const team = await ctx.db.get("teams", row.teamId);
        if (team === null || !team.isPrivate || team.deletingAt != null) continue;
        const members = await ctx.db
          .query("teamMembers")
          .withIndex("by_teamId_and_userId", (q) => q.eq("teamId", team._id))
          .take(MAX_AGENTS_PER_ORG);
        if (members.every((m) => leaving.has(m.userId))) {
          throw appError("INVALID_INPUT");
        }
      }
    }

    const now = Date.now();
    for (const agent of agents) {
      await ctx.db.patch("agents", agent._id, { deletingAt: now, disabledAt: agent.disabledAt ?? now });
      await ctx.scheduler.runAfter(0, internal.agents.deleteStep, { agentId: agent._id });
    }
    await logAudit(ctx, member, {
      action: "agent.deleted",
      targetType: "agent",
      targetId: root._id,
      metadata: { name: root.name, userId: root.userId, count: String(agents.length) },
    });
    return null;
  },
});

/**
 * When an organization is deleted: marks its agents as deleting and
 * schedules their delete steps, in batches.
 */
export const deleteOrgAgents = internalMutation({
  args: { orgId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(MAX_AGENTS_PER_ORG);
    const now = Date.now();
    let marked = 0;
    for (const agent of agents) {
      if (agent.deletingAt !== null) continue;
      await ctx.db.patch("agents", agent._id, { deletingAt: now, disabledAt: agent.disabledAt ?? now });
      await ctx.scheduler.runAfter(0, internal.agents.deleteStep, { agentId: agent._id });
      if (++marked === STEP_BATCH) {
        await ctx.scheduler.runAfter(0, internal.agents.deleteOrgAgents, { orgId: args.orgId });
        return null;
      }
    }
    return null;
  },
});

/**
 * One step of deleting an agent: unassigns its issues, then removes its team
 * memberships, keys, membership, photo and the agent row. The mirror `users`
 * row stays so history still shows its name. Reschedules until done.
 */
export const deleteStep = internalMutation({
  args: { agentId: v.id("agents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const agent = await ctx.db.get("agents", args.agentId);
    if (agent === null || agent.deletingAt === null) return null;
    const again = () =>
      ctx.scheduler.runAfter(0, internal.agents.deleteStep, { agentId: agent._id });

    const issues = await ctx.db
      .query("issues")
      .withIndex("by_orgId_and_assigneeId", (q) =>
        q.eq("orgId", agent.orgId).eq("assigneeId", agent.userId),
      )
      .take(STEP_BATCH);
    for (const issue of issues) {
      await ctx.db.patch("issues", issue._id, { assigneeId: null });
      await logActivity(ctx, {
        orgId: agent.orgId,
        issueId: issue._id,
        actorId: "system",
        type: "assignee",
        from: agent.userId,
        to: null,
      });
    }
    if (issues.length === STEP_BATCH) {
      await again();
      return null;
    }

    const teamRows = await ctx.db
      .query("teamMembers")
      .withIndex("by_orgId_and_userId", (q) =>
        q.eq("orgId", agent.orgId).eq("userId", agent.userId),
      )
      .take(STEP_BATCH);
    for (const row of teamRows) {
      await ctx.db.delete("teamMembers", row._id);
    }
    if (teamRows.length === STEP_BATCH) {
      await again();
      return null;
    }

    const keys = await ctx.db
      .query("agentKeys")
      .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
      .take(STEP_BATCH);
    for (const key of keys) {
      await ctx.db.delete("agentKeys", key._id);
    }
    if (keys.length === STEP_BATCH) {
      await again();
      return null;
    }

    const membership = await agentMembership(ctx, agent);
    if (membership !== null) {
      await ctx.db.delete("memberships", membership._id);
    }
    if (agent.imageStorageId !== null) {
      await ctx.storage.delete(agent.imageStorageId);
      await syncMirror(ctx, { ...agent, imageStorageId: null });
    }
    await ctx.db.delete("agents", agent._id);
    return null;
  },
});
