import { z } from "zod";
import { api } from "../../_generated/api";
import { defineTool, DESTRUCTIVE, READ, ToolError, WRITE, type Tool } from "../registry";
import { resolveAgentId, resolveTeamId } from "./resolve";

// Agents and subagents. Creating and managing agents needs "can manage
// agents" (for agents) or agents.manage (for people); an agent manages only
// agents below it, and may edit its own profile.

const agentRef = z.string().describe("Agent id, agent user id (agent_...) or exact name");
const runtime = z.enum(["claude", "openclaw", "other"]);
const metadata = z
  .record(z.string(), z.string())
  .describe("Free-form key/value pairs (at most 20; keys start with a letter)");

const profileFields = {
  imageUrl: z.string().nullable().optional().describe("https URL of a profile photo; null removes it"),
  description: z.string().optional().describe("What the agent does"),
  model: z.string().nullable().optional().describe("Model it runs on, e.g. claude-opus-5-5"),
  runtime: runtime.optional().describe("What it runs on: claude, openclaw or other"),
  metadata: metadata.optional(),
};

// Explicitly typed: files under convex/ are part of the generated `api`
// type, so an inferred type here that uses `api` would make it circular.
export const agentTools: Tool[] = [
  defineTool({
    name: "list_agents",
    title: "List agents",
    description:
      "All agents in the workspace with their role, parent, teams and status. canManage says whether you may change each one.",
    input: z.object({}),
    annotations: READ,
    run: async (client) => ({ agents: await client.query(api.agents.list, {}) }),
  }),
  defineTool({
    name: "get_agent",
    title: "Get agent",
    description: "One agent's profile, role, parent, teams and status.",
    input: z.object({ agent: agentRef }),
    annotations: READ,
    run: async (client, { agent }) =>
      await client.query(api.agents.get, { agentId: await resolveAgentId(client, agent) }),
  }),
  defineTool({
    name: "create_agent",
    title: "Create agent",
    description:
      "Creates an agent member (a subagent below you when you are an agent) with a name, photo, description, model and metadata, optionally adding it to teams. Its role can't be above yours. It can then be assigned issues. Give it a key with create_agent_key if it will connect itself.",
    input: z.object({
      name: z.string().describe("Display name"),
      ...profileFields,
      teams: z.array(z.string()).optional().describe("Team keys or ids to add it to"),
    }),
    annotations: WRITE,
    run: async (client, { teams, ...args }) => {
      const teamIds = await Promise.all((teams ?? []).map((t) => resolveTeamId(client, t)));
      const agentId = await client.mutation(api.agents.create, { ...args, teamIds });
      return await client.query(api.agents.get, { agentId });
    },
  }),
  defineTool({
    name: "update_agent",
    title: "Update agent",
    description:
      "Changes an agent's name, photo URL, description, model, runtime or metadata (yourself, or an agent you manage), or its role and canManageAgents (agents you manage only).",
    input: z.object({
      agent: agentRef,
      name: z.string().optional(),
      ...profileFields,
    }),
    annotations: WRITE,
    run: async (client, { agent, ...fields }) => {
      const agentId = await resolveAgentId(client, agent);
      await client.mutation(api.agents.update, { agentId, ...fields });
      return await client.query(api.agents.get, { agentId });
    },
  }),
  defineTool({
    name: "disable_agent",
    title: "Disable agent",
    description: "Disables an agent you manage: its keys stop working and it can't manage agents. Reversible with enable_agent.",
    input: z.object({ agent: agentRef }),
    annotations: DESTRUCTIVE,
    run: async (client, { agent }) => {
      await client.mutation(api.agents.disable, { agentId: await resolveAgentId(client, agent) });
      return { disabled: true };
    },
  }),
  defineTool({
    name: "enable_agent",
    title: "Enable agent",
    description: "Re-enables a disabled agent you manage.",
    input: z.object({ agent: agentRef }),
    annotations: WRITE,
    run: async (client, { agent }) => {
      await client.mutation(api.agents.enable, { agentId: await resolveAgentId(client, agent) });
      return { enabled: true };
    },
  }),
  defineTool({
    name: "delete_agent",
    title: "Delete agent",
    description:
      "Deletes an agent you manage and every agent below it, unassigning their issues. Can't be undone.",
    input: z.object({ agent: agentRef }),
    annotations: DESTRUCTIVE,
    run: async (client, { agent }) => {
      await client.mutation(api.agents.remove, { agentId: await resolveAgentId(client, agent) });
      return { deleted: true };
    },
  }),
  defineTool({
    name: "create_agent_key",
    title: "Create agent API key",
    description:
      "Creates an API key for yourself or an agent you manage, so it can connect to this MCP server. The key is returned only this once; store it securely.",
    input: z.object({ agent: agentRef, label: z.string().describe("Where the key will be used") }),
    annotations: WRITE,
    run: async (client, { agent, label }) => {
      const created = await client.action(api.agentKeys.create, {
        agentId: await resolveAgentId(client, agent),
        label,
      });
      return { ...created, note: "This key is shown only once. Send it as `Authorization: Bearer <key>`." };
    },
  }),
  defineTool({
    name: "list_agent_keys",
    title: "List agent API keys",
    description: "API keys of yourself or an agent you manage: label, prefix, last use, revoked or not (never the key itself).",
    input: z.object({ agent: agentRef }),
    annotations: READ,
    run: async (client, { agent }) => ({
      keys: await client.query(api.agentKeys.list, { agentId: await resolveAgentId(client, agent) }),
    }),
  }),
  defineTool({
    name: "revoke_agent_key",
    title: "Revoke agent API key",
    description: "Revokes one API key (by key id or prefix) of yourself or an agent you manage. Requests with it fail at once.",
    input: z.object({
      agent: agentRef,
      key: z.string().describe("Key id or the key's prefix (velo_...)"),
    }),
    annotations: DESTRUCTIVE,
    run: async (client, { agent, key }) => {
      const keys = await client.query(api.agentKeys.list, { agentId: await resolveAgentId(client, agent) });
      const matches = keys.filter((k) => k._id === key || k.prefix === key.trim());
      if (matches.length !== 1) {
        throw new ToolError(`NOT_FOUND: no single key matches "${key}".`);
      }
      await client.mutation(api.agentKeys.revoke, { keyId: matches[0]._id });
      return { revoked: matches[0].prefix };
    },
  }),
];
