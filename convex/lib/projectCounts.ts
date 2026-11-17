import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// A project's progress: `issueCount` counts its issues that are not archived
// and not canceled; `completedIssueCount` counts those of them that are done.
// Every issue mutation calls `syncProjectCounts` with the issue before and
// after the change, in the same transaction.

type CountedFields = Pick<Doc<"issues">, "projectId" | "stateType" | "archivedAt">;

function contribution(issue: CountedFields | null) {
  if (
    issue === null ||
    issue.projectId === undefined ||
    issue.projectId === null ||
    issue.archivedAt !== null ||
    issue.stateType === "canceled"
  ) {
    return null;
  }
  return {
    projectId: issue.projectId,
    completed: issue.stateType === "completed" ? 1 : 0,
  };
}

async function adjust(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  issueDelta: number,
  completedDelta: number,
) {
  if (issueDelta === 0 && completedDelta === 0) {
    return;
  }
  // The project may have been deleted; its issues are being detached.
  const project = await ctx.db.get("projects", projectId);
  if (project === null) {
    return;
  }
  await ctx.db.patch("projects", projectId, {
    issueCount: Math.max(0, project.issueCount + issueDelta),
    completedIssueCount: Math.max(0, project.completedIssueCount + completedDelta),
  });
}

/** Moves the issue's share of the counts from its old project to its new one. */
export async function syncProjectCounts(
  ctx: MutationCtx,
  before: CountedFields | null,
  after: CountedFields | null,
): Promise<void> {
  const from = contribution(before);
  const to = contribution(after);
  if (from !== null && to !== null && from.projectId === to.projectId) {
    await adjust(ctx, from.projectId, 0, to.completed - from.completed);
    return;
  }
  if (from !== null) {
    await adjust(ctx, from.projectId, -1, -from.completed);
  }
  if (to !== null) {
    await adjust(ctx, to.projectId, 1, to.completed);
  }
}
