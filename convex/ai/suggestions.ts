import { generateText, Output } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "../_generated/server";
import type { MemberInfo } from "../lib/auth";
import { appError } from "../lib/errors";
import { loadIssue, updateIssue } from "../lib/issueOps";
import { canAccessTeam, filterVisibleIssues } from "../lib/teamAccess";
import schema from "../schema";
import { withFallback } from "./agent";
import { vCaller } from "./data";
import { requireAiAccess } from "./guard";

// Summaries, label and priority suggestions, duplicate lists and reports.
// Generation runs in actions; reads and writes go through internal functions
// that apply the same org and private-team checks as the app.

const PRIORITY = ["No priority", "Urgent", "High", "Medium", "Low"];
const MAX_DESCRIPTION = 4000;
const MAX_REPORT_ISSUES = 150;
const DAY = 86_400_000;

const vKind = v.union(v.literal("summary"), v.literal("labels"), v.literal("priority"), v.literal("duplicate"));
const vPayload = schema.tables.aiSuggestions.validator.fields.payload;
const vUnavailable = v.object({ ok: v.literal(false), reason: v.literal("MODEL_UNAVAILABLE") });

type Unavailable = { ok: false; reason: "MODEL_UNAVAILABLE" };

/** The issue as text for a prompt, plus the org's labels to choose from. */
async function issueContext(ctx: QueryCtx, issue: Doc<"issues">) {
  const labels = await ctx.db
    .query("labels")
    .withIndex("by_orgId_and_name", (q) => q.eq("orgId", issue.orgId))
    .take(100);
  return {
    orgId: issue.orgId,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description.slice(0, MAX_DESCRIPTION),
    priority: issue.priority,
    labelIds: issue.labelIds,
    labels: labels.map((l) => ({ id: l._id, name: l.name })),
  };
}

const vContext = v.object({
  orgId: v.string(),
  identifier: v.string(),
  title: v.string(),
  description: v.string(),
  priority: v.number(),
  labelIds: v.array(v.id("labels")),
  labels: v.array(v.object({ id: v.id("labels"), name: v.string() })),
});

/** An issue the caller may see, as prompt context. */
export const contextForCaller = internalQuery({
  args: { ...vCaller, issueId: v.id("issues") },
  returns: vContext,
  handler: async (ctx, args) => {
    const { issue } = await loadIssue(ctx, args, args.issueId);
    return await issueContext(ctx, issue);
  },
});

/** An issue as prompt context, for background work; null if it's gone. */
export const contextForIssue = internalQuery({
  args: { issueId: v.id("issues") },
  returns: v.union(vContext, v.null()),
  handler: async (ctx, args) => {
    const issue = await ctx.db.get("issues", args.issueId);
    return issue === null || issue.archivedAt !== null ? null : await issueContext(ctx, issue);
  },
});

export const store = internalMutation({
  args: { orgId: v.string(), issueId: v.id("issues"), kind: vKind, payload: vPayload },
  returns: v.null(),
  handler: async (ctx, args) => {
    // One live suggestion per kind: a newer one replaces a pending older one.
    const existing = await ctx.db
      .query("aiSuggestions")
      .withIndex("by_issueId", (q) => q.eq("issueId", args.issueId))
      .take(20);
    for (const old of existing) {
      if (old.kind === args.kind && old.status === "pending") {
        await ctx.db.delete("aiSuggestions", old._id);
      }
    }
    await ctx.db.insert("aiSuggestions", { ...args, status: "pending" });
    return null;
  },
});

function issueText(issue: { identifier: string; title: string; description: string }) {
  return `${issue.identifier}: ${issue.title}\n\n${issue.description || "(no description)"}`;
}

/** Summarizes an issue the caller can see (uses one request of the allowance). */
export const summarizeIssue = action({
  args: { issueId: v.id("issues") },
  returns: v.union(v.object({ ok: v.literal(true), summary: v.string() }), vUnavailable),
  handler: async (ctx, args): Promise<{ ok: true; summary: string } | Unavailable> => {
    const member: MemberInfo = await ctx.runMutation(internal.ai.guard.begin, {});
    const issue = await ctx.runQuery(internal.ai.suggestions.contextForCaller, { ...member, issueId: args.issueId });
    const result = await withFallback(async (model) =>
      (
        await generateText({
          model,
          system: "Summarize this issue for a teammate in 2–4 short sentences: what is wrong or wanted, and what is decided or still open. Plain text.",
          prompt: issueText(issue),
        })
      ).text.trim(),
    );
    if (!result.ok) return result;
    await ctx.runMutation(internal.ai.suggestions.store, {
      orgId: member.orgId,
      issueId: args.issueId,
      kind: "summary",
      payload: { text: result.value },
    });
    return { ok: true, summary: result.value };
  },
});

/**
 * Scheduled after an issue is created in an org with the assistant: suggests
 * labels (only existing ones) and a priority. Skips quietly when the org is
 * out of requests or the models are down.
 */
export const suggestForIssue = internalAction({
  args: { issueId: v.id("issues") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const issue = await ctx.runQuery(internal.ai.suggestions.contextForIssue, args);
    if (issue === null) return null;
    if (!(await ctx.runMutation(internal.ai.guard.consumeForOrg, { orgId: issue.orgId }))) return null;
    const names = issue.labels.map((l) => l.name);
    const result = await withFallback(async (model) => {
      const { output } = await generateText({
        model,
        output: Output.object({
          schema: z.object({
            labels: z.array(z.string()).describe("Names from the allowed list only"),
            priority: z.number().int().min(0).max(4).describe("0 none, 1 urgent, 2 high, 3 medium, 4 low"),
          }),
        }),
        system: `Triage an issue. Pick fitting labels only from: ${names.join(", ") || "(none)"}. Pick a priority. Urgent only for outages, data loss or security.`,
        prompt: issueText(issue),
      });
      return output;
    });
    if (!result.ok) return null;
    const byName = new Map(issue.labels.map((l) => [l.name.toLowerCase(), l.id]));
    const labelIds = [
      ...new Set(
        result.value.labels
          .map((name) => byName.get(name.trim().toLowerCase()))
          .filter((id): id is Id<"labels"> => id !== undefined && !issue.labelIds.includes(id)),
      ),
    ];
    if (labelIds.length > 0) {
      await ctx.runMutation(internal.ai.suggestions.store, {
        orgId: issue.orgId,
        issueId: args.issueId,
        kind: "labels",
        payload: { labelIds },
      });
    }
    if (result.value.priority !== 0 && result.value.priority !== issue.priority) {
      await ctx.runMutation(internal.ai.suggestions.store, {
        orgId: issue.orgId,
        issueId: args.issueId,
        kind: "priority",
        payload: { priority: result.value.priority },
      });
    }
    return null;
  },
});

/** Facts for a report, as lines of text, scoped to what the caller can see. */
export const reportFacts = internalQuery({
  args: {
    ...vCaller,
    kind: v.union(v.literal("cycle"), v.literal("project"), v.literal("standup")),
    id: v.string(),
    now: v.number(),
  },
  returns: v.object({ heading: v.string(), lines: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const line = (i: Doc<"issues">) =>
      `- ${i.identifier} [${i.stateType}] ${i.title} (${PRIORITY[i.priority]}${i.estimate === null ? "" : `, ${i.estimate} pt`})`;
    if (args.kind === "cycle") {
      const cycleId = ctx.db.normalizeId("cycles", args.id);
      const cycle = cycleId === null ? null : await ctx.db.get("cycles", cycleId);
      if (cycle === null || cycle.orgId !== args.orgId) throw appError("NOT_FOUND");
      const team = await ctx.db.get("teams", cycle.teamId);
      if (team === null || !(await canAccessTeam(ctx, args, team))) throw appError("NOT_FOUND");
      const issues = await ctx.db
        .query("issues")
        .withIndex("by_cycleId", (q) => q.eq("cycleId", cycle._id))
        .take(MAX_REPORT_ISSUES);
      return {
        heading: `${team.name} ${cycle.name} (${new Date(cycle.startsAt).toDateString()} – ${new Date(cycle.endsAt - 1).toDateString()}, ${cycle.status})`,
        lines: issues.filter((i) => i.archivedAt === null).map(line),
      };
    }
    if (args.kind === "project") {
      const projectId = ctx.db.normalizeId("projects", args.id);
      const project = projectId === null ? null : await ctx.db.get("projects", projectId);
      if (project === null || project.orgId !== args.orgId) throw appError("NOT_FOUND");
      const issues = await ctx.db
        .query("issues")
        .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
        .take(MAX_REPORT_ISSUES);
      const visible = await filterVisibleIssues(ctx, args, issues.filter((i) => i.archivedAt === null));
      return {
        heading: `Project ${project.name} (${project.status}, ${project.completedIssueCount}/${project.issueCount} done${
          project.targetDate === null ? "" : `, target ${new Date(project.targetDate).toDateString()}`
        })`,
        lines: visible.map(line),
      };
    }
    // Standup: a team's work in progress and what finished in the last day.
    const teamId = ctx.db.normalizeId("teams", args.id);
    const team = teamId === null ? null : await ctx.db.get("teams", teamId);
    if (team === null || !(await canAccessTeam(ctx, args, team))) throw appError("NOT_FOUND");
    const states = await ctx.db
      .query("workflowStates")
      .withIndex("by_teamId_and_position", (q) => q.eq("teamId", team._id))
      .take(50);
    const lines: string[] = [];
    for (const state of states.filter((s) => s.type === "started" || s.type === "completed")) {
      const issues = await ctx.db
        .query("issues")
        .withIndex("by_teamId_and_archivedAt_and_stateId_and_rank", (q) =>
          q.eq("teamId", team._id).eq("archivedAt", null).eq("stateId", state._id),
        )
        .take(MAX_REPORT_ISSUES);
      for (const issue of issues) {
        if (state.type === "started" || (issue.completedAt !== null && issue.completedAt >= args.now - DAY)) {
          lines.push(line(issue));
        }
      }
    }
    return { heading: `${team.name} standup, ${new Date(args.now).toDateString()}`, lines };
  },
});

const REPORT_PROMPTS = {
  cycle: "Write a cycle report: what got done, what is in progress, what is at risk of slipping, and the scope by priority. Use short Markdown sections and bullet lists. Mention issue identifiers.",
  project: "Write a project status update: overall progress, recent and remaining work, risks and blockers. Short Markdown sections and bullet lists. Mention issue identifiers.",
  standup: "Write a standup digest: done in the last day, in progress now, and anything that looks stuck. Short Markdown bullet lists. Mention issue identifiers.",
} as const;

/** A Markdown report on a cycle, project or a team's day (one request). */
export const generateReport = action({
  args: { kind: v.union(v.literal("cycle"), v.literal("project"), v.literal("standup")), id: v.string() },
  returns: v.union(v.object({ ok: v.literal(true), markdown: v.string() }), vUnavailable),
  handler: async (ctx, args): Promise<{ ok: true; markdown: string } | Unavailable> => {
    const member: MemberInfo = await ctx.runMutation(internal.ai.guard.begin, {});
    const facts = await ctx.runQuery(internal.ai.suggestions.reportFacts, {
      ...member,
      kind: args.kind,
      id: args.id,
      now: Date.now(),
    });
    const result = await withFallback(async (model) =>
      (
        await generateText({
          model,
          system: `${REPORT_PROMPTS[args.kind]} Use only the issues listed; if there are none, say so in one line.`,
          prompt: `${facts.heading}\n\n${facts.lines.join("\n") || "(no issues)"}`,
        })
      ).text.trim(),
    );
    return result.ok ? { ok: true, markdown: result.value } : result;
  },
});

/** Pending and accepted suggestions for an issue the caller can see. */
export const listForIssue = query({
  args: { issueId: v.id("issues") },
  returns: v.array(schema.doc("aiSuggestions")),
  handler: async (ctx, args) => {
    const member = await requireAiAccess(ctx);
    const { issue } = await loadIssue(ctx, member, args.issueId);
    const suggestions = await ctx.db
      .query("aiSuggestions")
      .withIndex("by_issueId", (q) => q.eq("issueId", issue._id))
      .take(20);
    return suggestions.filter((s) => s.status !== "dismissed");
  },
});

async function loadSuggestion(
  ctx: Parameters<typeof requireAiAccess>[0],
  member: MemberInfo,
  suggestionId: Id<"aiSuggestions">,
) {
  const suggestion = await ctx.db.get("aiSuggestions", suggestionId);
  if (suggestion === null || suggestion.orgId !== member.orgId) throw appError("NOT_FOUND");
  // Seeing the issue is the permission to act on its suggestions.
  await loadIssue(ctx, member, suggestion.issueId);
  if (suggestion.status !== "pending") throw appError("INVALID_INPUT");
  return suggestion;
}

/** Accepts a suggestion; labels and priority are applied to the issue. */
export const acceptSuggestion = mutation({
  args: { suggestionId: v.id("aiSuggestions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireAiAccess(ctx);
    const suggestion = await loadSuggestion(ctx, member, args.suggestionId);
    const { issue, team } = await loadIssue(ctx, member, suggestion.issueId);
    const options = { viaAssistant: true };
    if (suggestion.kind === "labels" && suggestion.payload.labelIds !== undefined) {
      await updateIssue(
        ctx,
        member,
        team,
        issue,
        { labelIds: [...new Set([...issue.labelIds, ...suggestion.payload.labelIds])] },
        options,
      );
    }
    if (suggestion.kind === "priority" && suggestion.payload.priority !== undefined) {
      await updateIssue(ctx, member, team, issue, { priority: suggestion.payload.priority }, options);
    }
    await ctx.db.patch("aiSuggestions", suggestion._id, { status: "accepted" });
    return null;
  },
});

export const dismissSuggestion = mutation({
  args: { suggestionId: v.id("aiSuggestions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireAiAccess(ctx);
    const suggestion = await loadSuggestion(ctx, member, args.suggestionId);
    await ctx.db.patch("aiSuggestions", suggestion._id, { status: "dismissed" });
    return null;
  },
});
