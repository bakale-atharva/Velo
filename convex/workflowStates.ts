import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireAdmin, requireMember, type MemberInfo } from "./lib/auth";
import { appError } from "./lib/errors";
import { cleanColor, cleanText } from "./lib/input";
import { requireTeamAccess } from "./lib/teamAccess";
import schema, { stateType } from "./schema";

// Changing a team's workflow needs `teams.manage`: admins only until B6.

const MAX_STATES = 50;
const MAX_NAME_LENGTH = 40;

async function statesOfTeam(ctx: QueryCtx | MutationCtx, teamId: Id<"teams">) {
  return await ctx.db
    .query("workflowStates")
    .withIndex("by_teamId_and_position", (q) => q.eq("teamId", teamId))
    .take(MAX_STATES);
}

async function loadState(
  ctx: MutationCtx,
  member: MemberInfo,
  stateId: Id<"workflowStates">,
): Promise<Doc<"workflowStates">> {
  const state = await ctx.db.get("workflowStates", stateId);
  if (state === null || state.orgId !== member.orgId) {
    throw appError("NOT_FOUND");
  }
  await requireTeamAccess(ctx, member, state.teamId);
  return state;
}

/** A team's workflow states in board order. */
export const list = query({
  args: { teamId: v.id("teams") },
  returns: v.array(schema.doc("workflowStates")),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const team = await requireTeamAccess(ctx, member, args.teamId);
    return await statesOfTeam(ctx, team._id);
  },
});

/** Adds a state after the team's last one. */
export const create = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.string(),
    type: stateType,
    color: v.string(),
  },
  returns: v.id("workflowStates"),
  handler: async (ctx, args) => {
    const member = await requireAdmin(ctx);
    const team = await requireTeamAccess(ctx, member, args.teamId);
    const states = await statesOfTeam(ctx, team._id);
    if (states.length >= MAX_STATES) {
      throw appError("LIMIT_REACHED");
    }
    const last = states.at(-1);
    return await ctx.db.insert("workflowStates", {
      orgId: member.orgId,
      teamId: team._id,
      name: cleanText(args.name, MAX_NAME_LENGTH),
      type: args.type,
      color: cleanColor(args.color),
      position: last === undefined ? 0 : last.position + 1,
    });
  },
});

/** Renames or recolors a state. Its type is fixed once created. */
export const update = mutation({
  args: {
    stateId: v.id("workflowStates"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireAdmin(ctx);
    const state = await loadState(ctx, member, args.stateId);
    await ctx.db.patch("workflowStates", state._id, {
      name:
        args.name === undefined ? state.name : cleanText(args.name, MAX_NAME_LENGTH),
      color: args.color === undefined ? state.color : cleanColor(args.color),
    });
    return null;
  },
});

/** Sets the board order. `stateIds` must list every state of the team once. */
export const reorder = mutation({
  args: { teamId: v.id("teams"), stateIds: v.array(v.id("workflowStates")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireAdmin(ctx);
    const team = await requireTeamAccess(ctx, member, args.teamId);
    const states = await statesOfTeam(ctx, team._id);
    const known = new Set(states.map((state) => state._id));
    const given = new Set(args.stateIds);
    if (
      args.stateIds.length !== states.length ||
      given.size !== states.length ||
      !args.stateIds.every((id) => known.has(id))
    ) {
      throw appError("INVALID_INPUT");
    }
    for (const [position, stateId] of args.stateIds.entries()) {
      await ctx.db.patch("workflowStates", stateId, { position });
    }
    return null;
  },
});

/** Deletes a state no issue uses. A team always keeps at least one. */
export const remove = mutation({
  args: { stateId: v.id("workflowStates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireAdmin(ctx);
    const state = await loadState(ctx, member, args.stateId);
    const remaining = await ctx.db
      .query("workflowStates")
      .withIndex("by_teamId_and_position", (q) => q.eq("teamId", state.teamId))
      .take(2);
    if (remaining.length < 2) {
      throw appError("INVALID_INPUT");
    }
    const inUse = await ctx.db
      .query("issues")
      .withIndex("by_teamId_and_stateId_and_rank", (q) =>
        q.eq("teamId", state.teamId).eq("stateId", state._id),
      )
      .first();
    if (inUse !== null) {
      throw appError("INVALID_INPUT");
    }
    await ctx.db.delete("workflowStates", state._id);
    return null;
  },
});
