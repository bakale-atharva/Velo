import {
  createThread as createAgentThread,
  listMessages as listAgentMessages,
  saveMessage as saveAgentMessage,
  vMessageDoc,
  vPaginationResult,
} from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "../_generated/server";
import type { MemberInfo } from "../lib/auth";
import { appError } from "../lib/errors";
import schema from "../schema";
import { buildAgent, withFallback } from "./agent";
import { MODEL_RETRIES } from "./models";
import { requireAiAccess } from "./guard";
import { readTools, writeTools } from "./tools";

// Assistant conversations. A member sees and writes only their own threads.

const MAX_THREADS = 50;
const MAX_MESSAGE_LENGTH = 4000;
const TITLE_LENGTH = 60;
const NEW_TITLE = "New chat";

async function loadOwnThread(
  ctx: QueryCtx,
  member: Pick<MemberInfo, "orgId" | "userId">,
  threadId: Id<"aiThreads">,
): Promise<Doc<"aiThreads">> {
  const thread = await ctx.db.get("aiThreads", threadId);
  if (thread === null || thread.orgId !== member.orgId || thread.userId !== member.userId) {
    throw appError("NOT_FOUND");
  }
  return thread;
}

/** Starts an empty conversation for the caller. */
export const createThread = mutation({
  args: {},
  returns: v.id("aiThreads"),
  handler: async (ctx) => {
    const member = await requireAiAccess(ctx);
    const agentThreadId = await createAgentThread(ctx, components.agent, {
      userId: member.userId,
      title: NEW_TITLE,
    });
    return await ctx.db.insert("aiThreads", {
      orgId: member.orgId,
      userId: member.userId,
      agentThreadId,
      title: NEW_TITLE,
    });
  },
});

/** The caller's conversations, newest first. */
export const listThreads = query({
  args: {},
  returns: v.array(schema.doc("aiThreads")),
  handler: async (ctx) => {
    const member = await requireAiAccess(ctx);
    return await ctx.db
      .query("aiThreads")
      .withIndex("by_orgId_and_userId", (q) =>
        q.eq("orgId", member.orgId).eq("userId", member.userId),
      )
      .order("desc")
      .take(MAX_THREADS);
  },
});

/** Messages of one of the caller's conversations, page by page (newest first). */
export const listMessages = query({
  args: { threadId: v.id("aiThreads"), paginationOpts: paginationOptsValidator },
  returns: vPaginationResult(vMessageDoc),
  handler: async (ctx, args) => {
    const member = await requireAiAccess(ctx);
    const thread = await loadOwnThread(ctx, member, args.threadId);
    return await listAgentMessages(ctx, components.agent, {
      threadId: thread.agentThreadId,
      paginationOpts: args.paginationOpts,
      excludeToolMessages: true,
      // Pending replies show the "thinking" state; failed attempts (a model
      // that was rate limited before the fallback answered) are hidden.
      statuses: ["success", "pending"],
    });
  },
});

/** For actions: the thread, if it belongs to this member (ids come from guard.begin). */
export const ownThread = internalQuery({
  args: { threadId: v.id("aiThreads"), orgId: v.string(), userId: v.string() },
  returns: schema.doc("aiThreads"),
  handler: async (ctx, args) => await loadOwnThread(ctx, args, args.threadId),
});

/** Names a new conversation after its first message. */
export const nameThread = internalMutation({
  args: { threadId: v.id("aiThreads"), text: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get("aiThreads", args.threadId);
    if (thread === null || thread.title !== NEW_TITLE) return null;
    const oneLine = args.text.replace(/\s+/g, " ").trim();
    const title = oneLine.length > TITLE_LENGTH ? `${oneLine.slice(0, TITLE_LENGTH - 1)}…` : oneLine;
    await ctx.db.patch("aiThreads", thread._id, { title: title || NEW_TITLE });
    return null;
  },
});

export const vSendResult = v.union(
  v.object({ ok: v.literal(true) }),
  v.object({ ok: v.literal(false), reason: v.literal("MODEL_UNAVAILABLE") }),
);

/**
 * Sends a message and waits for the reply, which lands in the thread (clients
 * see it through listMessages). Uses one request of the org's daily allowance.
 */
export const sendMessage = action({
  args: { threadId: v.id("aiThreads"), text: v.string() },
  returns: vSendResult,
  handler: async (ctx, args): Promise<{ ok: true } | { ok: false; reason: "MODEL_UNAVAILABLE" }> => {
    const text = args.text.trim();
    if (text === "" || text.length > MAX_MESSAGE_LENGTH) {
      throw appError("INVALID_INPUT");
    }
    const member: MemberInfo = await ctx.runMutation(internal.ai.guard.begin, {});
    const thread: Doc<"aiThreads"> = await ctx.runQuery(internal.ai.chat.ownThread, {
      threadId: args.threadId,
      orgId: member.orgId,
      userId: member.userId,
    });
    await ctx.runMutation(internal.ai.chat.nameThread, { threadId: thread._id, text });

    // Save the question once, so a retry on the fallback model doesn't repeat it.
    const threadOpts = { threadId: thread.agentThreadId, userId: member.userId };
    const { messageId } = await saveAgentMessage(ctx, components.agent, {
      ...threadOpts,
      prompt: text,
    });
    const tools = { ...readTools(member), ...writeTools(member, thread._id) };
    const result = await withFallback((model) =>
      buildAgent(model, tools).generateText(ctx, threadOpts, {
        promptMessageId: messageId,
        maxRetries: MODEL_RETRIES,
      }),
    );
    return result.ok ? { ok: true } : result;
  },
});
