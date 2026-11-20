import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isAgentUserId } from "./agentIds";
import type { MemberInfo } from "./auth";
import { appError } from "./errors";
import { hasPermission } from "./permissions";

// Who may manage which agent:
// - A person with `agents.manage` (admins by default) manages every agent of
//   the org.
// - An agent manages only agents below it (its subtree), and only while it
//   has `canManageAgents` and is not disabled. It never gets the permission
//   from its role.
// - Any agent may edit its own profile (name, photo, description, model,
//   metadata), but not its own role or `canManageAgents`.

type DbCtx = QueryCtx | MutationCtx;

/** Safety bound for bounded queries; not a plan limit. */
export const MAX_AGENTS_PER_ORG = 1000;
/** Agents below a top-level agent go at most this many levels deep. */
export const MAX_AGENT_DEPTH = 5;

const ROLE_RANK: Record<string, number> = { member: 0, admin: 1 };

/** Agent roles, lowest first. */
export const AGENT_ROLES = ["member", "admin"] as const;

export function roleRank(role: string): number {
  return ROLE_RANK[role] ?? 0;
}

/** The agent row of an agent member, or null for people. */
export async function agentOfMember(
  ctx: DbCtx,
  member: MemberInfo,
): Promise<Doc<"agents"> | null> {
  if (!isAgentUserId(member.userId)) {
    return null;
  }
  return await ctx.db
    .query("agents")
    .withIndex("by_orgId_and_userId", (q) =>
      q.eq("orgId", member.orgId).eq("userId", member.userId),
    )
    .unique();
}

/** Loads an agent of the caller's org (NOT_FOUND otherwise). */
export async function loadAgent(
  ctx: DbCtx,
  member: MemberInfo,
  agentId: Id<"agents">,
): Promise<Doc<"agents">> {
  const agent = await ctx.db.get("agents", agentId);
  if (agent === null || agent.orgId !== member.orgId) {
    throw appError("NOT_FOUND");
  }
  return agent;
}

/** Levels from the top: an agent people created is at depth 1. */
export async function depthOf(ctx: DbCtx, agent: Doc<"agents">): Promise<number> {
  let depth = 1;
  let parentId = agent.parentAgentId;
  while (parentId !== null && depth <= MAX_AGENT_DEPTH) {
    const parent = await ctx.db.get("agents", parentId);
    if (parent === null) break;
    depth += 1;
    parentId = parent.parentAgentId;
  }
  return depth;
}

/** Whether `target` sits below `ancestorId` (not equal to it). */
export async function isBelow(
  ctx: DbCtx,
  ancestorId: Id<"agents">,
  target: Doc<"agents">,
): Promise<boolean> {
  let parentId = target.parentAgentId;
  for (let hops = 0; parentId !== null && hops < MAX_AGENT_DEPTH; hops++) {
    if (parentId === ancestorId) return true;
    const parent = await ctx.db.get("agents", parentId);
    if (parent === null) return false;
    parentId = parent.parentAgentId;
  }
  return false;
}

/**
 * The caller's right to create agents. People need `agents.manage`; agents
 * need `canManageAgents`. Returns the calling agent's row (null for people).
 */
export async function requireAgentCreator(
  ctx: DbCtx,
  member: MemberInfo,
): Promise<Doc<"agents"> | null> {
  if (!isAgentUserId(member.userId)) {
    if (!(await hasPermission(ctx, member, "agents.manage"))) {
      throw appError("FORBIDDEN");
    }
    return null;
  }
  const self = await agentOfMember(ctx, member);
  if (self === null || self.disabledAt !== null || !self.canManageAgents) {
    throw appError("FORBIDDEN");
  }
  return self;
}

/** An agent's membership row (holds its role and custom role). */
export async function agentMembership(
  ctx: DbCtx,
  agent: Doc<"agents">,
): Promise<Doc<"memberships"> | null> {
  return await ctx.db
    .query("memberships")
    .withIndex("by_orgId_and_userId", (q) =>
      q.eq("orgId", agent.orgId).eq("userId", agent.userId),
    )
    .unique();
}

/**
 * Whether the caller may change `target`'s settings, keys and teams. Nobody
 * manages an agent whose role is above their own: otherwise a member with
 * `agents.manage`, or a parent agent that was demoted, could make a key for
 * an admin agent and act as admin.
 */
export async function canManageAgent(
  ctx: DbCtx,
  member: MemberInfo,
  target: Doc<"agents">,
): Promise<boolean> {
  if (target.orgId !== member.orgId) {
    return false;
  }
  const targetRole = (await agentMembership(ctx, target))?.role ?? "member";
  if (roleRank(targetRole) > roleRank(member.role)) {
    return false;
  }
  if (!isAgentUserId(member.userId)) {
    return await hasPermission(ctx, member, "agents.manage");
  }
  const self = await agentOfMember(ctx, member);
  if (self === null || self.disabledAt !== null || !self.canManageAgents) {
    return false;
  }
  return await isBelow(ctx, self._id, target);
}

/** `loadAgent`, then FORBIDDEN unless the caller manages it. */
export async function requireManagedAgent(
  ctx: DbCtx,
  member: MemberInfo,
  agentId: Id<"agents">,
): Promise<Doc<"agents">> {
  const agent = await loadAgent(ctx, member, agentId);
  if (!(await canManageAgent(ctx, member, agent))) {
    throw appError("FORBIDDEN");
  }
  return agent;
}

/**
 * An agent may never be given a higher role than its creator's. This holds
 * for people too: a member whose custom role grants `agents.manage` must not
 * get admin rights by making an admin agent.
 */
export function assertRoleAllowed(member: MemberInfo, role: string) {
  if (!(role in ROLE_RANK)) {
    throw appError("INVALID_INPUT");
  }
  if (roleRank(role) > roleRank(member.role)) {
    throw appError("FORBIDDEN");
  }
}
