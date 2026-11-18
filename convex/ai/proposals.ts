import { ConvexError, v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { logActivity } from "../lib/activity";
import type { MemberInfo } from "../lib/auth";
import { appError } from "../lib/errors";
import { cleanText } from "../lib/input";
import { createIssue, updateIssue } from "../lib/issueOps";
import { requireTeamAccess } from "../lib/teamAccess";
import schema, { proposedAction } from "../schema";
import { vCaller } from "./data";
import { requireAiAccess } from "./guard";

// The assistant never writes issues itself. Its write tools only record a
// proposal; the member who asked applies it (once) or dismisses it, and
// applying runs the same issue logic as the app, marked `viaAssistant`.

export type ProposedAction = Infer<typeof proposedAction>;

const MAX_COMMENT = 20_000;
const MAX_PROPOSALS = 100;
const PRIORITY = ["No priority", "Urgent", "High", "Medium", "Low"];

type DbCtx = QueryCtx | MutationCtx;

async function issueByIdentifier(ctx: DbCtx, member: MemberInfo, identifier: string) {
  const issue = await ctx.db
    .query("issues")
    .withIndex("by_orgId_and_identifier", (q) =>
      q.eq("orgId", member.orgId).eq("identifier", identifier.trim().toUpperCase()),
    )
    .unique();
  if (issue === null || issue.archivedAt !== null) throw appError("NOT_FOUND");
  const team = await requireTeamAccess(ctx, member, issue.teamId);
  return { issue, team };
}

async function teamByKey(ctx: DbCtx, member: MemberInfo, key: string) {
  const team = await ctx.db
    .query("teams")
    .withIndex("by_orgId_and_key", (q) => q.eq("orgId", member.orgId).eq("key", key.trim().toUpperCase()))
    .unique();
  if (team === null || team.archivedAt !== null) throw appError("NOT_FOUND");
  return await requireTeamAccess(ctx, member, team._id);
}

async function assertMember(ctx: DbCtx, orgId: string, userId: string | null) {
  if (userId === null) return;
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_orgId_and_userId", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .unique();
  if (membership === null) throw appError("INVALID_INPUT");
}

async function stateByName(ctx: DbCtx, team: Doc<"teams">, name: string) {
  const states = await ctx.db
    .query("workflowStates")
    .withIndex("by_teamId_and_position", (q) => q.eq("teamId", team._id))
    .take(50);
  const state = states.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
  if (state === undefined) throw appError("INVALID_INPUT");
  return state;
}

async function personName(ctx: DbCtx, userId: string | null) {
  if (userId === null) return "nobody";
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", userId))
    .unique();
  return user?.name ?? user?.email ?? "a member";
}

/**
 * Checks an action against the member's access and returns it in plain words.
 * Throws the same errors the issue mutations would.
 */
async function check(ctx: DbCtx, member: MemberInfo, action: ProposedAction): Promise<string> {
  switch (action.kind) {
    case "createIssue": {
      const team = await teamByKey(ctx, member, action.teamKey);
      await assertMember(ctx, member.orgId, action.assigneeId);
      const who = action.assigneeId === null ? "" : `, assigned to ${await personName(ctx, action.assigneeId)}`;
      return `Create “${action.title}” in ${team.key} (${PRIORITY[action.priority] ?? "No priority"}${who})`;
    }
    case "updateIssue": {
      const { issue, team } = await issueByIdentifier(ctx, member, action.identifier);
      const parts: string[] = [];
      if (action.title !== undefined) parts.push(`rename to “${action.title}”`);
      if (action.description !== undefined) parts.push("rewrite the description");
      if (action.stateName !== undefined) parts.push(`move to ${(await stateByName(ctx, team, action.stateName)).name}`);
      if (parts.length === 0) throw appError("INVALID_INPUT");
      return `${issue.identifier}: ${parts.join(", ")}`;
    }
    case "assignIssue": {
      const { issue } = await issueByIdentifier(ctx, member, action.identifier);
      await assertMember(ctx, member.orgId, action.assigneeId);
      return action.assigneeId === null
        ? `${issue.identifier}: unassign`
        : `${issue.identifier}: assign to ${await personName(ctx, action.assigneeId)}`;
    }
    case "setPriority": {
      const { issue } = await issueByIdentifier(ctx, member, action.identifier);
      if (!Number.isInteger(action.priority) || action.priority < 0 || action.priority > 4) {
        throw appError("INVALID_INPUT");
      }
      return `${issue.identifier}: set priority to ${PRIORITY[action.priority]}`;
    }
    case "addComment": {
      const { issue } = await issueByIdentifier(ctx, member, action.identifier);
      if (action.body.trim() === "") throw appError("INVALID_INPUT");
      return `${issue.identifier}: comment “${action.body.slice(0, 80)}${action.body.length > 80 ? "…" : ""}”`;
    }
  }
}

/** Runs one checked action; returns the identifier it touched. */
async function run(ctx: MutationCtx, member: MemberInfo, action: ProposedAction): Promise<string> {
  const options = { viaAssistant: true };
  switch (action.kind) {
    case "createIssue": {
      const team = await teamByKey(ctx, member, action.teamKey);
      const issue = await createIssue(
        ctx,
        member,
        team,
        {
          title: action.title,
          description: action.description,
          priority: action.priority,
          assigneeId: action.assigneeId,
        },
        options,
      );
      return issue.identifier;
    }
    case "updateIssue": {
      const { issue, team } = await issueByIdentifier(ctx, member, action.identifier);
      const stateId =
        action.stateName === undefined ? undefined : (await stateByName(ctx, team, action.stateName))._id;
      await updateIssue(
        ctx,
        member,
        team,
        issue,
        { title: action.title, description: action.description, stateId },
        options,
      );
      return issue.identifier;
    }
    case "assignIssue": {
      const { issue, team } = await issueByIdentifier(ctx, member, action.identifier);
      await updateIssue(ctx, member, team, issue, { assigneeId: action.assigneeId }, options);
      return issue.identifier;
    }
    case "setPriority": {
      const { issue, team } = await issueByIdentifier(ctx, member, action.identifier);
      await updateIssue(ctx, member, team, issue, { priority: action.priority }, options);
      return issue.identifier;
    }
    case "addComment": {
      const { issue } = await issueByIdentifier(ctx, member, action.identifier);
      await ctx.db.insert("comments", {
        orgId: member.orgId,
        issueId: issue._id,
        authorId: member.userId,
        body: cleanText(action.body, MAX_COMMENT),
        editedAt: null,
      });
      await logActivity(ctx, {
        orgId: member.orgId,
        issueId: issue._id,
        actorId: member.userId,
        type: "comment",
        to: "created",
        viaAssistant: true,
      });
      return issue.identifier;
    }
  }
}

/**
 * Records a proposal from a write tool. Returns its plain-words description,
 * or the reason it was refused so the model can correct itself.
 */
export const create = internalMutation({
  args: { ...vCaller, threadId: v.id("aiThreads"), action: proposedAction },
  returns: v.union(
    v.object({ ok: v.literal(true), description: v.string() }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const member: MemberInfo = { orgId: args.orgId, userId: args.userId, role: args.role };
    const thread = await ctx.db.get("aiThreads", args.threadId);
    if (thread === null || thread.orgId !== member.orgId || thread.userId !== member.userId) {
      return { ok: false as const, error: "NOT_FOUND" };
    }
    let description: string;
    try {
      description = await check(ctx, member, args.action);
    } catch (error) {
      const code = error instanceof ConvexError ? String(error.data) : "INVALID_INPUT";
      return { ok: false as const, error: code };
    }
    await ctx.db.insert("aiProposals", {
      orgId: member.orgId,
      userId: member.userId,
      threadId: thread._id,
      actions: [args.action],
      descriptions: [description],
      status: "pending",
      appliedIdentifiers: [],
    });
    return { ok: true as const, description };
  },
});

async function loadOwnProposal(ctx: MutationCtx, member: MemberInfo, proposalId: Doc<"aiProposals">["_id"]) {
  const proposal = await ctx.db.get("aiProposals", proposalId);
  if (proposal === null || proposal.orgId !== member.orgId || proposal.userId !== member.userId) {
    throw appError("NOT_FOUND");
  }
  if (proposal.status !== "pending") throw appError("INVALID_INPUT");
  return proposal;
}

/** Applies a pending proposal of the caller's, once. All actions or none. */
export const apply = mutation({
  args: { proposalId: v.id("aiProposals") },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const member = await requireAiAccess(ctx);
    const proposal = await loadOwnProposal(ctx, member, args.proposalId);
    const identifiers: string[] = [];
    for (const action of proposal.actions) {
      identifiers.push(await run(ctx, member, action));
    }
    await ctx.db.patch("aiProposals", proposal._id, {
      status: "applied",
      appliedIdentifiers: identifiers,
    });
    return identifiers;
  },
});

/** Dismisses a pending proposal of the caller's. */
export const reject = mutation({
  args: { proposalId: v.id("aiProposals") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireAiAccess(ctx);
    const proposal = await loadOwnProposal(ctx, member, args.proposalId);
    await ctx.db.patch("aiProposals", proposal._id, { status: "rejected" });
    return null;
  },
});

/** Proposals in one of the caller's threads, oldest first, for the cards. */
export const listForThread = query({
  args: { threadId: v.id("aiThreads") },
  returns: v.array(schema.doc("aiProposals")),
  handler: async (ctx, args) => {
    const member = await requireAiAccess(ctx);
    const thread = await ctx.db.get("aiThreads", args.threadId);
    if (thread === null || thread.orgId !== member.orgId || thread.userId !== member.userId) {
      throw appError("NOT_FOUND");
    }
    return await ctx.db
      .query("aiProposals")
      .withIndex("by_threadId", (q) => q.eq("threadId", thread._id))
      .take(MAX_PROPOSALS);
  },
});
