import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireMember, type MemberInfo } from "./lib/auth";
import { appError } from "./lib/errors";
import { cleanText } from "./lib/input";
import { issueValidator, toPublicIssue } from "./lib/issueOps";
import { requireTeamAccess } from "./lib/teamAccess";
import schema from "./schema";

// Changing cycles needs `cycles.manage`, which every member has by default
// (custom roles can take it away in B6). Status moves on a schedule: see
// `rollover` (B4 commit 4).

const MAX_CYCLES = 200;
const MAX_NAME_LENGTH = 80;
// Overlap checks look at this many neighbours; one is the cycle being edited.
const NEIGHBOURS = 2;

const cycleValidator = schema.doc("cycles");

type DbCtx = QueryCtx | MutationCtx;

/** Loads a cycle of a team the member may see. */
export async function loadCycle(
  ctx: DbCtx,
  member: MemberInfo,
  cycleId: Id<"cycles">,
): Promise<{ cycle: Doc<"cycles">; team: Doc<"teams"> }> {
  const cycle = await ctx.db.get("cycles", cycleId);
  if (cycle === null || cycle.orgId !== member.orgId) {
    throw appError("NOT_FOUND");
  }
  const team = await requireTeamAccess(ctx, member, cycle.teamId);
  return { cycle, team };
}

function assertRange(startsAt: number, endsAt: number) {
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
    throw appError("INVALID_INPUT");
  }
}

/**
 * Refuses a range that overlaps another cycle of the team. Cycles never
 * overlap, so only the cycles starting last before `endsAt` can collide.
 */
async function assertNoOverlap(
  ctx: DbCtx,
  teamId: Id<"teams">,
  startsAt: number,
  endsAt: number,
  except: Id<"cycles"> | null,
) {
  const before = await ctx.db
    .query("cycles")
    .withIndex("by_teamId_and_startsAt", (q) =>
      q.eq("teamId", teamId).lt("startsAt", endsAt),
    )
    .order("desc")
    .take(NEIGHBOURS);
  const other = before.find((cycle) => cycle._id !== except);
  if (other !== undefined && other.endsAt > startsAt) {
    throw appError("INVALID_INPUT");
  }
}

function statusAt(now: number, startsAt: number): Doc<"cycles">["status"] {
  return startsAt <= now ? "active" : "upcoming";
}

/** Creates the next cycle of a team. It must end in the future. */
export const create = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    startsAt: v.number(),
    endsAt: v.number(),
  },
  returns: v.id("cycles"),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const team = await requireTeamAccess(ctx, member, args.teamId);
    if (team.archivedAt !== null) {
      throw appError("INVALID_INPUT");
    }
    assertRange(args.startsAt, args.endsAt);
    const now = Date.now();
    if (args.endsAt <= now) {
      throw appError("INVALID_INPUT");
    }
    await assertNoOverlap(ctx, team._id, args.startsAt, args.endsAt, null);
    const last = await ctx.db
      .query("cycles")
      .withIndex("by_teamId_and_number", (q) => q.eq("teamId", team._id))
      .order("desc")
      .first();
    const number = last === null ? 1 : last.number + 1;
    if (number > MAX_CYCLES * 50) {
      throw appError("LIMIT_REACHED");
    }
    const name =
      args.name === undefined ? `Cycle ${number}` : cleanText(args.name, MAX_NAME_LENGTH);
    return await ctx.db.insert("cycles", {
      orgId: member.orgId,
      teamId: team._id,
      number,
      name,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      status: statusAt(now, args.startsAt),
    });
  },
});

/** Renames a cycle or moves its dates. Completed cycles keep their dates. */
export const update = mutation({
  args: {
    cycleId: v.id("cycles"),
    name: v.optional(v.string()),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const { cycle } = await loadCycle(ctx, member, args.cycleId);
    const name =
      args.name === undefined ? cycle.name : cleanText(args.name, MAX_NAME_LENGTH);
    const startsAt = args.startsAt ?? cycle.startsAt;
    const endsAt = args.endsAt ?? cycle.endsAt;
    const datesChanged = startsAt !== cycle.startsAt || endsAt !== cycle.endsAt;
    if (!datesChanged) {
      await ctx.db.patch("cycles", cycle._id, { name });
      return null;
    }
    if (cycle.status === "completed") {
      throw appError("INVALID_INPUT");
    }
    assertRange(startsAt, endsAt);
    const now = Date.now();
    if (endsAt <= now) {
      throw appError("INVALID_INPUT");
    }
    await assertNoOverlap(ctx, cycle.teamId, startsAt, endsAt, cycle._id);
    await ctx.db.patch("cycles", cycle._id, {
      name,
      startsAt,
      endsAt,
      status: statusAt(now, startsAt),
    });
    return null;
  },
});

/** A team's cycles, newest first. */
export const list = query({
  args: { teamId: v.id("teams") },
  returns: v.array(cycleValidator),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const team = await requireTeamAccess(ctx, member, args.teamId);
    return await ctx.db
      .query("cycles")
      .withIndex("by_teamId_and_startsAt", (q) => q.eq("teamId", team._id))
      .order("desc")
      .take(MAX_CYCLES);
  },
});

/** A cycle by its team and number, e.g. ENG cycle 4. */
export const get = query({
  args: { teamId: v.id("teams"), number: v.number() },
  returns: cycleValidator,
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const team = await requireTeamAccess(ctx, member, args.teamId);
    const cycle = await ctx.db
      .query("cycles")
      .withIndex("by_teamId_and_number", (q) =>
        q.eq("teamId", team._id).eq("number", args.number),
      )
      .unique();
    if (cycle === null) {
      throw appError("NOT_FOUND");
    }
    return cycle;
  },
});

/** A cycle's issues (archived ones left out), page by page. */
export const listIssues = query({
  args: { cycleId: v.id("cycles"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(issueValidator),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    // A cycle's issues all belong to its team, so the team check covers them.
    const { cycle } = await loadCycle(ctx, member, args.cycleId);
    const result = await ctx.db
      .query("issues")
      .withIndex("by_cycleId", (q) => q.eq("cycleId", cycle._id))
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.filter((issue) => issue.archivedAt === null).map(toPublicIssue),
    };
  },
});
