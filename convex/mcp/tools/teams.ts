import { z } from "zod";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { AgentClient } from "../client";
import { defineTool, DESTRUCTIVE, READ, WRITE, type Tool } from "../registry";
import { resolveLabelIds, resolveStateId, resolveTeamId, resolveUserId } from "./resolve";

// Teams, their members and workflow states, and the workspace's labels.

const teamRef = z.string().describe("Team key (e.g. ENG) or id");
const memberRef = z.string().describe("User id, email or exact name of a person or agent; \"me\" for yourself");
const stateType = z.enum(["backlog", "unstarted", "started", "completed", "canceled"]);
const color = z.string().describe("Hex color like #4c9f70");

/** The agent row of `userId` if the caller manages that agent. */
async function managedAgentId(client: AgentClient, userId: string): Promise<Id<"agents"> | null> {
  const agents = await client.query(api.agents.list, {});
  const agent = agents.find((a) => a.userId === userId);
  return agent !== undefined && agent.canManage ? agent._id : null;
}

export const teamTools: Tool[] = [
  // --- Teams ---
  defineTool({
    name: "list_teams",
    title: "List teams",
    description: "Teams you can see (private teams only if you're a member), with keys and ids.",
    input: z.object({ includeArchived: z.boolean().optional() }),
    annotations: READ,
    run: async (client, args) => ({ teams: await client.query(api.teams.list, args) }),
  }),
  defineTool({
    name: "get_team",
    title: "Get team",
    description: "One team with its workflow states and members.",
    input: z.object({ team: teamRef }),
    annotations: READ,
    run: async (client, { team }) => {
      const teamId = await resolveTeamId(client, team);
      const teams = await client.query(api.teams.list, { includeArchived: true });
      const [states, memberIds] = await Promise.all([
        client.query(api.workflowStates.list, { teamId }),
        client.query(api.teams.listMembers, { teamId }),
      ]);
      return { team: teams.find((t) => t._id === teamId), states, memberIds };
    },
  }),
  defineTool({
    name: "create_team",
    title: "Create team",
    description: "Creates a team with the default workflow states. Needs teams.manage; private teams need the Business plan.",
    input: z.object({
      name: z.string(),
      key: z.string().describe("2-5 uppercase letters, unique, used in issue ids (ENG-1)"),
      isPrivate: z.boolean().optional(),
    }),
    annotations: WRITE,
    run: async (client, args) => {
      const teamId = await client.mutation(api.teams.create, { ...args, key: args.key.trim().toUpperCase() });
      return { teamId, key: args.key.trim().toUpperCase() };
    },
  }),
  defineTool({
    name: "update_team",
    title: "Update team",
    description: "Renames a team or changes its privacy. Needs teams.manage.",
    input: z.object({ team: teamRef, name: z.string().optional(), isPrivate: z.boolean().optional() }),
    annotations: WRITE,
    run: async (client, { team, ...fields }) => {
      await client.mutation(api.teams.update, { teamId: await resolveTeamId(client, team), ...fields });
      return { updated: true };
    },
  }),
  defineTool({
    name: "archive_team",
    title: "Archive team",
    description: "Archives a team (hidden from lists; reversible with unarchive_team). Needs teams.manage.",
    input: z.object({ team: teamRef }),
    annotations: DESTRUCTIVE,
    run: async (client, { team }) => {
      await client.mutation(api.teams.archive, { teamId: await resolveTeamId(client, team) });
      return { archived: true };
    },
  }),
  defineTool({
    name: "unarchive_team",
    title: "Unarchive team",
    description: "Restores an archived team. Needs teams.manage.",
    input: z.object({ team: teamRef }),
    annotations: WRITE,
    run: async (client, { team }) => {
      await client.mutation(api.teams.unarchive, { teamId: await resolveTeamId(client, team) });
      return { unarchived: true };
    },
  }),
  defineTool({
    name: "delete_team",
    title: "Delete team",
    description:
      "Permanently deletes an archived team and all its issues, cycles and states. Admins only. Pass the team's key again as confirmKey. Can't be undone.",
    input: z.object({ team: teamRef, confirmKey: z.string().describe("The team's key, typed again") }),
    annotations: DESTRUCTIVE,
    run: async (client, { team, confirmKey }) => {
      await client.mutation(api.teams.remove, { teamId: await resolveTeamId(client, team), confirmKey });
      return { deleted: true };
    },
  }),
  defineTool({
    name: "list_team_members",
    title: "List team members",
    description: "People and agents in a team (membership matters for private teams).",
    input: z.object({ team: teamRef }),
    annotations: READ,
    run: async (client, { team }) => {
      const teamId = await resolveTeamId(client, team);
      const [ids, members] = await Promise.all([
        client.query(api.teams.listMembers, { teamId }),
        client.query(api.members.list, {}),
      ]);
      const byId = new Map(members.map((m) => [m.userId, m]));
      return { members: ids.map((id) => byId.get(id) ?? { userId: id }) };
    },
  }),
  defineTool({
    name: "add_team_member",
    title: "Add team member",
    description:
      "Adds a person or agent to a team. You can add agents you manage (e.g. your subagents) to teams you can see; anyone else needs teams.manage.",
    input: z.object({ team: teamRef, member: memberRef }),
    annotations: WRITE,
    run: async (client, { team, member }) => {
      const teamId = await resolveTeamId(client, team);
      const userId = await resolveUserId(client, member);
      const agentId = await managedAgentId(client, userId);
      if (agentId !== null) {
        await client.mutation(api.agents.addToTeam, { agentId, teamId });
      } else {
        await client.mutation(api.teams.addMember, { teamId, userId });
      }
      return { added: userId };
    },
  }),
  defineTool({
    name: "remove_team_member",
    title: "Remove team member",
    description:
      "Removes a person or agent from a team (agents you manage, or anyone with teams.manage). A private team keeps at least one member.",
    input: z.object({ team: teamRef, member: memberRef }),
    annotations: DESTRUCTIVE,
    run: async (client, { team, member }) => {
      const teamId = await resolveTeamId(client, team);
      const userId = await resolveUserId(client, member);
      const agentId = await managedAgentId(client, userId);
      if (agentId !== null) {
        await client.mutation(api.agents.removeFromTeam, { agentId, teamId });
      } else {
        await client.mutation(api.teams.removeMember, { teamId, userId });
      }
      return { removed: userId };
    },
  }),

  // --- Workflow states ---
  defineTool({
    name: "list_states",
    title: "List workflow states",
    description: "A team's workflow states in board order (types: backlog, unstarted, started, completed, canceled).",
    input: z.object({ team: teamRef }),
    annotations: READ,
    run: async (client, { team }) => ({
      states: await client.query(api.workflowStates.list, { teamId: await resolveTeamId(client, team) }),
    }),
  }),
  defineTool({
    name: "create_state",
    title: "Create workflow state",
    description: "Adds a workflow state to a team. Needs teams.manage.",
    input: z.object({ team: teamRef, name: z.string(), type: stateType, color }),
    annotations: WRITE,
    run: async (client, { team, ...fields }) => ({
      stateId: await client.mutation(api.workflowStates.create, {
        teamId: await resolveTeamId(client, team),
        ...fields,
      }),
    }),
  }),
  defineTool({
    name: "update_state",
    title: "Update workflow state",
    description: "Renames or recolors a team's workflow state. Needs teams.manage.",
    input: z.object({
      team: teamRef,
      state: z.string().describe("State name or id"),
      name: z.string().optional(),
      color: color.optional(),
    }),
    annotations: WRITE,
    run: async (client, { team, state, ...fields }) => {
      const teamId = await resolveTeamId(client, team);
      await client.mutation(api.workflowStates.update, {
        stateId: await resolveStateId(client, teamId, state),
        ...fields,
      });
      return { updated: true };
    },
  }),
  defineTool({
    name: "reorder_states",
    title: "Reorder workflow states",
    description: "Sets the order of all of a team's workflow states. Needs teams.manage.",
    input: z.object({ team: teamRef, states: z.array(z.string()).describe("Every state name or id, in the new order") }),
    annotations: WRITE,
    run: async (client, { team, states }) => {
      const teamId = await resolveTeamId(client, team);
      const stateIds = await Promise.all(states.map((s) => resolveStateId(client, teamId, s)));
      await client.mutation(api.workflowStates.reorder, { teamId, stateIds });
      return { reordered: true };
    },
  }),
  defineTool({
    name: "delete_state",
    title: "Delete workflow state",
    description: "Deletes a workflow state no issue uses (a team keeps at least one state). Needs teams.manage.",
    input: z.object({ team: teamRef, state: z.string().describe("State name or id") }),
    annotations: DESTRUCTIVE,
    run: async (client, { team, state }) => {
      const teamId = await resolveTeamId(client, team);
      await client.mutation(api.workflowStates.remove, { stateId: await resolveStateId(client, teamId, state) });
      return { deleted: true };
    },
  }),

  // --- Labels ---
  defineTool({
    name: "list_labels",
    title: "List labels",
    description: "The workspace's labels.",
    input: z.object({}),
    annotations: READ,
    run: async (client) => ({ labels: await client.query(api.labels.list, {}) }),
  }),
  defineTool({
    name: "create_label",
    title: "Create label",
    description: "Creates a workspace label. Needs labels.manage.",
    input: z.object({ name: z.string(), color: color.optional() }),
    annotations: WRITE,
    run: async (client, { name, color: hex }) => ({
      labelId: await client.mutation(api.labels.create, { name, color: hex ?? "#8b8f98" }),
    }),
  }),
  defineTool({
    name: "update_label",
    title: "Update label",
    description: "Renames or recolors a label. Needs labels.manage.",
    input: z.object({ label: z.string().describe("Label name or id"), name: z.string().optional(), color: color.optional() }),
    annotations: WRITE,
    run: async (client, { label, ...fields }) => {
      const [labelId] = await resolveLabelIds(client, [label]);
      await client.mutation(api.labels.update, { labelId, ...fields });
      return { updated: true };
    },
  }),
  defineTool({
    name: "delete_label",
    title: "Delete label",
    description: "Deletes a label; issues that had it simply stop showing it. Needs labels.manage.",
    input: z.object({ label: z.string().describe("Label name or id") }),
    annotations: DESTRUCTIVE,
    run: async (client, { label }) => {
      const [labelId] = await resolveLabelIds(client, [label]);
      await client.mutation(api.labels.remove, { labelId });
      return { deleted: true };
    },
  }),
];
