import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { loadCycle } from "./cycles";
import { requireMember } from "./lib/auth";
import { appError } from "./lib/errors";
import { filterVisibleIssues, requireTeamAccess } from "./lib/teamAccess";
import { loadProject } from "./projects";
import { stateType } from "./schema";

// Bucketed series for the charts. Each query reads a bounded number of issues
// and returns small arrays, never issues. `now` comes from the client (start
// of its day), because queries may not read the clock; a fixed value for the
// day also lets the result stay cached. `truncated` says a cap was hit, so
// the UI can say the chart covers the latest issues only.

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const TEAM_WEEKS = 12;
const MY_WEEKS = 8;
const SPARK_WEEKS = 12;
// Reads per series. Enough for a busy team's quarter.
const MAX_ISSUES = 2000;
const MAX_OPEN_PER_STATE = 1000;
const MAX_STATES = 50;
const MAX_PROJECTS = 100;
const MAX_SPARK_ISSUES = 300;
const MAX_ASSIGNEES = 8;
// Past this many days a series switches to weekly points.
const MAX_DAILY_POINTS = 120;

const weekPoint = v.object({ start: v.number(), completed: v.number(), created: v.number() });

const CYCLE_TIME_BUCKETS = [
  { label: "<1d", max: 1 },
  { label: "1-2d", max: 3 },
  { label: "3-7d", max: 8 },
  { label: "1-2w", max: 15 },
  { label: "2-4w", max: 31 },
  { label: "1m+", max: Infinity },
] as const;

type Issue = Doc<"issues">;

function assertNow(now: number) {
  if (!Number.isFinite(now) || now <= 0) {
    throw appError("INVALID_INPUT");
  }
}

/** Monday 00:00 UTC of the week holding `ts`. */
function weekStart(ts: number): number {
  const day = Math.floor(ts / DAY) * DAY;
  // 1970-01-01 was a Thursday; shift so weeks start on Monday.
  const weekday = (Math.floor(day / DAY) + 3) % 7;
  return day - weekday * DAY;
}

/** `count` week starts ending with the week of `now`, oldest first. */
function weekStarts(now: number, count: number): number[] {
  const last = weekStart(now);
  return Array.from({ length: count }, (_, index) => last - (count - 1 - index) * WEEK);
}

function bucketIndex(starts: number[], ts: number): number {
  for (let index = starts.length - 1; index >= 0; index--) {
    if (ts >= starts[index]) return index;
  }
  return -1;
}

function percentile(sorted: number[], share: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(share * sorted.length) - 1));
  return Math.round(sorted[index] * 10) / 10;
}

/** Point times from `from` to `to` (inclusive of the day of `to`): daily, or weekly when long. */
function seriesTimes(from: number, to: number): number[] {
  const start = Math.floor(from / DAY) * DAY;
  const end = Math.floor(to / DAY) * DAY;
  const days = Math.max(0, Math.round((end - start) / DAY));
  const step = days > MAX_DAILY_POINTS ? WEEK : DAY;
  const times: number[] = [];
  for (let t = start; t < end; t += step) times.push(t);
  times.push(end);
  return times;
}

// ---------------------------------------------------------------------------
// Team

export const team = query({
  args: { teamId: v.id("teams"), now: v.number() },
  returns: v.object({
    weeks: v.array(weekPoint),
    openByState: v.array(
      v.object({ stateId: v.id("workflowStates"), name: v.string(), type: stateType, count: v.number() }),
    ),
    openByAssignee: v.array(v.object({ assigneeId: v.union(v.string(), v.null()), count: v.number() })),
    otherAssignees: v.number(),
    cycleTime: v.object({
      buckets: v.array(v.object({ label: v.string(), count: v.number() })),
      medianDays: v.union(v.number(), v.null()),
      p75Days: v.union(v.number(), v.null()),
      sample: v.number(),
    }),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    assertNow(args.now);
    const member = await requireMember(ctx);
    const team = await requireTeamAccess(ctx, member, args.teamId);
    const starts = weekStarts(args.now, TEAM_WEEKS);
    let truncated = false;

    const completed = await ctx.db
      .query("issues")
      .withIndex("by_teamId_and_completedAt", (q) => q.eq("teamId", team._id).gte("completedAt", starts[0]))
      .take(MAX_ISSUES);
    const created = await ctx.db
      .query("issues")
      .withIndex("by_orgId_and_teamId", (q) =>
        q.eq("orgId", member.orgId).eq("teamId", team._id).gte("_creationTime", starts[0]),
      )
      .take(MAX_ISSUES);
    truncated ||= completed.length === MAX_ISSUES || created.length === MAX_ISSUES;

    const weeks = starts.map((start) => ({ start, completed: 0, created: 0 }));
    for (const issue of completed) {
      const index = bucketIndex(starts, issue.completedAt!);
      if (index >= 0) weeks[index].completed++;
    }
    for (const issue of created) {
      const index = bucketIndex(starts, issue._creationTime);
      if (index >= 0) weeks[index].created++;
    }

    // Open work: every unfinished state of the team, read state by state.
    const states = await ctx.db
      .query("workflowStates")
      .withIndex("by_teamId_and_position", (q) => q.eq("teamId", team._id))
      .take(MAX_STATES);
    const openByState: { stateId: Id<"workflowStates">; name: string; type: Doc<"workflowStates">["type"]; count: number }[] = [];
    const byAssignee = new Map<string | null, number>();
    for (const state of states) {
      if (state.type === "completed" || state.type === "canceled") continue;
      const issues = await ctx.db
        .query("issues")
        .withIndex("by_teamId_and_archivedAt_and_stateId_and_rank", (q) =>
          q.eq("teamId", team._id).eq("archivedAt", null).eq("stateId", state._id),
        )
        .take(MAX_OPEN_PER_STATE);
      truncated ||= issues.length === MAX_OPEN_PER_STATE;
      openByState.push({ stateId: state._id, name: state.name, type: state.type, count: issues.length });
      for (const issue of issues) {
        byAssignee.set(issue.assigneeId, (byAssignee.get(issue.assigneeId) ?? 0) + 1);
      }
    }
    const ranked = [...byAssignee.entries()]
      .map(([assigneeId, count]) => ({ assigneeId, count }))
      .sort((a, b) => b.count - a.count);
    const openByAssignee = ranked.slice(0, MAX_ASSIGNEES);
    const otherAssignees = ranked.slice(MAX_ASSIGNEES).reduce((sum, row) => sum + row.count, 0);

    // Cycle time: creation to completion, for issues completed in the window.
    const durations = completed
      .map((issue) => (issue.completedAt! - issue._creationTime) / DAY)
      .sort((a, b) => a - b);
    const buckets = CYCLE_TIME_BUCKETS.map((bucket) => ({ label: bucket.label, count: 0 }));
    for (const days of durations) {
      const index = CYCLE_TIME_BUCKETS.findIndex((bucket) => days < bucket.max);
      buckets[index].count++;
    }

    return {
      weeks,
      openByState,
      openByAssignee,
      otherAssignees,
      cycleTime: {
        buckets,
        medianDays: percentile(durations, 0.5),
        p75Days: percentile(durations, 0.75),
        sample: durations.length,
      },
      truncated,
    };
  },
});

// ---------------------------------------------------------------------------
// Project

const stateCounts = v.object({
  backlog: v.number(),
  unstarted: v.number(),
  started: v.number(),
  completed: v.number(),
  canceled: v.number(),
});

function countStates(issues: Issue[]) {
  const counts = { backlog: 0, unstarted: 0, started: 0, completed: 0, canceled: 0 };
  for (const issue of issues) counts[issue.stateType]++;
  return counts;
}

export const project = query({
  args: { projectId: v.id("projects"), now: v.number() },
  returns: v.object({
    points: v.array(
      v.object({
        t: v.number(),
        scope: v.union(v.number(), v.null()),
        done: v.union(v.number(), v.null()),
        pace: v.union(v.number(), v.null()),
      }),
    ),
    byState: stateCounts,
    estimate: v.object({ done: v.number(), total: v.number() }),
    targetDate: v.union(v.number(), v.null()),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    assertNow(args.now);
    const member = await requireMember(ctx);
    const project = await loadProject(ctx, member, args.projectId);
    const read = await ctx.db
      .query("issues")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .take(MAX_ISSUES);
    const visible = await filterVisibleIssues(ctx, member, read);
    // Canceled issues leave the scope; archived ones are gone from the project.
    const issues = visible.filter((issue) => issue.archivedAt === null);
    const inScope = issues.filter((issue) => issue.stateType !== "canceled");

    const firstIssue = inScope.reduce((min, issue) => Math.min(min, issue._creationTime), args.now);
    const from = project.startDate ?? firstIssue;
    const to = Math.max(args.now, project.targetDate ?? args.now);
    const times = seriesTimes(Math.min(from, args.now), to);
    const today = Math.floor(args.now / DAY) * DAY;
    const scopeNow = inScope.length;
    const target = project.targetDate;

    const points = times.map((t) => {
      const end = t + DAY;
      const past = t <= today;
      const pace =
        target === null || target <= from
          ? null
          : Math.round(Math.min(1, Math.max(0, (end - from) / (target - from))) * scopeNow * 10) / 10;
      if (!past) return { t, scope: null, done: null, pace };
      let scope = 0;
      let done = 0;
      for (const issue of inScope) {
        if (issue._creationTime < end) scope++;
        if (issue.completedAt !== null && issue.completedAt < end) done++;
      }
      return { t, scope, done, pace };
    });

    let estimateDone = 0;
    let estimateTotal = 0;
    for (const issue of inScope) {
      estimateTotal += issue.estimate ?? 0;
      if (issue.stateType === "completed") estimateDone += issue.estimate ?? 0;
    }

    return {
      points,
      byState: countStates(issues),
      estimate: { done: estimateDone, total: estimateTotal },
      targetDate: target,
      truncated: read.length === MAX_ISSUES,
    };
  },
});

/** Issues completed per week over the last 12 weeks, for each project in the list. */
export const projectSparklines = query({
  args: { now: v.number() },
  returns: v.array(v.object({ projectId: v.id("projects"), weeks: v.array(v.number()) })),
  handler: async (ctx, args) => {
    assertNow(args.now);
    const member = await requireMember(ctx);
    const starts = weekStarts(args.now, SPARK_WEEKS);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_orgId", (q) => q.eq("orgId", member.orgId))
      .take(MAX_PROJECTS);
    const rows = [];
    for (const project of projects) {
      const read = await ctx.db
        .query("issues")
        .withIndex("by_projectId_and_completedAt", (q) =>
          q.eq("projectId", project._id).gte("completedAt", starts[0]),
        )
        .take(MAX_SPARK_ISSUES);
      const visible = await filterVisibleIssues(ctx, member, read);
      const weeks = starts.map(() => 0);
      for (const issue of visible) {
        const index = bucketIndex(starts, issue.completedAt!);
        if (index >= 0) weeks[index]++;
      }
      rows.push({ projectId: project._id, weeks });
    }
    return rows;
  },
});

// ---------------------------------------------------------------------------
// Cycle

export const cycle = query({
  args: { cycleId: v.id("cycles"), now: v.number() },
  returns: v.object({
    points: v.array(
      v.object({ t: v.number(), remaining: v.union(v.number(), v.null()), ideal: v.number() }),
    ),
    total: v.number(),
    completed: v.number(),
    estimate: v.object({ done: v.number(), total: v.number() }),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    assertNow(args.now);
    const member = await requireMember(ctx);
    const { cycle } = await loadCycle(ctx, member, args.cycleId);
    const read = await ctx.db
      .query("issues")
      .withIndex("by_cycleId", (q) => q.eq("cycleId", cycle._id))
      .take(MAX_ISSUES);
    const issues = read.filter((issue) => issue.archivedAt === null && issue.stateType !== "canceled");
    const total = issues.length;
    const today = Math.floor(args.now / DAY) * DAY;
    const lastDay = cycle.endsAt - 1;
    const times = seriesTimes(cycle.startsAt, lastDay);
    const span = Math.max(1, cycle.endsAt - cycle.startsAt);

    const points = times.map((t) => {
      const end = Math.min(t + DAY, cycle.endsAt);
      const ideal = Math.round(total * Math.max(0, 1 - (end - cycle.startsAt) / span) * 10) / 10;
      if (t > today) return { t, remaining: null, ideal };
      let remaining = 0;
      for (const issue of issues) {
        // Issues created before the cycle count from its first day.
        const added = Math.max(issue._creationTime, cycle.startsAt);
        const doneBefore = issue.completedAt !== null && issue.completedAt < end;
        if (added < end && !doneBefore) remaining++;
      }
      return { t, remaining, ideal };
    });

    let estimateDone = 0;
    let estimateTotal = 0;
    let completed = 0;
    for (const issue of issues) {
      estimateTotal += issue.estimate ?? 0;
      if (issue.stateType === "completed") {
        completed++;
        estimateDone += issue.estimate ?? 0;
      }
    }

    return {
      points,
      total,
      completed,
      estimate: { done: estimateDone, total: estimateTotal },
      truncated: read.length === MAX_ISSUES,
    };
  },
});

// ---------------------------------------------------------------------------
// Mine

/** Issues assigned to the caller and completed per week, last 8 weeks. */
export const mine = query({
  args: { now: v.number() },
  returns: v.object({ weeks: v.array(v.object({ start: v.number(), completed: v.number() })), truncated: v.boolean() }),
  handler: async (ctx, args) => {
    assertNow(args.now);
    const member = await requireMember(ctx);
    const starts = weekStarts(args.now, MY_WEEKS);
    const read = await ctx.db
      .query("issues")
      .withIndex("by_orgId_and_assigneeId_and_completedAt", (q) =>
        q.eq("orgId", member.orgId).eq("assigneeId", member.userId).gte("completedAt", starts[0]),
      )
      .take(MAX_ISSUES);
    const visible = await filterVisibleIssues(ctx, member, read);
    const weeks = starts.map((start) => ({ start, completed: 0 }));
    for (const issue of visible) {
      const index = bucketIndex(starts, issue.completedAt!);
      if (index >= 0) weeks[index].completed++;
    }
    return { weeks, truncated: read.length === MAX_ISSUES };
  },
});
