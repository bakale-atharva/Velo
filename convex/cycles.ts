import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { logActivity } from "./lib/activity";
import { requireMember, type MemberInfo } from "./lib/auth";
import { appError } from "./lib/errors";
import { cleanText } from "./lib/input";
import { issueValidator, toPublicIssue } from "./lib/issueOps";
import { requirePermission } from "./lib/permissions";
import { requireTeamAccess } from "./lib/teamAccess";
import schema from "./schema";

// Changing cycles needs `cycles.manage`, which members have by default (a
// custom role can take it away). Status moves on a schedule: see `rollover`
// below.

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
    const member = await requirePermission(ctx, "cycles.manage");
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
    const member = await requirePermission(ctx, "cycles.manage");
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
  args: {
    cycleId: v.id("cycles"),
    // true leaves sub-issues out (they show on their parent's page).
    topLevel: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
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
      page: result.page
        .filter((issue) => issue.archivedAt === null && (args.topLevel !== true || issue.parentId === null))
        .map(toPublicIssue),
    };
  },
});

// ---------------------------------------------------------------------------
// Rollover (runs every 15 minutes from convex/crons.ts)

const ROLLOVER_BATCH = 20;
const MOVE_BATCH = 100;

/** The team's first cycle that starts at or after `from` and is not completed. */
async function nextCycle(
  ctx: MutationCtx,
  teamId: Id<"teams">,
  from: number,
): Promise<Doc<"cycles"> | null> {
  for await (const cycle of ctx.db
    .query("cycles")
    .withIndex("by_teamId_and_startsAt", (q) =>
      q.eq("teamId", teamId).gte("startsAt", from),
    )) {
    if (cycle.status !== "completed") {
      return cycle;
    }
  }
  return null;
}

/**
 * Moves one page (100 issues) of a finished cycle's unfinished issues to the
 * next cycle, or out of any cycle, then schedules the next page.
 */
export const moveUnfinished = internalMutation({
  args: {
    cycleId: v.id("cycles"),
    targetCycleId: v.union(v.id("cycles"), v.null()),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get("cycles", args.cycleId);
    if (cycle === null) {
      return null;
    }
    const target =
      args.targetCycleId === null ? null : await ctx.db.get("cycles", args.targetCycleId);
    const page = await ctx.db
      .query("issues")
      .withIndex("by_cycleId", (q) => q.eq("cycleId", cycle._id))
      .paginate({ numItems: MOVE_BATCH, cursor: args.cursor });
    for (const issue of page.page) {
      const finished = issue.stateType === "completed" || issue.stateType === "canceled";
      if (finished || issue.archivedAt !== null) {
        continue;
      }
      await ctx.db.patch("issues", issue._id, {
        cycleId: target === null ? null : target._id,
      });
      await logActivity(ctx, {
        orgId: issue.orgId,
        issueId: issue._id,
        actorId: "system",
        type: "cycle",
        from: cycle.name,
        to: target === null ? null : target.name,
      });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.cycles.moveUnfinished, {
        ...args,
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});

/** Starts cycles whose time has come and completes cycles that have ended. */
export const rollover = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const starting = await ctx.db
      .query("cycles")
      .withIndex("by_status_and_startsAt", (q) =>
        q.eq("status", "upcoming").lte("startsAt", now),
      )
      .take(ROLLOVER_BATCH);
    for (const cycle of starting) {
      await ctx.db.patch("cycles", cycle._id, { status: "active" });
    }
    const ending = await ctx.db
      .query("cycles")
      .withIndex("by_status_and_endsAt", (q) =>
        q.eq("status", "active").lte("endsAt", now),
      )
      .take(ROLLOVER_BATCH);
    for (const cycle of ending) {
      await ctx.db.patch("cycles", cycle._id, { status: "completed" });
      const target = await nextCycle(ctx, cycle.teamId, cycle.endsAt);
      await ctx.scheduler.runAfter(0, internal.cycles.moveUnfinished, {
        cycleId: cycle._id,
        targetCycleId: target === null ? null : target._id,
        cursor: null,
      });
    }
    if (starting.length === ROLLOVER_BATCH || ending.length === ROLLOVER_BATCH) {
      await ctx.scheduler.runAfter(0, internal.cycles.rollover, {});
    }
    return null;
  },
});
