import agent from "@convex-dev/agent/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    // Signing secret of the Clerk webhook endpoint (Clerk Dashboard → Webhooks).
    CLERK_WEBHOOK_SIGNING_SECRET: v.optional(v.string()),
    // OpenRouter key for the assistant (docs/ai-models.md).
    OPENROUTER_API_KEY: v.optional(v.string()),
    // Agent token signing (B9): made by `node scripts/agent-jwt-keys.mjs`.
    // The private key as a JWK (secret), and the public key set as a data URI.
    AGENT_JWT_PRIVATE_KEY: v.optional(v.string()),
    AGENT_JWT_JWKS: v.optional(v.string()),
    // Priority workspaces: Clerk org ids, comma-separated, that get the top
    // plan whatever their subscription says (convex/lib/entitlements.ts).
    PRIORITY_ORG_IDS: v.optional(v.string()),
  },
});

// Assistant threads and messages (B7).
app.use(agent);
// Per-org daily assistant limits (B7).
app.use(rateLimiter);

export default app;
