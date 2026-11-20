import { z } from "zod";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { AgentClient } from "../client";
import { defineTool, DESTRUCTIVE, READ, ToolError, WRITE, type Tool } from "../registry";
import { presentIssues } from "./present";
import {
  parseDate,
  resolveCycle,
  resolveIssue,
  resolveLabelIds,
  resolveOptionalUserId,
  resolveProjectId,
  resolveStateId,
  resolveTeamId,
  resolveUserId,
} from "./resolve";

// Issues, their comments and activity. Issues are named by identifier
// (ENG-12); every field takes names (state, labels, assignee, project).

const issueRef = z.string().describe("Issue identifier, e.g. ENG-12");
const teamRef = z.string().describe("Team key (e.g. ENG) or id");
const page = {
  cursor: z.string().optional().describe("nextCursor from the previous page"),
  limit: z.number().int().min(1).max(50).optional().describe("Page size (default 25, max 50)"),
};

const issueFields = {
  description: z.string().optional().describe("Markdown"),
  state: z.string().optional().describe("Workflow state name or id (e.g. In Progress)"),
  priority: z.number().int().min(0).max(4).optional().describe("0 none, 1 urgent, 2 high, 3 medium, 4 low"),
  assignee: z.string().nullable().optional().describe("Person or agent (user id, email or name); null unassigns"),
  labels: z.array(z.string()).optional().describe("Label names or ids (replaces the issue's labels)"),
  estimate: z.number().min(0).nullable().optional(),
  dueDate: z.string().nullable().optional().describe("YYYY-MM-DD; null clears it"),
  parent: z.string().nullable().optional().describe("Parent issue identifier; null clears it"),
  project: z.string().nullable().optional().describe("Project name or id; null clears it"),
  cycle: z.string().nullable().optional().describe("Cycle number, name or id of the issue's team; null clears it"),
};

type IssueFieldInput = {
  description?: string;
  state?: string;
  priority?: number;
  assignee?: string | null;
  labels?: string[];
  estimate?: number | null;
  dueDate?: string | null;
  parent?: string | null;
  project?: string | null;
  cycle?: string | null;
};

/** Turns readable field values into the ids issues.create/update take. */
async function toIssueArgs(client: AgentClient, teamId: Id<"teams">, input: IssueFieldInput) {
  const args: {
    description?: string;
    stateId?: Id<"workflowStates">;
    priority?: number;
    assigneeId?: string | null;
    labelIds?: Id<"labels">[];
    estimate?: number | null;
    dueDate?: number | null;
    parentId?: Id<"issues"> | null;
    projectId?: Id<"projects"> | null;
    cycleId?: Id<"cycles"> | null;
  } = {};
  if (input.description !== undefined) args.description = input.description;
  if (input.state !== undefined) args.stateId = await resolveStateId(client, teamId, input.state);
  if (input.priority !== undefined) args.priority = input.priority;
  if (input.assignee !== undefined) args.assigneeId = await resolveOptionalUserId(client, input.assignee);
  if (input.labels !== undefined) args.labelIds = await resolveLabelIds(client, input.labels);
  if (input.estimate !== undefined) args.estimate = input.estimate;
  if (input.dueDate !== undefined) args.dueDate = parseDate(input.dueDate);
  if (input.parent !== undefined) {
    args.parentId = input.parent === null ? null : (await resolveIssue(client, input.parent))._id;
  }
  if (input.project !== undefined) {
    args.projectId = input.project === null ? null : await resolveProjectId(client, input.project);
  }
  if (input.cycle !== undefined) {
    args.cycleId = input.cycle === null ? null : (await resolveCycle(client, teamId, input.cycle))._id;
  }
  return args;
}

const pageOpts = (input: { cursor?: string; limit?: number }) => ({
  numItems: input.limit ?? 25,
  cursor: input.cursor ?? null,
});

async function oneIssue(client: AgentClient, identifier: string) {
  const [issue] = await presentIssues(client, [await resolveIssue(client, identifier)]);
  return issue;
}

export const issueTools: Tool[] = [
  defineTool({
    name: "create_issue",
    title: "Create issue",
    description:
      "Creates an issue in a team. Assign it to a person or agent (e.g. one of your subagents) with assignee.",
    input: z.object({ team: teamRef, title: z.string(), ...issueFields }),
    annotations: WRITE,
    run: async (client, { team, title, ...fields }) => {
      const teamId = await resolveTeamId(client, team);
      const { identifier } = await client.mutation(api.issues.create, {
        teamId,
        title,
        ...(await toIssueArgs(client, teamId, fields)),
      });
      return await oneIssue(client, identifier);
    },
  }),
  defineTool({
    name: "get_issue",
    title: "Get issue",
    description: "One issue with every field, its sub-issues and its latest comments.",
    input: z.object({ issue: issueRef }),
    annotations: READ,
    run: async (client, { issue }) => {
      const doc = await resolveIssue(client, issue);
      const [presented, subIssues, comments] = await Promise.all([
        presentIssues(client, [doc]),
        client.query(api.issues.listSubIssues, { issueId: doc._id }),
        client.query(api.comments.list, { issueId: doc._id, paginationOpts: { numItems: 20, cursor: null } }),
      ]);
      return {
        ...presented[0],
        subIssues: subIssues.map((s) => ({ identifier: s.identifier, title: s.title, stateType: s.stateType })),
        comments: comments.page,
      };
    },
  }),
  defineTool({
    name: "update_issue",
    title: "Update issue",
    description:
      "Changes an issue's title, description, state, priority, assignee, labels, estimate, due date, parent, project or cycle. Fields left out stay as they are.",
    input: z.object({ issue: issueRef, title: z.string().optional(), ...issueFields }),
    annotations: WRITE,
    run: async (client, { issue, title, ...fields }) => {
      const doc = await resolveIssue(client, issue);
      await client.mutation(api.issues.update, {
        issueId: doc._id,
        ...(title === undefined ? {} : { title }),
        ...(await toIssueArgs(client, doc.teamId, fields)),
      });
      return await oneIssue(client, doc.identifier);
    },
  }),
  defineTool({
    name: "move_issue",
    title: "Move issue on the board",
    description: "Moves an issue to a workflow state, at the top or bottom of that board column.",
    input: z.object({
      issue: issueRef,
      state: z.string().describe("Workflow state name or id"),
      position: z.enum(["top", "bottom"]).optional().describe("Default bottom"),
    }),
    annotations: WRITE,
    run: async (client, { issue, state, position }) => {
      const doc = await resolveIssue(client, issue);
      const stateId = await resolveStateId(client, doc.teamId, state);
      const board = await client.query(api.issues.listForBoard, { teamId: doc.teamId });
      const column = (board.find((c) => c.stateId === stateId)?.issues ?? []).filter((i) => i._id !== doc._id);
      const top = position === "top";
      await client.mutation(api.issues.move, {
        issueId: doc._id,
        stateId,
        beforeRank: top || column.length === 0 ? null : column[column.length - 1].rank,
        afterRank: top && column.length > 0 ? column[0].rank : null,
      });
      return await oneIssue(client, doc.identifier);
    },
  }),
  defineTool({
    name: "archive_issue",
    title: "Archive issue",
    description: "Archives an issue (hidden from lists and the board).",
    input: z.object({ issue: issueRef }),
    annotations: DESTRUCTIVE,
    run: async (client, { issue }) => {
      await client.mutation(api.issues.archive, { issueId: (await resolveIssue(client, issue))._id });
      return { archived: true };
    },
  }),
  defineTool({
    name: "delete_issue",
    title: "Delete issue",
    description: "Permanently deletes an issue with its comments and activity. Needs issues.delete. Can't be undone.",
    input: z.object({ issue: issueRef }),
    annotations: DESTRUCTIVE,
    run: async (client, { issue }) => {
      await client.mutation(api.issues.remove, { issueId: (await resolveIssue(client, issue))._id });
      return { deleted: true };
    },
  }),
  defineTool({
    name: "list_team_issues",
    title: "List team issues",
    description: "A team's open and closed issues (not archived), paginated, optionally in one state.",
    input: z.object({ team: teamRef, state: z.string().optional().describe("Workflow state name or id"), ...page }),
    annotations: READ,
    run: async (client, { team, state, ...rest }) => {
      const teamId = await resolveTeamId(client, team);
      const result = await client.query(api.issues.listByTeam, {
        teamId,
        ...(state === undefined ? {} : { stateId: await resolveStateId(client, teamId, state) }),
        paginationOpts: pageOpts(rest),
      });
      return { issues: await presentIssues(client, result.page), nextCursor: result.isDone ? null : result.continueCursor };
    },
  }),
  defineTool({
    name: "filter_issues",
    title: "Filter issues",
    description:
      "Issues matching every given filter, across teams you can see. Use assignees: [\"none\"] for unassigned, [\"me\"] for yours.",
    input: z.object({
      team: teamRef.optional(),
      stateTypes: z.array(z.enum(["backlog", "unstarted", "started", "completed", "canceled"])).optional(),
      assignees: z.array(z.string()).optional().describe("People or agents; \"none\" means unassigned"),
      labels: z.array(z.string()).optional(),
      priorities: z.array(z.number().int().min(0).max(4)).optional(),
      project: z.string().optional(),
      cycle: z.string().optional().describe("Cycle number, name or id (needs team)"),
      creator: z.string().optional(),
      ...page,
    }),
    annotations: READ,
    run: async (client, input) => {
      const teamId = input.team === undefined ? undefined : await resolveTeamId(client, input.team);
      if (input.cycle !== undefined && teamId === undefined) {
        throw new ToolError("INVALID_INPUT: filtering by cycle needs a team.");
      }
      const filter = {
        ...(teamId === undefined ? {} : { teamId }),
        ...(input.stateTypes === undefined ? {} : { stateTypes: input.stateTypes }),
        ...(input.assignees === undefined
          ? {}
          : {
              assigneeIds: await Promise.all(
                input.assignees.map((a) => (a.trim().toLowerCase() === "none" ? null : resolveUserId(client, a))),
              ),
            }),
        ...(input.labels === undefined ? {} : { labelIds: await resolveLabelIds(client, input.labels) }),
        ...(input.priorities === undefined ? {} : { priorities: input.priorities }),
        ...(input.project === undefined ? {} : { projectId: await resolveProjectId(client, input.project) }),
        ...(input.cycle === undefined || teamId === undefined
          ? {}
          : { cycleId: (await resolveCycle(client, teamId, input.cycle))._id }),
        ...(input.creator === undefined ? {} : { creatorId: await resolveUserId(client, input.creator) }),
      };
      const result = await client.query(api.issues.listFiltered, { filter, paginationOpts: pageOpts(input) });
      return { issues: await presentIssues(client, result.page), nextCursor: result.isDone ? null : result.continueCursor };
    },
  }),
  defineTool({
    name: "my_issues",
    title: "My issues",
    description: "Open issues assigned to you.",
    input: z.object({}),
    annotations: READ,
    run: async (client) => ({ issues: await presentIssues(client, await client.query(api.issues.listMine, {})) }),
  }),
  defineTool({
    name: "board",
    title: "Team board",
    description: "A team's board: each workflow state with its first issues in board order.",
    input: z.object({ team: teamRef }),
    annotations: READ,
    run: async (client, { team }) => {
      const teamId = await resolveTeamId(client, team);
      const [board, states] = await Promise.all([
        client.query(api.issues.listForBoard, { teamId }),
        client.query(api.workflowStates.list, { teamId }),
      ]);
      const name = new Map(states.map((s) => [s._id as string, s.name]));
      return {
        columns: await Promise.all(
          board.map(async (column) => ({
            state: name.get(column.stateId) ?? null,
            stateId: column.stateId,
            issues: await presentIssues(client, column.issues),
          })),
        ),
      };
    },
  }),
  defineTool({
    name: "list_sub_issues",
    title: "List sub-issues",
    description: "An issue's sub-issues.",
    input: z.object({ issue: issueRef }),
    annotations: READ,
    run: async (client, { issue }) => {
      const doc = await resolveIssue(client, issue);
      return { issues: await presentIssues(client, await client.query(api.issues.listSubIssues, { issueId: doc._id })) };
    },
  }),
  defineTool({
    name: "search_issues",
    title: "Search issues",
    description: "Full-text search over issue titles and descriptions, optionally in one team.",
    input: z.object({ query: z.string(), team: teamRef.optional() }),
    annotations: READ,
    run: async (client, { query, team }) => {
      const issues = await client.query(api.search.issues, {
        query,
        ...(team === undefined ? {} : { teamId: await resolveTeamId(client, team) }),
      });
      return { issues: await presentIssues(client, issues) };
    },
  }),
  defineTool({
    name: "issue_activity",
    title: "Issue activity",
    description: "An issue's change history (who changed what, from and to), newest first, paginated.",
    input: z.object({ issue: issueRef, ...page }),
    annotations: READ,
    run: async (client, { issue, ...rest }) => {
      const doc = await resolveIssue(client, issue);
      const result = await client.query(api.activities.listForIssue, { issueId: doc._id, paginationOpts: pageOpts(rest) });
      return { activities: result.page, nextCursor: result.isDone ? null : result.continueCursor };
    },
  }),

  // --- Comments ---
  defineTool({
    name: "list_comments",
    title: "List comments",
    description: "An issue's comments (Markdown), paginated.",
    input: z.object({ issue: issueRef, ...page }),
    annotations: READ,
    run: async (client, { issue, ...rest }) => {
      const doc = await resolveIssue(client, issue);
      const result = await client.query(api.comments.list, { issueId: doc._id, paginationOpts: pageOpts(rest) });
      return { comments: result.page, nextCursor: result.isDone ? null : result.continueCursor };
    },
  }),
  defineTool({
    name: "add_comment",
    title: "Add comment",
    description: "Comments on an issue (Markdown).",
    input: z.object({ issue: issueRef, body: z.string() }),
    annotations: WRITE,
    run: async (client, { issue, body }) => {
      const doc = await resolveIssue(client, issue);
      return { commentId: await client.mutation(api.comments.create, { issueId: doc._id, body }) };
    },
  }),
  defineTool({
    name: "edit_comment",
    title: "Edit comment",
    description: "Edits one of your own comments.",
    input: z.object({ commentId: z.string(), body: z.string() }),
    annotations: WRITE,
    run: async (client, { commentId, body }) => {
      await client.mutation(api.comments.update, { commentId: commentId as Id<"comments">, body });
      return { updated: true };
    },
  }),
  defineTool({
    name: "delete_comment",
    title: "Delete comment",
    description: "Deletes one of your own comments (admins may delete any comment).",
    input: z.object({ commentId: z.string() }),
    annotations: DESTRUCTIVE,
    run: async (client, { commentId }) => {
      await client.mutation(api.comments.remove, { commentId: commentId as Id<"comments"> });
      return { deleted: true };
    },
  }),
];
