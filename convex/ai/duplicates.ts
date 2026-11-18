import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, internalQuery } from "../_generated/server";
import type { MemberInfo } from "../lib/auth";
import { loadIssue } from "../lib/issueOps";
import { filterVisibleIssues } from "../lib/teamAccess";
import { vCaller } from "./data";
import { embed } from "./embeddings";

// "Possible duplicates" for an issue: nearest issues by embedding within the
// caller's org, at least MIN_SCORE similar, that the caller can see.

const LIMIT = 6;
const MIN_SCORE = 0.8;

const vDuplicate = v.object({
  issueId: v.id("issues"),
  identifier: v.string(),
  title: v.string(),
  stateType: v.string(),
  score: v.number(),
});

/** The issue's stored vector and text, once the caller is known to see it. */
export const source = internalQuery({
  args: { ...vCaller, issueId: v.id("issues") },
  returns: v.object({
    embedding: v.union(v.array(v.float64()), v.null()),
    text: v.string(),
  }),
  handler: async (ctx, args) => {
    const { issue } = await loadIssue(ctx, args, args.issueId);
    const row = await ctx.db
      .query("issueEmbeddings")
      .withIndex("by_issueId", (q) => q.eq("issueId", issue._id))
      .unique();
    return { embedding: row?.embedding ?? null, text: `${issue.title}\n\n${issue.description}` };
  },
});

/**
 * Turns vector hits into issues in search order: drops the issue itself,
 * archived ones and private-team issues the caller can't see.
 */
export const hydrate = internalQuery({
  args: {
    ...vCaller,
    issueId: v.id("issues"),
    hits: v.array(v.object({ embeddingId: v.id("issueEmbeddings"), score: v.number() })),
  },
  returns: v.array(vDuplicate),
  handler: async (ctx, args) => {
    const scored: { issueId: Id<"issues">; score: number }[] = [];
    for (const hit of args.hits) {
      const row = await ctx.db.get("issueEmbeddings", hit.embeddingId);
      if (row !== null && row.orgId === args.orgId && row.issueId !== args.issueId) {
        scored.push({ issueId: row.issueId, score: hit.score });
      }
    }
    const issues: Doc<"issues">[] = [];
    for (const { issueId } of scored) {
      const issue = await ctx.db.get("issues", issueId);
      if (issue !== null && issue.archivedAt === null) issues.push(issue);
    }
    const visible = new Set((await filterVisibleIssues(ctx, args, issues)).map((i) => i._id));
    return scored.flatMap(({ issueId, score }) => {
      const issue = issues.find((i) => i._id === issueId);
      return issue !== undefined && visible.has(issueId)
        ? [{ issueId, identifier: issue.identifier, title: issue.title, stateType: issue.stateType, score }]
        : [];
    });
  },
});

/**
 * Finds likely duplicates of an issue (one request of the allowance) and
 * keeps them as a `duplicate` suggestion on the issue.
 */
export const findDuplicates = action({
  args: { issueId: v.id("issues") },
  returns: v.union(
    v.object({ ok: v.literal(true), duplicates: v.array(vDuplicate) }),
    v.object({ ok: v.literal(false), reason: v.literal("MODEL_UNAVAILABLE") }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; duplicates: { issueId: Id<"issues">; identifier: string; title: string; stateType: string; score: number }[] }
    | { ok: false; reason: "MODEL_UNAVAILABLE" }
  > => {
    const member: MemberInfo = await ctx.runMutation(internal.ai.guard.begin, {});
    const caller = { orgId: member.orgId, userId: member.userId, role: member.role };
    const found = await ctx.runQuery(internal.ai.duplicates.source, { ...caller, issueId: args.issueId });
    let vector = found.embedding;
    if (vector === null) {
      // Not embedded yet (e.g. created before the assistant was on): do it now.
      vector = await embed(found.text);
      if (vector === null) return { ok: false, reason: "MODEL_UNAVAILABLE" };
      await ctx.runMutation(internal.ai.embeddings.save, {
        orgId: member.orgId,
        issueId: args.issueId,
        embedding: vector,
      });
    }
    const results = await ctx.vectorSearch("issueEmbeddings", "by_embedding", {
      vector,
      // One extra, since the issue itself is usually the top hit.
      limit: LIMIT + 1,
      filter: (q) => q.eq("orgId", member.orgId),
    });
    const hits = results
      .filter((r) => r._score >= MIN_SCORE)
      .map((r) => ({ embeddingId: r._id, score: r._score }));
    const duplicates = (
      await ctx.runQuery(internal.ai.duplicates.hydrate, { ...caller, issueId: args.issueId, hits })
    ).slice(0, LIMIT);
    await ctx.runMutation(internal.ai.suggestions.store, {
      orgId: member.orgId,
      issueId: args.issueId,
      kind: "duplicate",
      payload: { issueIds: duplicates.map((d) => d.issueId), scores: duplicates.map((d) => d.score) },
    });
    return { ok: true, duplicates };
  },
});
