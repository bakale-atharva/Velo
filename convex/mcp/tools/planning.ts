import { z } from "zod";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { defineTool, DESTRUCTIVE, READ, WRITE, type Tool } from "../registry";
import { filterFields, pageFields, pageOpts, toIssueFilter } from "./issues";
import { presentIssues } from "./present";
import { formatDate, parseDate, resolveCycle, resolveOptionalUserId, resolveProjectId, resolveTeamId } from "./resolve";

// Projects, cycles and saved views.

const projectRef = z.string().describe("Project name or id");
const teamRef = z.string().describe("Team key (e.g. ENG) or id");
const cycleRef = z.string().describe("Cycle number, name or id");
const projectStatus = z.enum(["planned", "started", "paused", "completed", "canceled"]);
const date = z.string().nullable().optional().describe("YYYY-MM-DD; null clears it");

const projectFields = {
  description: z.string().optional().describe("Markdown"),
  status: projectStatus.optional(),
  lead: z.string().nullable().optional().describe("Lead (person or agent); null clears it"),
  startDate: date,
  targetDate: date,
};

type ProjectFieldInput = {
  description?: string;
  status?: "planned" | "started" | "paused" | "completed" | "canceled";
  lead?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
};

async function toProjectArgs(client: Parameters<Tool["run"]>[0], input: ProjectFieldInput) {
  return {
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.lead === undefined ? {} : { leadId: await resolveOptionalUserId(client, input.lead) }),
    ...(input.startDate === undefined ? {} : { startDate: parseDate(input.startDate) }),
    ...(input.targetDate === undefined ? {} : { targetDate: parseDate(input.targetDate) }),
  };
}

function presentProject<P extends { startDate: number | null; targetDate: number | null; issueCount: number; completedIssueCount: number }>(p: P) {
  return {
    ...p,
    startDate: formatDate(p.startDate),
    targetDate: formatDate(p.targetDate),
    progress: p.issueCount === 0 ? 0 : Math.round((p.completedIssueCount / p.issueCount) * 100),
  };
}

function presentCycle<C extends { startsAt: number; endsAt: number }>(c: C) {
  return { ...c, starts: formatDate(c.startsAt), ends: formatDate(c.endsAt) };
}

const viewLayout = z.enum(["list", "board"]);
const viewGroupBy = z.enum(["state", "assignee", "priority", "project", "none"]);

export const planningTools: Tool[] = [
  // --- Projects ---
  defineTool({
    name: "list_projects",
    title: "List projects",
    description: "The workspace's projects with status, lead, dates and progress.",
    input: z.object({}),
    annotations: READ,
    run: async (client) => ({ projects: (await client.query(api.projects.list, {})).map(presentProject) }),
  }),
  defineTool({
    name: "get_project",
    title: "Get project",
    description: "One project with status, lead, dates and progress.",
    input: z.object({ project: projectRef }),
    annotations: READ,
    run: async (client, { project }) =>
      presentProject(await client.query(api.projects.get, { projectId: await resolveProjectId(client, project) })),
  }),
  defineTool({
    name: "create_project",
    title: "Create project",
    description: "Creates a project. Needs projects.manage (members have it by default).",
    input: z.object({ name: z.string(), ...projectFields }),
    annotations: WRITE,
    run: async (client, { name, ...fields }) => {
      const projectId = await client.mutation(api.projects.create, { name, ...(await toProjectArgs(client, fields)) });
      return presentProject(await client.query(api.projects.get, { projectId }));
    },
  }),
  defineTool({
    name: "update_project",
    title: "Update project",
    description: "Changes a project's name, description, status, lead or dates. Needs projects.manage.",
    input: z.object({ project: projectRef, name: z.string().optional(), ...projectFields }),
    annotations: WRITE,
    run: async (client, { project, name, ...fields }) => {
      const projectId = await resolveProjectId(client, project);
      await client.mutation(api.projects.update, {
        projectId,
        ...(name === undefined ? {} : { name }),
        ...(await toProjectArgs(client, fields)),
      });
      return presentProject(await client.query(api.projects.get, { projectId }));
    },
  }),
  defineTool({
    name: "delete_project",
    title: "Delete project",
    description: "Deletes a project; its issues stay and lose the project. Needs projects.manage.",
    input: z.object({ project: projectRef }),
    annotations: DESTRUCTIVE,
    run: async (client, { project }) => {
      await client.mutation(api.projects.remove, { projectId: await resolveProjectId(client, project) });
      return { deleted: true };
    },
  }),
  defineTool({
    name: "project_issues",
    title: "Project issues",
    description: "Issues in a project, paginated.",
    input: z.object({ project: projectRef, ...pageFields }),
    annotations: READ,
    run: async (client, { project, ...rest }) => {
      const result = await client.query(api.projects.listIssues, {
        projectId: await resolveProjectId(client, project),
        paginationOpts: pageOpts(rest),
      });
      return { issues: await presentIssues(client, result.page), nextCursor: result.isDone ? null : result.continueCursor };
    },
  }),

  // --- Cycles ---
  defineTool({
    name: "list_cycles",
    title: "List cycles",
    description: "A team's cycles (upcoming, active, completed) with dates.",
    input: z.object({ team: teamRef }),
    annotations: READ,
    run: async (client, { team }) => ({
      cycles: (await client.query(api.cycles.list, { teamId: await resolveTeamId(client, team) })).map(presentCycle),
    }),
  }),
  defineTool({
    name: "get_cycle",
    title: "Get cycle",
    description: "One cycle of a team.",
    input: z.object({ team: teamRef, cycle: cycleRef }),
    annotations: READ,
    run: async (client, { team, cycle }) =>
      presentCycle(await resolveCycle(client, await resolveTeamId(client, team), cycle)),
  }),
  defineTool({
    name: "create_cycle",
    title: "Create cycle",
    description: "Creates a cycle for a team; cycles of a team can't overlap. Needs cycles.manage (members have it by default).",
    input: z.object({
      team: teamRef,
      name: z.string().optional(),
      starts: z.string().describe("Start date, YYYY-MM-DD (inclusive)"),
      ends: z.string().describe("End date, YYYY-MM-DD (exclusive)"),
    }),
    annotations: WRITE,
    run: async (client, { team, name, starts, ends }) => {
      const teamId = await resolveTeamId(client, team);
      const cycleId = await client.mutation(api.cycles.create, {
        teamId,
        ...(name === undefined ? {} : { name }),
        startsAt: parseDate(starts)!,
        endsAt: parseDate(ends)!,
      });
      return presentCycle(await resolveCycle(client, teamId, cycleId));
    },
  }),
  defineTool({
    name: "update_cycle",
    title: "Update cycle",
    description: "Renames a cycle or changes its dates. Needs cycles.manage.",
    input: z.object({
      team: teamRef,
      cycle: cycleRef,
      name: z.string().optional(),
      starts: z.string().optional().describe("YYYY-MM-DD"),
      ends: z.string().optional().describe("YYYY-MM-DD"),
    }),
    annotations: WRITE,
    run: async (client, { team, cycle, name, starts, ends }) => {
      const teamId = await resolveTeamId(client, team);
      const found = await resolveCycle(client, teamId, cycle);
      await client.mutation(api.cycles.update, {
        cycleId: found._id,
        ...(name === undefined ? {} : { name }),
        ...(starts === undefined ? {} : { startsAt: parseDate(starts)! }),
        ...(ends === undefined ? {} : { endsAt: parseDate(ends)! }),
      });
      return presentCycle(await resolveCycle(client, teamId, found._id));
    },
  }),
  defineTool({
    name: "cycle_issues",
    title: "Cycle issues",
    description: "Issues in a cycle, paginated.",
    input: z.object({ team: teamRef, cycle: cycleRef, ...pageFields }),
    annotations: READ,
    run: async (client, { team, cycle, ...rest }) => {
      const found = await resolveCycle(client, await resolveTeamId(client, team), cycle);
      const result = await client.query(api.cycles.listIssues, { cycleId: found._id, paginationOpts: pageOpts(rest) });
      return { issues: await presentIssues(client, result.page), nextCursor: result.isDone ? null : result.continueCursor };
    },
  }),

  // --- Saved views ---
  defineTool({
    name: "list_views",
    title: "List saved views",
    description: "Your saved views and those shared with the workspace.",
    input: z.object({}),
    annotations: READ,
    run: async (client) => ({ views: await client.query(api.savedViews.list, {}) }),
  }),
  defineTool({
    name: "get_view",
    title: "Get saved view",
    description: "One saved view and the first page of its issues.",
    input: z.object({ viewId: z.string(), ...pageFields }),
    annotations: READ,
    run: async (client, { viewId, ...rest }) => {
      const view = await client.query(api.savedViews.get, { viewId: viewId as Id<"savedViews"> });
      const result = await client.query(api.issues.listFiltered, { filter: view.filter, paginationOpts: pageOpts(rest) });
      return {
        view,
        issues: await presentIssues(client, result.page),
        nextCursor: result.isDone ? null : result.continueCursor,
      };
    },
  }),
  defineTool({
    name: "create_view",
    title: "Create saved view",
    description: "Saves an issue filter as a view. Sharing it with the workspace needs views.share.",
    input: z.object({
      name: z.string(),
      filter: z.object(filterFields),
      isShared: z.boolean().optional(),
      layout: viewLayout.optional(),
      groupBy: viewGroupBy.optional(),
    }),
    annotations: WRITE,
    run: async (client, { filter, ...rest }) => ({
      viewId: await client.mutation(api.savedViews.create, { ...rest, filter: await toIssueFilter(client, filter) }),
    }),
  }),
  defineTool({
    name: "update_view",
    title: "Update saved view",
    description: "Changes a saved view you own: name, filter, sharing, layout or grouping.",
    input: z.object({
      viewId: z.string(),
      name: z.string().optional(),
      filter: z.object(filterFields).optional(),
      isShared: z.boolean().optional(),
      layout: viewLayout.optional(),
      groupBy: viewGroupBy.optional(),
    }),
    annotations: WRITE,
    run: async (client, { viewId, filter, ...rest }) => {
      await client.mutation(api.savedViews.update, {
        viewId: viewId as Id<"savedViews">,
        ...rest,
        ...(filter === undefined ? {} : { filter: await toIssueFilter(client, filter) }),
      });
      return { updated: true };
    },
  }),
  defineTool({
    name: "delete_view",
    title: "Delete saved view",
    description: "Deletes a saved view you own.",
    input: z.object({ viewId: z.string() }),
    annotations: DESTRUCTIVE,
    run: async (client, { viewId }) => {
      await client.mutation(api.savedViews.remove, { viewId: viewId as Id<"savedViews"> });
      return { deleted: true };
    },
  }),
];
