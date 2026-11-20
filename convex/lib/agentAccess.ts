import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isAgentUserId } from "./agentIds";
import type { MemberInfo } from "./auth";
import { appError } from "./errors";

// Agents come in two levels:
// - Master agents (`parentAgentId === null`) are created by workspace admins.
//   They are admins and can create agents.
// - A master's agents are members and can't create agents.
// Who manages which agent:
// - Workspace admins (people) manage every agent of the org.
// - A live master manages the agents it created.
// - Any agent may edit its own profile (name, photo, description, model,
//   metadata).
// Roles are never taken from a caller: `agents.create` sets them from who
// is creating.

type DbCtx = QueryCtx | MutationCtx;

/** Safety bound for bounded queries; not a plan limit. */
export const MAX_AGENTS_PER_ORG = 1000;

export function isMaster(agent: Doc<"agents">): boolean {
  return agent.parentAgentId === null;
}

function isLive(agent: Doc<"agents">): boolean {
  return agent.disabledAt === null && agent.deletingAt === null;
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
 * The caller's right to create agents: a workspace admin (person) creates
 * masters; a live master creates its agents. Returns the calling master
 * (the new agent's parent), or null for a person.
 */
export async function requireAgentCreator(
  ctx: DbCtx,
  member: MemberInfo,
): Promise<Doc<"agents"> | null> {
  if (!isAgentUserId(member.userId)) {
    if (member.role !== "admin") {
      throw appError("FORBIDDEN");
    }
    return null;
  }
  const self = await agentOfMember(ctx, member);
  if (self === null || !isMaster(self) || !isLive(self)) {
    throw appError("FORBIDDEN");
  }
  return self;
}

/** Whether the caller may change `target`'s settings, keys and teams. */
export async function canManageAgent(
  ctx: DbCtx,
  member: MemberInfo,
  target: Doc<"agents">,
): Promise<boolean> {
  if (target.orgId !== member.orgId) {
    return false;
  }
  if (!isAgentUserId(member.userId)) {
    return member.role === "admin";
  }
  const self = await agentOfMember(ctx, member);
  if (self === null || !isMaster(self) || !isLive(self)) {
    return false;
  }
  return target.parentAgentId === self._id;
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
