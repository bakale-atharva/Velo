import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { MemberInfo } from "./lib/auth";
import { appError } from "./lib/errors";
import { createIssue } from "./lib/issueOps";
import { DEFAULT_STATES } from "./teams";

// Development seed: fills an org with teams, labels, projects, cycles and
// issues so every screen has something to show. Internal only; run it with
//   npx convex run seed:org '{"orgId":"org_..."}'
// The org must already be synced from Clerk (at least one membership).

const DAY = 86_400_000;

const TEAMS = [
  { name: "Web", key: "WEB" },
  { name: "Mobile", key: "MOB" },
  { name: "Platform", key: "PLAT" },
] as const;

const LABELS = [
  { name: "Bug", color: "#e8432a" },
  { name: "Feature", color: "#2433d6" },
  { name: "Improvement", color: "#4c9f70" },
  { name: "Design", color: "#b04ad6" },
  { name: "Docs", color: "#8b8f98" },
  { name: "Performance", color: "#e0a526" },
] as const;

type LabelName = (typeof LABELS)[number]["name"];
type StateName = (typeof DEFAULT_STATES)[number]["name"];
type TeamKey = (typeof TEAMS)[number]["key"];

type SeedIssue = {
  title: string;
  description?: string;
  state: StateName;
  priority: number;
  labels: LabelName[];
  estimate?: number;
  dueInDays?: number;
  project?: string;
  inCycle?: boolean;
  children?: SeedIssue[];
};

const PROJECTS = [
  {
    name: "Public launch",
    description: "Everything that has to ship before the public launch.",
    status: "started",
    startInDays: -14,
    targetInDays: 30,
  },
  {
    name: "Offline mode",
    description: "Read and edit issues on mobile without a connection.",
    status: "planned",
    startInDays: 14,
    targetInDays: 75,
  },
  {
    name: "Search v2",
    description: "Faster, typo-tolerant search across issues and comments.",
    status: "started",
    startInDays: -7,
    targetInDays: 45,
  },
] as const;

const ISSUES: Record<TeamKey, SeedIssue[]> = {
  WEB: [
    {
      title: "Board drag and drop drops the card in the wrong column",
      description:
        "Dragging a card quickly across two columns sometimes lands it one column short.\n\n**Steps**\n1. Open the board\n2. Drag a card from Todo to Done fast\n\nExpected: Done. Actual: In Progress.",
      state: "In Progress",
      priority: 1,
      labels: ["Bug"],
      estimate: 3,
      dueInDays: 2,
      project: "Public launch",
      inCycle: true,
    },
    {
      title: "Keyboard shortcuts cheat sheet",
      description: "Show every shortcut on `?`, grouped by page.",
      state: "Todo",
      priority: 3,
      labels: ["Feature"],
      estimate: 2,
      project: "Public launch",
      inCycle: true,
    },
    {
      title: "Landing page hero copy",
      state: "Done",
      priority: 2,
      labels: ["Design", "Docs"],
      estimate: 1,
      project: "Public launch",
      inCycle: true,
    },
    {
      title: "Issue detail: inline title editing",
      state: "In Progress",
      priority: 2,
      labels: ["Improvement"],
      estimate: 2,
      inCycle: true,
      children: [
        { title: "Save title on blur", state: "Done", priority: 3, labels: [] },
        { title: "Escape restores the old title", state: "Todo", priority: 3, labels: [] },
      ],
    },
    {
      title: "Dark mode contrast on muted text",
      state: "Todo",
      priority: 3,
      labels: ["Design", "Bug"],
      estimate: 1,
    },
    {
      title: "Paginate the activity feed",
      state: "Backlog",
      priority: 4,
      labels: ["Performance"],
      estimate: 3,
    },
    {
      title: "Empty states for every list",
      state: "Backlog",
      priority: 0,
      labels: ["Design"],
    },
    {
      title: "Remove the old settings page",
      state: "Canceled",
      priority: 4,
      labels: [],
    },
  ],
  MOB: [
    {
      title: "App crashes when opening a deleted issue from a notification",
      description: "Crash in `IssueScreen` when the issue no longer exists. Show not-found instead.",
      state: "Todo",
      priority: 1,
      labels: ["Bug"],
      estimate: 2,
      dueInDays: 1,
      inCycle: true,
    },
    {
      title: "Local cache for the issue list",
      state: "In Progress",
      priority: 2,
      labels: ["Feature", "Performance"],
      estimate: 5,
      project: "Offline mode",
      inCycle: true,
    },
    {
      title: "Queue edits made while offline",
      state: "Backlog",
      priority: 2,
      labels: ["Feature"],
      estimate: 8,
      project: "Offline mode",
    },
    {
      title: "Conflict banner when an offline edit loses",
      state: "Backlog",
      priority: 3,
      labels: ["Design"],
      estimate: 3,
      project: "Offline mode",
    },
    {
      title: "Pull to refresh on My issues",
      state: "Done",
      priority: 3,
      labels: ["Improvement"],
      estimate: 1,
      inCycle: true,
    },
    {
      title: "Haptics on swipe to complete",
      state: "Backlog",
      priority: 0,
      labels: ["Improvement"],
    },
  ],
  PLAT: [
    {
      title: "Search ignores issues with typos in the title",
      state: "In Progress",
      priority: 2,
      labels: ["Bug"],
      estimate: 3,
      project: "Search v2",
      inCycle: true,
    },
    {
      title: "Index comment bodies for search",
      state: "Todo",
      priority: 2,
      labels: ["Feature"],
      estimate: 5,
      project: "Search v2",
      inCycle: true,
    },
    {
      title: "Rate limit the public API",
      description: "100 requests per minute per token, with `Retry-After` on 429.",
      state: "Todo",
      priority: 1,
      labels: ["Feature"],
      estimate: 3,
      dueInDays: 5,
      project: "Public launch",
      inCycle: true,
    },
    {
      title: "Cycle rollover runs twice after a deploy",
      state: "Done",
      priority: 1,
      labels: ["Bug"],
      estimate: 2,
      inCycle: true,
    },
    {
      title: "Document the webhook events",
      state: "Backlog",
      priority: 3,
      labels: ["Docs"],
      estimate: 2,
    },
    {
      title: "Slow board query on teams with 5k issues",
      state: "Backlog",
      priority: 2,
      labels: ["Performance"],
      estimate: 5,
      project: "Search v2",
    },
  ],
};

const MAX_CLEAR = 200;

/**
 * Removes what `seed:org` created: its teams (through the scheduled team
 * deletion, so their issues, cycles and states go too), and its projects and
 * labels by name. Anything else in the org is left alone. Run with
 *   npx convex run seed:clear '{"orgId":"org_..."}'
 */
export const clear = internalMutation({
  args: { orgId: v.string() },
  returns: v.object({ teams: v.number(), projects: v.number(), labels: v.number() }),
  handler: async (ctx, { orgId }) => {
    const now = Date.now();
    let teams = 0;
    for (const { key } of TEAMS) {
      const team = await ctx.db
        .query("teams")
        .withIndex("by_orgId_and_key", (q) => q.eq("orgId", orgId).eq("key", key))
        .unique();
      if (team === null || team.deletingAt != null) continue;
      await ctx.db.patch("teams", team._id, { archivedAt: team.archivedAt ?? now, deletingAt: now });
      await ctx.scheduler.runAfter(0, internal.teams.deleteStep, { teamId: team._id });
      teams += 1;
    }
    const seededProjects = new Set<string>(PROJECTS.map((project) => project.name));
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .take(MAX_CLEAR);
    let removedProjects = 0;
    for (const project of projects) {
      if (seededProjects.has(project.name)) {
        await ctx.db.delete("projects", project._id);
        removedProjects += 1;
      }
    }
    let labels = 0;
    for (const { name } of LABELS) {
      const label = await ctx.db
        .query("labels")
        .withIndex("by_orgId_and_name", (q) => q.eq("orgId", orgId).eq("name", name))
        .unique();
      if (label !== null) {
        await ctx.db.delete("labels", label._id);
        labels += 1;
      }
    }
    return { teams, projects: removedProjects, labels };
  },
});

export const org = internalMutation({
  args: { orgId: v.string() },
  returns: v.object({
    teams: v.number(),
    labels: v.number(),
    projects: v.number(),
    cycles: v.number(),
    issues: v.number(),
  }),
  handler: async (ctx, { orgId }) => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_orgId_and_userId", (q) => q.eq("orgId", orgId))
      .take(50);
    if (memberships.length === 0) {
      // The org has not been synced from Clerk yet.
      throw appError("NOT_FOUND");
    }
    const actorRow = memberships.find((m) => m.role === "admin") ?? memberships[0];
    const actor: MemberInfo = { orgId, userId: actorRow.userId, role: actorRow.role };
    const userIds = memberships.map((m) => m.userId);
    const now = Date.now();

    for (const { key } of TEAMS) {
      const taken = await ctx.db
        .query("teams")
        .withIndex("by_orgId_and_key", (q) => q.eq("orgId", orgId).eq("key", key))
        .unique();
      if (taken !== null) {
        // Seeding twice would duplicate everything.
        throw appError("INVALID_INPUT");
      }
    }

    const labelIds = new Map<LabelName, Id<"labels">>();
    for (const label of LABELS) {
      const existing = await ctx.db
        .query("labels")
        .withIndex("by_orgId_and_name", (q) => q.eq("orgId", orgId).eq("name", label.name))
        .unique();
      labelIds.set(
        label.name,
        existing?._id ?? (await ctx.db.insert("labels", { orgId, ...label })),
      );
    }

    const projectIds = new Map<string, Id<"projects">>();
    for (const project of PROJECTS) {
      projectIds.set(
        project.name,
        await ctx.db.insert("projects", {
          orgId,
          name: project.name,
          description: project.description,
          status: project.status,
          leadId: userIds[projectIds.size % userIds.length],
          teamIds: [],
          startDate: now + project.startInDays * DAY,
          targetDate: now + project.targetInDays * DAY,
          issueCount: 0,
          completedIssueCount: 0,
        }),
      );
    }

    let cycles = 0;
    let issues = 0;
    for (const [teamIndex, spec] of TEAMS.entries()) {
      const team = await insertTeam(ctx, orgId, spec, userIds);
      const states = await ctx.db
        .query("workflowStates")
        .withIndex("by_teamId_and_position", (q) => q.eq("teamId", team._id))
        .take(10);
      const stateId = (name: StateName) => states.find((s) => s.name === name)!._id;

      // A finished cycle, the current one and the next one.
      const cycleIds: Id<"cycles">[] = [];
      for (const [offset, status] of [
        [-2, "completed"],
        [-1, "active"],
        [1, "upcoming"],
      ] as const) {
        const startsAt = now + offset * 14 * DAY + (offset > 0 ? -7 * DAY : 7 * DAY);
        cycleIds.push(
          await ctx.db.insert("cycles", {
            orgId,
            teamId: team._id,
            number: cycleIds.length + 1,
            name: `Cycle ${cycleIds.length + 1}`,
            startsAt,
            endsAt: startsAt + 14 * DAY,
            status,
          }),
        );
        cycles += 1;
      }
      const activeCycle = cycleIds[1];

      const create = async (
        current: Doc<"teams">,
        issue: SeedIssue,
        index: number,
        parentId: Id<"issues"> | null,
      ) => {
        const created = await createIssue(ctx, actor, current, {
          title: issue.title,
          description: issue.description,
          stateId: stateId(issue.state),
          priority: issue.priority,
          assigneeId: index % 4 === 3 ? null : userIds[(index + teamIndex) % userIds.length],
          labelIds: issue.labels.map((name) => labelIds.get(name)!),
          estimate: issue.estimate ?? null,
          dueDate: issue.dueInDays === undefined ? null : now + issue.dueInDays * DAY,
          parentId,
          projectId: issue.project === undefined ? null : projectIds.get(issue.project)!,
          cycleId: issue.inCycle === true ? activeCycle : null,
        });
        issues += 1;
        return created;
      };

      let current = team;
      for (const [index, issue] of ISSUES[spec.key].entries()) {
        // createIssue bumps the team's counter; reload to keep numbers right.
        current = (await ctx.db.get("teams", team._id))!;
        const parent = await create(current, issue, index, null);
        for (const [childIndex, child] of (issue.children ?? []).entries()) {
          current = (await ctx.db.get("teams", team._id))!;
          await create(current, child, index + childIndex + 1, parent._id);
        }
      }
    }

    return {
      teams: TEAMS.length,
      labels: LABELS.length,
      projects: PROJECTS.length,
      cycles,
      issues,
    };
  },
});

async function insertTeam(
  ctx: MutationCtx,
  orgId: string,
  spec: (typeof TEAMS)[number],
  userIds: string[],
): Promise<Doc<"teams">> {
  const teamId = await ctx.db.insert("teams", {
    orgId,
    name: spec.name,
    key: spec.key,
    isPrivate: false,
    nextIssueNumber: 1,
    archivedAt: null,
  });
  for (const [position, state] of DEFAULT_STATES.entries()) {
    await ctx.db.insert("workflowStates", { orgId, teamId, position, ...state });
  }
  for (const userId of userIds) {
    await ctx.db.insert("teamMembers", { orgId, teamId, userId });
  }
  return (await ctx.db.get("teams", teamId))!;
}
