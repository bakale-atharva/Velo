import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberInfo } from "./auth";
import { appError } from "./errors";

type DbCtx = QueryCtx | MutationCtx;

export async function isTeamMember(
  ctx: DbCtx,
  teamId: Id<"teams">,
  userId: string,
): Promise<boolean> {
  const row = await ctx.db
    .query("teamMembers")
    .withIndex("by_teamId_and_userId", (q) =>
      q.eq("teamId", teamId).eq("userId", userId),
    )
    .unique();
  return row !== null;
}

/**
 * Whether the member may see a team. Public teams are open to the whole org.
 * Private teams are open only to their members; org admins get no exception.
 */
export async function canAccessTeam(
  ctx: DbCtx,
  member: MemberInfo,
  team: Doc<"teams">,
): Promise<boolean> {
  if (team.orgId !== member.orgId) {
    return false;
  }
  if (!team.isPrivate) {
    return true;
  }
  return await isTeamMember(ctx, team._id, member.userId);
}

/**
 * Keeps the issues whose team the member may see (drops issues of private
 * teams the member is not in). Each team is checked once.
 */
export async function filterVisibleIssues<T extends { teamId: Id<"teams">; orgId: string }>(
  ctx: DbCtx,
  member: MemberInfo,
  issues: T[],
): Promise<T[]> {
  const access = new Map<Id<"teams">, boolean>();
  const visible: T[] = [];
  for (const issue of issues) {
    if (issue.orgId !== member.orgId) {
      continue;
    }
    let allowed = access.get(issue.teamId);
    if (allowed === undefined) {
      const team = await ctx.db.get("teams", issue.teamId);
      allowed = team !== null && (await canAccessTeam(ctx, member, team));
      access.set(issue.teamId, allowed);
    }
    if (allowed) {
      visible.push(issue);
    }
  }
  return visible;
}

/**
 * A copy of each doc with `teamIds` cut to the teams the member may see, so
 * private teams the member is not in are not revealed. Each team is checked
 * once.
 */
export async function withVisibleTeams<T extends { teamIds: Id<"teams">[] }>(
  ctx: DbCtx,
  member: MemberInfo,
  docs: T[],
): Promise<T[]> {
  const access = new Map<Id<"teams">, boolean>();
  const result: T[] = [];
  for (const doc of docs) {
    const teamIds: Id<"teams">[] = [];
    for (const teamId of doc.teamIds) {
      let allowed = access.get(teamId);
      if (allowed === undefined) {
        const team = await ctx.db.get("teams", teamId);
        allowed = team !== null && (await canAccessTeam(ctx, member, team));
        access.set(teamId, allowed);
      }
      if (allowed) {
        teamIds.push(teamId);
      }
    }
    result.push({ ...doc, teamIds });
  }
  return result;
}

/**
 * Loads a team the member may see. A team of another org and a private team
 * the member does not belong to both look like a missing team.
 */
export async function requireTeamAccess(
  ctx: DbCtx,
  member: MemberInfo,
  teamId: Id<"teams">,
): Promise<Doc<"teams">> {
  const team = await ctx.db.get("teams", teamId);
  if (team === null || !(await canAccessTeam(ctx, member, team))) {
    throw appError("NOT_FOUND");
  }
  return team;
}
