import type { MutationCtx } from "../_generated/server";
import type { MemberInfo } from "./auth";

/**
 * Records an org-level change. Written on every plan, so the history is
 * there when an org upgrades to a plan with `audit_log`.
 */
export async function logAudit(
  ctx: MutationCtx,
  member: MemberInfo,
  entry: {
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, string>;
  },
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    orgId: member.orgId,
    actorId: member.userId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: entry.metadata ?? {},
  });
}
