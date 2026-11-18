import { createTool, type ToolCtx } from "@convex-dev/agent";
import type { ToolSet } from "ai";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MemberInfo } from "../lib/auth";
import type { ProposedAction } from "./proposals";

/**
 * The assistant's read-only tools, bound to the member who sent the message.
 * The caller comes from guard.begin, so the model can never choose whose data
 * it reads; it only supplies search text, identifiers and team keys.
 */
export function readTools(member: MemberInfo): ToolSet {
  const caller = { orgId: member.orgId, userId: member.userId, role: member.role };
  return {
    searchIssues: createTool({
      description: "Full-text search over issue titles and descriptions the user can see. Returns up to 25 issues.",
      inputSchema: z.object({ query: z.string().describe("Words to search for") }),
      execute: async (ctx, input) => await ctx.runQuery(internal.ai.data.searchIssues, { ...caller, query: input.query }),
    }),
    getIssue: createTool({
      description: "One issue by its identifier (e.g. ENG-12): details, description and sub-issues. Null if it doesn't exist or the user can't see it.",
      inputSchema: z.object({ identifier: z.string().describe("Issue identifier such as ENG-12") }),
      execute: async (ctx, input) => await ctx.runQuery(internal.ai.data.getIssue, { ...caller, identifier: input.identifier }),
    }),
    listTeams: createTool({
      description: "The teams the user can see, with their keys.",
      inputSchema: z.object({}),
      execute: async (ctx) => await ctx.runQuery(internal.ai.data.listTeams, caller),
    }),
    listMembers: createTool({
      description: "Members of the workspace with their user ids and names.",
      inputSchema: z.object({}),
      execute: async (ctx) => await ctx.runQuery(internal.ai.data.listMembers, caller),
    }),
    listProjects: createTool({
      description: "Projects with status, progress and target date.",
      inputSchema: z.object({}),
      execute: async (ctx) => await ctx.runQuery(internal.ai.data.listProjects, caller),
    }),
    listCycles: createTool({
      description: "A team's recent cycles (sprints), newest first.",
      inputSchema: z.object({ teamKey: z.string().describe("Team key such as ENG") }),
      execute: async (ctx, input) => await ctx.runQuery(internal.ai.data.listCycles, { ...caller, teamKey: input.teamKey }),
    }),
    listLabels: createTool({
      description: "The workspace's issue labels.",
      inputSchema: z.object({}),
      execute: async (ctx) => await ctx.runQuery(internal.ai.data.listLabels, caller),
    }),
  };
}

const priority = z
  .number()
  .int()
  .min(0)
  .max(4)
  .describe("0 none, 1 urgent, 2 high, 3 medium, 4 low");
const assignee = z
  .string()
  .nullable()
  .describe("A userId from listMembers, or null for unassigned");

/**
 * Write tools. None of them changes anything: each records a proposal in the
 * thread that the member reviews and applies. They report "proposed" or the
 * reason the proposal was refused (NOT_FOUND, INVALID_INPUT, ...).
 */
export function writeTools(member: MemberInfo, threadId: Id<"aiThreads">): ToolSet {
  const caller = { orgId: member.orgId, userId: member.userId, role: member.role };
  const propose = async (ctx: ToolCtx, action: ProposedAction) => {
    const result = await ctx.runMutation(internal.ai.proposals.create, { ...caller, threadId, action });
    return result.ok
      ? { proposed: result.description, note: "Waiting for the user to apply it." }
      : { refused: result.error };
  };
  return {
    proposeCreateIssue: createTool({
      description: "Propose a new issue. The user must apply it.",
      inputSchema: z.object({
        teamKey: z.string().describe("Team key such as ENG"),
        title: z.string(),
        description: z.string().describe("Markdown; may be empty"),
        priority,
        assigneeId: assignee,
      }),
      execute: async (ctx, input) => await propose(ctx, { kind: "createIssue", ...input }),
    }),
    proposeUpdateIssue: createTool({
      description: "Propose changing an issue's title, description or state (by state name). The user must apply it.",
      inputSchema: z.object({
        identifier: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        stateName: z.string().optional().describe("Name of a workflow state of the issue's team"),
      }),
      execute: async (ctx, input) => await propose(ctx, { kind: "updateIssue", ...input }),
    }),
    proposeAssignIssue: createTool({
      description: "Propose assigning or unassigning an issue. The user must apply it.",
      inputSchema: z.object({ identifier: z.string(), assigneeId: assignee }),
      execute: async (ctx, input) => await propose(ctx, { kind: "assignIssue", ...input }),
    }),
    proposeSetPriority: createTool({
      description: "Propose an issue's priority. The user must apply it.",
      inputSchema: z.object({ identifier: z.string(), priority }),
      execute: async (ctx, input) => await propose(ctx, { kind: "setPriority", ...input }),
    }),
    proposeAddComment: createTool({
      description: "Propose a comment on an issue. The user must apply it.",
      inputSchema: z.object({ identifier: z.string(), body: z.string() }),
      execute: async (ctx, input) => await propose(ctx, { kind: "addComment", ...input }),
    }),
  };
}
