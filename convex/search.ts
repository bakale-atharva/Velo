import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMember } from "./lib/auth";
import { appError } from "./lib/errors";
import { issueValidator, toPublicIssue } from "./lib/issueOps";
import { filterVisibleIssues, requireTeamAccess } from "./lib/teamAccess";

const MAX_RESULTS = 25;
const MAX_QUERY_LENGTH = 200;

/**
 * Issues of the active org whose title or description match `query`, best
 * match first (up to 25). Archived issues and issues of private teams the
 * caller is not in are left out. An empty query returns nothing.
 */
export const issues = query({
  args: { query: v.string(), teamId: v.optional(v.id("teams")) },
  returns: v.array(issueValidator),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const text = args.query.trim();
    if (text.length > MAX_QUERY_LENGTH) {
      throw appError("INVALID_INPUT");
    }
    if (text.length === 0) {
      return [];
    }
    const { teamId } = args;
    if (teamId !== undefined) {
      await requireTeamAccess(ctx, member, teamId);
    }
    const hits = await ctx.db
      .query("issues")
      .withSearchIndex("search_text", (q) => {
        const inOrg = q.search("searchText", text).eq("orgId", member.orgId);
        return teamId === undefined ? inOrg : inOrg.eq("teamId", teamId);
      })
      .take(MAX_RESULTS);
    const open = hits.filter((issue) => issue.archivedAt === null);
    const visible = await filterVisibleIssues(ctx, member, open);
    return visible.map(toPublicIssue);
  },
});
