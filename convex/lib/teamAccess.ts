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
