import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalQuery, type QueryCtx } from "../_generated/server";
import type { MemberInfo } from "../lib/auth";
import { canAccessTeam, filterVisibleIssues } from "../lib/teamAccess";

// What the assistant may read. Every query takes the caller's orgId and
// userId as captured by the authenticated action (guard.begin), never from
// model output, and applies the same private-team rule as the app.

const MAX_RESULTS = 25;
const MAX_LIST = 100;
const MAX_DESCRIPTION = 2000;
const PRIORITY = ["No priority", "Urgent", "High", "Medium", "Low"];

export const vCaller = { orgId: v.string(), userId: v.string(), role: v.string() };

const vIssueSummary = v.object({
  identifier: v.string(),
  title: v.string(),
  team: v.string(),
  state: v.string(),
  stateType: v.string(),
  priority: v.string(),
  assignee: v.union(v.string(), v.null()),
  labels: v.array(v.string()),
  project: v.union(v.string(), v.null()),
  dueDate: v.union(v.string(), v.null()),
});

async function displayName(ctx: QueryCtx, userId: string | null): Promise<string | null> {
  if (userId === null) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", userId))
    .unique();
  return user?.name ?? user?.email ?? "Unknown member";
}

/** Issues as plain facts for the model, names resolved, ids left out. */
async function summarize(ctx: QueryCtx, issues: Doc<"issues">[]) {
  const cache = new Map<string, Promise<string | null>>();
  const named = <T,>(key: string, load: () => Promise<T>) => {
    if (!cache.has(key)) cache.set(key, load() as Promise<string | null>);
    return cache.get(key)! as Promise<T>;
  };
  return await Promise.all(
    issues.map(async (issue) => {
      const [team, state, assignee, project, labels] = await Promise.all([
        named(issue.teamId, async () => (await ctx.db.get("teams", issue.teamId))?.key ?? "?"),
        named(issue.stateId, async () => (await ctx.db.get("workflowStates", issue.stateId))?.name ?? "?"),
        named(`u:${issue.assigneeId}`, () => displayName(ctx, issue.assigneeId)),
        issue.projectId
          ? named(issue.projectId, async () => (await ctx.db.get("projects", issue.projectId!))?.name ?? null)
          : Promise.resolve(null),
        Promise.all(
          issue.labelIds.map((id) => named(id, async () => (await ctx.db.get("labels", id))?.name ?? null)),
        ),
      ]);
      return {
        identifier: issue.identifier,
        title: issue.title,
        team: team ?? "?",
        state: state ?? "?",
        stateType: issue.stateType,
        priority: PRIORITY[issue.priority] ?? "No priority",
        assignee,
        labels: labels.filter((l): l is string => l !== null),
        project,
        dueDate: issue.dueDate === null ? null : new Date(issue.dueDate).toISOString().slice(0, 10),
      };
    }),
  );
}

export const searchIssues = internalQuery({
  args: { ...vCaller, query: v.string() },
  returns: v.array(vIssueSummary),
  handler: async (ctx, args) => {
    const text = args.query.trim().slice(0, 200);
    if (text === "") return [];
    const hits = await ctx.db
      .query("issues")
      .withSearchIndex("search_text", (q) => q.search("searchText", text).eq("orgId", args.orgId))
      .take(MAX_RESULTS);
    const visible = await filterVisibleIssues(
      ctx,
      args,
      hits.filter((issue) => issue.archivedAt === null),
    );
    return await summarize(ctx, visible);
  },
});

/** One issue the caller may see, with its description and sub-issues; null if none. */
export const getIssue = internalQuery({
  args: { ...vCaller, identifier: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      issue: vIssueSummary,
      description: v.string(),
      estimate: v.union(v.number(), v.null()),
      cycle: v.union(v.string(), v.null()),
      subIssues: v.array(vIssueSummary),
    }),
  ),
  handler: async (ctx, args) => {
    const issue = await ctx.db
      .query("issues")
      .withIndex("by_orgId_and_identifier", (q) =>
        q.eq("orgId", args.orgId).eq("identifier", args.identifier.trim().toUpperCase()),
      )
      .unique();
    if (issue === null) return null;
    const [visible] = await filterVisibleIssues(ctx, args, [issue]);
    if (visible === undefined) return null;
    const children = await ctx.db
      .query("issues")
      .withIndex("by_parentId", (q) => q.eq("parentId", issue._id))
      .take(MAX_RESULTS);
    const cycle = issue.cycleId ? await ctx.db.get("cycles", issue.cycleId) : null;
    const [summary] = await summarize(ctx, [issue]);
    return {
      issue: summary!,
      description: issue.description.slice(0, MAX_DESCRIPTION),
      estimate: issue.estimate,
      cycle: cycle?.name ?? null,
      subIssues: await summarize(ctx, children.filter((c) => c.archivedAt === null)),
    };
  },
});

async function visibleTeams(ctx: QueryCtx, member: MemberInfo) {
  const teams = await ctx.db
    .query("teams")
    .withIndex("by_orgId", (q) => q.eq("orgId", member.orgId))
    .take(MAX_LIST);
  const result: Doc<"teams">[] = [];
  for (const team of teams) {
    if (team.archivedAt === null && (await canAccessTeam(ctx, member, team))) result.push(team);
  }
  return result;
}

export const listTeams = internalQuery({
  args: vCaller,
  returns: v.array(v.object({ key: v.string(), name: v.string(), isPrivate: v.boolean() })),
  handler: async (ctx, args) =>
    (await visibleTeams(ctx, args)).map((t) => ({ key: t.key, name: t.name, isPrivate: t.isPrivate })),
});

export const listMembers = internalQuery({
  args: vCaller,
  returns: v.array(v.object({ userId: v.string(), name: v.string(), role: v.string() })),
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_orgId_and_userId", (q) => q.eq("orgId", args.orgId))
      .take(MAX_LIST);
    return await Promise.all(
      memberships.map(async (m) => ({
        userId: m.userId,
        name: (await displayName(ctx, m.userId)) ?? "Unknown member",
        role: m.role,
      })),
    );
  },
});

export const listProjects = internalQuery({
  args: vCaller,
  returns: v.array(
    v.object({
      name: v.string(),
      status: v.string(),
      progress: v.string(),
      targetDate: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .take(MAX_LIST);
    return projects.map((p) => ({
      name: p.name,
      status: p.status,
      progress: `${p.completedIssueCount}/${p.issueCount} issues done`,
      targetDate: p.targetDate === null ? null : new Date(p.targetDate).toISOString().slice(0, 10),
    }));
  },
});

export const listCycles = internalQuery({
  args: { ...vCaller, teamKey: v.string() },
  returns: v.array(
    v.object({ number: v.number(), name: v.string(), status: v.string(), starts: v.string(), ends: v.string() }),
  ),
  handler: async (ctx, args) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_orgId_and_key", (q) =>
        q.eq("orgId", args.orgId).eq("key", args.teamKey.trim().toUpperCase()),
      )
      .unique();
    if (team === null || !(await canAccessTeam(ctx, args, team))) return [];
    const cycles = await ctx.db
      .query("cycles")
      .withIndex("by_teamId_and_startsAt", (q) => q.eq("teamId", team._id))
      .order("desc")
      .take(20);
    const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    return cycles.map((c) => ({
      number: c.number,
      name: c.name,
      status: c.status,
      starts: day(c.startsAt),
      ends: day(c.endsAt - 1),
    }));
  },
});

export const listLabels = internalQuery({
  args: vCaller,
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const labels = await ctx.db
      .query("labels")
      .withIndex("by_orgId_and_name", (q) => q.eq("orgId", args.orgId))
      .take(MAX_LIST);
    return labels.map((l) => l.name);
  },
});
