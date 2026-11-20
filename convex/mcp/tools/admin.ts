import { z } from "zod";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { AgentClient } from "../client";
import { defineTool, DESTRUCTIVE, READ, ToolError, WRITE, type Tool } from "../registry";
import { pageFields, pageOpts } from "./issues";
import { resolveUserId } from "./resolve";

// Custom roles and the audit log: admins only, on plans with custom_roles
// and audit_log (Business and up).

const permission = z.enum([
  "issues.delete",
  "teams.manage",
  "labels.manage",
  "projects.manage",
  "cycles.manage",
  "views.share",
  "agents.manage",
]);
const roleRef = z.string().describe("Custom role name or id");

async function resolveRoleId(client: AgentClient, ref: string): Promise<Id<"customRoles">> {
  const roles = await client.query(api.roles.list, {});
  const matches = roles.filter((r) => r._id === ref || r.name.toLowerCase() === ref.trim().toLowerCase());
  if (matches.length !== 1) throw new ToolError(`NOT_FOUND: no custom role matches "${ref}".`);
  return matches[0]._id;
}

export const adminTools: Tool[] = [
  defineTool({
    name: "list_roles",
    title: "List custom roles",
    description: "The workspace's custom roles and their permissions. Admins only (Business plan).",
    input: z.object({}),
    annotations: READ,
    run: async (client) => ({ roles: await client.query(api.roles.list, {}) }),
  }),
  defineTool({
    name: "role_assignments",
    title: "Custom role assignments",
    description: "Which members (people or agents) hold which custom role. Admins only.",
    input: z.object({}),
    annotations: READ,
    run: async (client) => ({ assignments: await client.query(api.roles.assignments, {}) }),
  }),
  defineTool({
    name: "create_role",
    title: "Create custom role",
    description: "Creates a custom role from a list of permissions. Admins only.",
    input: z.object({ name: z.string(), permissions: z.array(permission) }),
    annotations: WRITE,
    run: async (client, args) => ({ roleId: await client.mutation(api.roles.create, args) }),
  }),
  defineTool({
    name: "update_role",
    title: "Update custom role",
    description: "Renames a custom role or replaces its permissions. Admins only.",
    input: z.object({ role: roleRef, name: z.string().optional(), permissions: z.array(permission).optional() }),
    annotations: WRITE,
    run: async (client, { role, ...fields }) => {
      await client.mutation(api.roles.update, { roleId: await resolveRoleId(client, role), ...fields });
      return { updated: true };
    },
  }),
  defineTool({
    name: "delete_role",
    title: "Delete custom role",
    description: "Deletes a custom role; its members go back to the default permissions. Admins only.",
    input: z.object({ role: roleRef }),
    annotations: DESTRUCTIVE,
    run: async (client, { role }) => {
      await client.mutation(api.roles.remove, { roleId: await resolveRoleId(client, role) });
      return { deleted: true };
    },
  }),
  defineTool({
    name: "assign_role",
    title: "Assign custom role",
    description: "Gives a member (person or agent) a custom role, or clears it with role: null. Admins only.",
    input: z.object({
      member: z.string().describe("User id, email or exact name"),
      role: roleRef.nullable(),
    }),
    annotations: WRITE,
    run: async (client, { member, role }) => {
      await client.mutation(api.roles.assign, {
        userId: await resolveUserId(client, member),
        roleId: role === null ? null : await resolveRoleId(client, role),
      });
      return { assigned: true };
    },
  }),
  defineTool({
    name: "audit_log",
    title: "Audit log",
    description: "Org-level changes (teams, roles, agents, keys, deletions), newest first, paginated. Admins only, on plans with the audit log.",
    input: z.object({ ...pageFields }),
    annotations: READ,
    run: async (client, input) => {
      const result = await client.query(api.auditLogs.list, { paginationOpts: pageOpts(input) });
      return { entries: result.page, nextCursor: result.isDone ? null : result.continueCursor };
    },
  }),
];
