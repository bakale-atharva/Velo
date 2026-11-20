import type { UserIdentity } from "convex/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { agentIssuer } from "../mcp/issuer";
import { appError } from "./errors";
import { hasSeat } from "./seats";

type AuthCtx = QueryCtx | MutationCtx | ActionCtx;
type DbCtx = QueryCtx | MutationCtx;

export type OrgClaims = {
  orgId: string | null;
  orgSlug: string | null;
  role: string | null;
};

export type AuthInfo = {
  userId: string;
  orgId: string | null;
  role: string | null;
};

export type MemberInfo = {
  userId: string;
  orgId: string;
  role: string;
};

/**
 * Reads the active organization from a session token.
 * A Clerk v2 token carries a nested claim `o: { id, slg, rol }` (verified
 * against a real dev token). Agent tokens Velo signs (B9) carry the same
 * claim, but Convex flattens nested claims of custom JWT providers into
 * "o.id", "o.slg" and "o.rol"; those keys are read only for tokens from
 * Velo's own agent issuer. `rol` has no "org:" prefix, but strip it
 * defensively.
 */
export function readOrgClaims(identity: UserIdentity): OrgClaims {
  const o: unknown = identity["o"];
  let claims: Record<string, unknown>;
  if (typeof o === "object" && o !== null && !Array.isArray(o)) {
    claims = o as Record<string, unknown>;
  } else if (identity.issuer === agentIssuer()) {
    claims = { id: identity["o.id"], slg: identity["o.slg"], rol: identity["o.rol"] };
  } else {
    return { orgId: null, orgSlug: null, role: null };
  }
  const str = (value: unknown) =>
    typeof value === "string" && value.length > 0 ? value : null;
  const role = str(claims.rol);
  return {
    orgId: str(claims.id),
    orgSlug: str(claims.slg),
    role: role === null ? null : role.replace(/^org:/, ""),
  };
}

export async function getAuth(ctx: AuthCtx): Promise<AuthInfo> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw appError("UNAUTHENTICATED");
  }
  const { orgId, role } = readOrgClaims(identity);
  return { userId: identity.subject, orgId, role };
}

/**
 * Identity, active org and role from the token, plus the seat-limit check
 * (members beyond the plan's seat limit get SEAT_LIMIT_REACHED).
 * Actions have no database; they must call an internal query that does this.
 */
export async function requireMember(ctx: DbCtx): Promise<MemberInfo> {
  const { userId, orgId, role } = await getAuth(ctx);
  if (orgId === null) {
    throw appError("NO_ACTIVE_ORG");
  }
  const member = { userId, orgId, role: role ?? "member" };
  if (!(await hasSeat(ctx, orgId, userId, member.role))) {
    throw appError("SEAT_LIMIT_REACHED");
  }
  return member;
}

export async function requireAdmin(ctx: DbCtx): Promise<MemberInfo> {
  const member = await requireMember(ctx);
  if (member.role !== "admin") {
    throw appError("FORBIDDEN");
  }
  return member;
}
