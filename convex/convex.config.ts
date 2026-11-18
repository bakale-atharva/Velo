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
  },
});

// Assistant threads and messages (B7).
app.use(agent);
// Per-org daily assistant limits (B7).
app.use(rateLimiter);

export default app;
