import { env } from "../_generated/server";

// Who signs agent tokens, shared by convex/auth.config.ts (which trusts
// them) and convex/mcp/token.ts (which signs them).

export const AGENT_AUDIENCE = "velo-agent";

export function agentIssuer(): string {
  return `${env.CONVEX_SITE_URL}/agents`;
}
