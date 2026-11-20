import { api } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { AgentClient } from "../client";
import { ToolError } from "../registry";

// Turns the references an agent knows (team key "ENG", a member's name or
// email, an agent's name) into Velo ids. Every lookup goes through public
// functions, so an agent can only resolve what it may see.

const norm = (value: string) => value.trim().toLowerCase();

function pickOne<T>(matches: T[], kind: string, ref: string): T {
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new ToolError(`NOT_FOUND: no ${kind} matches "${ref}".`);
  throw new ToolError(`INVALID_INPUT: "${ref}" matches ${matches.length} ${kind}s; use an id.`);
}

/** A team by key (case-insensitive) or id, archived teams included. */
export async function resolveTeam(client: AgentClient, ref: string): Promise<Doc<"teams">> {
  const teams = await client.query(api.teams.list, { includeArchived: true });
  return pickOne(
    teams.filter((t) => t._id === ref || norm(t.key) === norm(ref)),
    "team",
    ref,
  );
}

export async function resolveTeamId(client: AgentClient, ref: string): Promise<Id<"teams">> {
  return (await resolveTeam(client, ref))._id;
}

/** A member (person or agent) by user id, email or exact name. */
export async function resolveUserId(client: AgentClient, ref: string): Promise<string> {
  if (norm(ref) === "me") {
    return (await client.query(api.members.me, {})).userId;
  }
  const members = await client.query(api.members.list, {});
  const byId = members.filter((m) => m.userId === ref.trim());
  if (byId.length === 1) return byId[0].userId;
  return pickOne(
    members.filter(
      (m) => (m.email !== null && norm(m.email) === norm(ref)) || (m.name !== null && norm(m.name) === norm(ref)),
    ),
    "member",
    ref,
  ).userId;
}

/** `null` stays null (unassign); anything else is resolved. */
export async function resolveOptionalUserId(
  client: AgentClient,
  ref: string | null,
): Promise<string | null> {
  return ref === null ? null : await resolveUserId(client, ref);
}

/** An agent by id, user id or exact name. */
export async function resolveAgentId(client: AgentClient, ref: string): Promise<Id<"agents">> {
  const agents = await client.query(api.agents.list, {});
  return pickOne(
    agents.filter((a) => a._id === ref || a.userId === ref || norm(a.name) === norm(ref)),
    "agent",
    ref,
  )._id;
}

/** "YYYY-MM-DD" (or any ISO date) to ms; null stays null. */
export function parseDate(value: string | null): number | null {
  if (value === null) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new ToolError(`INVALID_INPUT: "${value}" is not a date (use YYYY-MM-DD).`);
  return ms;
}

/** ms to "YYYY-MM-DD"; null stays null. */
export function formatDate(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString().slice(0, 10);
}
