import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { hasFeature } from "../lib/entitlements";
import { aiConfigured, EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, openRouterKey } from "./models";

// Issue vectors for duplicate detection. Scheduled from lib/issueOps when an
// issue is created or its title or description changes, in orgs with the
// assistant. Embeddings don't use the daily allowance (they're background
// work on a free model), but issue text goes to the provider; see
// docs/ai-models.md.

const MAX_INPUT = 6000;

/** The text to embed, or null when the issue is gone or the org lacks the assistant. */
export const textForIssue = internalQuery({
  args: { issueId: v.id("issues") },
  returns: v.union(v.null(), v.object({ orgId: v.string(), text: v.string() })),
  handler: async (ctx, args) => {
    const issue = await ctx.db.get("issues", args.issueId);
    if (issue === null || issue.archivedAt !== null) return null;
    if (!(await hasFeature(ctx, issue.orgId, "ai_assistant"))) return null;
    return { orgId: issue.orgId, text: `${issue.title}\n\n${issue.description}`.slice(0, MAX_INPUT) };
  },
});

export const save = internalMutation({
  args: { orgId: v.string(), issueId: v.id("issues"), embedding: v.array(v.float64()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("issueEmbeddings")
      .withIndex("by_issueId", (q) => q.eq("issueId", args.issueId))
      .unique();
    if (existing === null) {
      await ctx.db.insert("issueEmbeddings", args);
    } else {
      await ctx.db.patch("issueEmbeddings", existing._id, { embedding: args.embedding });
    }
    return null;
  },
});

/** Calls OpenRouter's embeddings endpoint; null on any failure. */
export async function embed(text: string): Promise<number[] | null> {
  if (!aiConfigured()) return null;
  try {
    const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
    });
    if (!response.ok) {
      console.warn("Embedding request failed", response.status);
      return null;
    }
    const body: unknown = await response.json();
    const vector = (body as { data?: { embedding?: unknown }[] }).data?.[0]?.embedding;
    if (!Array.isArray(vector) || !vector.every((x) => typeof x === "number")) return null;
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      // The model changed size; the index can't take it (docs/ai-models.md).
      console.error(`Embedding has ${vector.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`);
      return null;
    }
    return vector as number[];
  } catch (error) {
    console.warn("Embedding request failed", error instanceof Error ? error.message : error);
    return null;
  }
}

export const embedIssue = internalAction({
  args: { issueId: v.id("issues") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const source = await ctx.runQuery(internal.ai.embeddings.textForIssue, args);
    if (source === null) return null;
    const embedding = await embed(source.text);
    if (embedding === null) return null;
    await ctx.runMutation(internal.ai.embeddings.save, {
      orgId: source.orgId,
      issueId: args.issueId,
      embedding,
    });
    return null;
  },
});
