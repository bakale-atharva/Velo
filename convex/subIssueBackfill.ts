import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { syncProjectCounts } from "./lib/projectCounts";

// One-off: sub-issues created before they inherited their parent's project
// and cycle have neither, so their progress counts nowhere. This puts each
// such sub-issue in the project and cycle of its nearest ancestor that has
// one. Sub-issues that already have a project or cycle keep it; completed
// cycles are skipped. Run from the dashboard or CLI:
//   npx convex run subIssueBackfill:run
// It works page by page and schedules itself until done. Safe to rerun.

const PAGE = 100;
const MAX_DEPTH = 20;

type Scope = { projectId: Id<"projects"> | null; cycleId: Id<"cycles"> | null };

/** The nearest project and nearest cycle up the parent chain. */
async function inheritedScope(ctx: MutationCtx, issue: Doc<"issues">): Promise<Scope> {
  const scope: Scope = { projectId: null, cycleId: null };
  let parentId = issue.parentId;
  for (let depth = 0; parentId !== null && depth < MAX_DEPTH; depth++) {
    const parent: Doc<"issues"> | null = await ctx.db.get("issues", parentId);
    if (parent === null) break;
    scope.projectId ??= parent.projectId ?? null;
    scope.cycleId ??= parent.cycleId ?? null;
    if (scope.projectId !== null && scope.cycleId !== null) break;
    parentId = parent.parentId;
  }
  return scope;
}

export const run = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())), updated: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("issues")
      // Every issue with a parent.
      .withIndex("by_parentId", (q) => q.gt("parentId", null))
      .paginate({ numItems: PAGE, cursor: args.cursor ?? null });
    let updated = args.updated ?? 0;
    for (const issue of page.page) {
      if (issue.archivedAt !== null) continue;
      const needsProject = (issue.projectId ?? null) === null;
      const needsCycle = (issue.cycleId ?? null) === null;
      if (!needsProject && !needsCycle) continue;
      const scope = await inheritedScope(ctx, issue);
      const patch: Partial<Doc<"issues">> = {};
      if (needsProject && scope.projectId !== null) {
        const project = await ctx.db.get("projects", scope.projectId);
        if (project !== null && project.orgId === issue.orgId) {
          patch.projectId = project._id;
          await logActivity(ctx, { orgId: issue.orgId, issueId: issue._id, actorId: "system", type: "project", from: null, to: project.name });
        }
      }
      if (needsCycle && scope.cycleId !== null) {
        const cycle = await ctx.db.get("cycles", scope.cycleId);
        if (cycle !== null && cycle.teamId === issue.teamId && cycle.status !== "completed") {
          patch.cycleId = cycle._id;
          await logActivity(ctx, { orgId: issue.orgId, issueId: issue._id, actorId: "system", type: "cycle", from: null, to: cycle.name });
        }
      }
      if (Object.keys(patch).length === 0) continue;
      await ctx.db.patch("issues", issue._id, patch);
      await syncProjectCounts(ctx, issue, { ...issue, ...patch });
      updated++;
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.subIssueBackfill.run, { cursor: page.continueCursor, updated });
    } else {
      console.log(`Sub-issue backfill done: ${updated} sub-issues updated.`);
    }
    return null;
  },
});
