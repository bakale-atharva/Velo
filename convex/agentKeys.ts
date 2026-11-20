import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { canManageAgent, loadAgent } from "./lib/agentAccess";
import { logAudit } from "./lib/audit";
import { requireMember, type MemberInfo } from "./lib/auth";
import { appError } from "./lib/errors";
import { cleanText } from "./lib/input";

// An agent's API keys. Whoever manages the agent (and the agent itself)
// may create, list and revoke them. Keys are random 32-byte strings made in
// an action (mutations only have a seeded random generator); only their
// SHA-256 hash is stored, and the key itself is returned exactly once.

type DbCtx = QueryCtx | MutationCtx;

export const KEY_PREFIX = "velo_";
const PREFIX_LENGTH = 12;
const MAX_LABEL = 60;
const MAX_KEYS_PER_AGENT = 20;

const keyValidator = v.object({
  _id: v.id("agentKeys"),
  _creationTime: v.number(),
  agentId: v.id("agents"),
  label: v.string(),
  prefix: v.string(),
  createdBy: v.string(),
  lastUsedAt: v.union(v.number(), v.null()),
  revokedAt: v.union(v.number(), v.null()),
});

/** Hex SHA-256 of a key, as stored in `agentKeys.hash`. */
export async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = btoa(String.fromCharCode(...bytes));
  return KEY_PREFIX + base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The agent, if the caller is that agent or manages it. */
async function requireKeyOwner(
  ctx: DbCtx,
  member: MemberInfo,
  agentId: Id<"agents">,
): Promise<Doc<"agents">> {
  const agent = await loadAgent(ctx, member, agentId);
  if (agent.deletingAt !== null) throw appError("NOT_FOUND");
  if (agent.userId !== member.userId && !(await canManageAgent(ctx, member, agent))) {
    throw appError("FORBIDDEN");
  }
  return agent;
}

/** Stores a new key's hash after checking the caller (runs as the caller). */
export const insertKey = internalMutation({
  args: { agentId: v.id("agents"), label: v.string(), prefix: v.string(), hash: v.string() },
  returns: v.id("agentKeys"),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const agent = await requireKeyOwner(ctx, member, args.agentId);
    const label = cleanText(args.label, MAX_LABEL);
    const keys = await ctx.db
      .query("agentKeys")
      .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
      .take(MAX_KEYS_PER_AGENT * 5);
    if (keys.filter((k) => k.revokedAt === null).length >= MAX_KEYS_PER_AGENT) {
      throw appError("LIMIT_REACHED");
    }
    const keyId = await ctx.db.insert("agentKeys", {
      orgId: member.orgId,
      agentId: agent._id,
      label,
      prefix: args.prefix,
      hash: args.hash,
      createdBy: member.userId,
      lastUsedAt: null,
      revokedAt: null,
    });
    await logAudit(ctx, member, {
      action: "agentKey.created",
      targetType: "agent",
      targetId: agent._id,
      metadata: { keyId, label, prefix: args.prefix },
    });
    return keyId;
  },
});

/** Creates an API key for an agent. The key is in the result only this once. */
export const create = action({
  args: { agentId: v.id("agents"), label: v.string() },
  returns: v.object({ keyId: v.id("agentKeys"), key: v.string(), prefix: v.string() }),
  handler: async (ctx, args) => {
    const key = newKey();
    const prefix = key.slice(0, PREFIX_LENGTH);
    const keyId: Id<"agentKeys"> = await ctx.runMutation(internal.agentKeys.insertKey, {
      agentId: args.agentId,
      label: args.label,
      prefix,
      hash: await hashKey(key),
    });
    return { keyId, key, prefix };
  },
});

/** An agent's keys, newest first, without their secrets. */
export const list = query({
  args: { agentId: v.id("agents") },
  returns: v.array(keyValidator),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const agent = await requireKeyOwner(ctx, member, args.agentId);
    const keys = await ctx.db
      .query("agentKeys")
      .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
      .order("desc")
      .take(MAX_KEYS_PER_AGENT * 5);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return keys.map(({ hash, orgId, ...rest }) => rest);
  },
});

/** Revokes a key; the next request made with it is refused. */
export const revoke = mutation({
  args: { keyId: v.id("agentKeys") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const key = await ctx.db.get("agentKeys", args.keyId);
    if (key === null || key.orgId !== member.orgId) throw appError("NOT_FOUND");
    await requireKeyOwner(ctx, member, key.agentId);
    if (key.revokedAt !== null) return null;
    await ctx.db.patch("agentKeys", key._id, { revokedAt: Date.now() });
    await logAudit(ctx, member, {
      action: "agentKey.revoked",
      targetType: "agent",
      targetId: key.agentId,
      metadata: { keyId: key._id, label: key.label, prefix: key.prefix },
    });
    return null;
  },
});
