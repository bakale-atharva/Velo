import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type ActivityType = Doc<"activities">["type"];

/** Records one change to an issue. Call it from every issue and comment mutation. */
export async function logActivity(
  ctx: MutationCtx,
  activity: {
    orgId: string;
    issueId: Id<"issues">;
    actorId: string;
    type: ActivityType;
    from?: string | null;
    to?: string | null;
    viaAssistant?: boolean;
  },
): Promise<void> {
  await ctx.db.insert("activities", {
    orgId: activity.orgId,
    issueId: activity.issueId,
    actorId: activity.actorId,
    viaAssistant: activity.viaAssistant ?? false,
    type: activity.type,
    from: activity.from ?? null,
    to: activity.to ?? null,
  });
}
