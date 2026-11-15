import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    // Signing secret of the Clerk webhook endpoint (Clerk Dashboard → Webhooks).
    CLERK_WEBHOOK_SIGNING_SECRET: v.optional(v.string()),
  },
});

export default app;
