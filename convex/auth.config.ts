import { AuthConfig } from "convex/server";
import { env } from "./_generated/server";
import { AGENT_AUDIENCE, agentIssuer } from "./mcp/issuer";

if (!process.env.CLERK_FRONTEND_API_URL) {
  throw new Error("CLERK_FRONTEND_API_URL is not set");
}

export default {
  providers: [
    // People: Clerk session tokens.
    {
      domain: process.env.CLERK_FRONTEND_API_URL,
      applicationID: "convex",
    },
    // Agents (B9): short-lived tokens the MCP endpoint signs after checking
    // an agent's API key (convex/mcp/token.ts). Off until the key pair is set.
    ...(env.AGENT_JWT_JWKS
      ? [
          {
            type: "customJwt" as const,
            applicationID: AGENT_AUDIENCE,
            issuer: agentIssuer(),
            jwks: env.AGENT_JWT_JWKS,
            algorithm: "ES256" as const,
          },
        ]
      : []),
  ],
} satisfies AuthConfig;
