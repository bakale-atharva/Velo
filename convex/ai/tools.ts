import { createTool } from "@convex-dev/agent";
import type { ToolSet } from "ai";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { MemberInfo } from "../lib/auth";

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
