import { verifyWebhook } from "@clerk/backend/webhooks";
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const signingSecret = env.CLERK_WEBHOOK_SIGNING_SECRET;
    if (!signingSecret) {
      console.error("CLERK_WEBHOOK_SIGNING_SECRET is not set");
      return new Response("Webhook not configured", { status: 500 });
    }

    const svixId = req.headers.get("svix-id");
    if (!svixId) {
      return new Response("Missing svix-id", { status: 400 });
    }

    let event;
    try {
      event = await verifyWebhook(req, { signingSecret });
    } catch {
      return new Response("Invalid signature", { status: 400 });
    }

    await ctx.runMutation(internal.clerkSync.handleEvent, {
      svixId,
      type: event.type,
      data: event.data,
    });
    return new Response(null, { status: 200 });
  }),
});

export default http;
