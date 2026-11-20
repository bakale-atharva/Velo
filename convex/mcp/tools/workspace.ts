import { z } from "zod";
import { api } from "../../_generated/api";
import { defineTool, READ, type Tool } from "../registry";

// Who the agent is, its workspace, plan and the people and agents in it.

export const workspaceTools: Tool[] = [
  defineTool({
    name: "whoami",
    title: "Who am I",
    description:
      "Your identity in Velo: your member record, your agent profile, the workspace you act in and your permissions. Call this first.",
    input: z.object({}),
    annotations: READ,
    run: async (client) => {
      const [me, org, permissions, agents] = await Promise.all([
        client.query(api.members.me, {}),
        client.query(api.organizations.current, {}),
        client.query(api.members.permissions, {}),
        client.query(api.agents.list, {}),
      ]);
      const agent = agents.find((a) => a.userId === me.userId) ?? null;
      return {
        you: me,
        agent,
        workspace: org === null ? { orgId: me.orgId } : { orgId: me.orgId, name: org.name, slug: org.slug },
        permissions,
        canManageAgents: agent?.canManageAgents ?? false,
      };
    },
  }),
  defineTool({
    name: "get_organization",
    title: "Get workspace",
    description: "The workspace (organization) you act in: name and slug.",
    input: z.object({}),
    annotations: READ,
    run: async (client) => await client.query(api.organizations.current, {}),
  }),
  defineTool({
    name: "get_plan",
    title: "Get plan",
    description: "The workspace's plan, its features, the AI daily limit and seat usage (people only; agents use no seats).",
    input: z.object({}),
    annotations: READ,
    run: async (client) => {
      const [plan, seats] = await Promise.all([
        client.query(api.billing.currentPlan, {}),
        client.query(api.billing.seats, {}),
      ]);
      return { ...plan, seats };
    },
  }),
  defineTool({
    name: "my_permissions",
    title: "My permissions",
    description:
      "The Velo permissions your role gives you (e.g. issues.delete, teams.manage, labels.manage, agents.manage).",
    input: z.object({}),
    annotations: READ,
    run: async (client) => ({ permissions: await client.query(api.members.permissions, {}) }),
  }),
  defineTool({
    name: "list_members",
    title: "List members",
    description:
      "Everyone in the workspace, people and agents (isAgent: true), with user ids to use as assignees.",
    input: z.object({}),
    annotations: READ,
    run: async (client) => ({ members: await client.query(api.members.list, {}) }),
  }),
];
