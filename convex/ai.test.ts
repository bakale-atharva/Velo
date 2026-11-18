/// <reference types="vite/client" />
import agentTest from "@convex-dev/agent/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// No network: OPENROUTER_API_KEY is unset in tests, so anything that would
// call a model reports MODEL_UNAVAILABLE instead. Tools and proposals are
// called directly, the way the agent calls them.

const modules = import.meta.glob("./**/*.ts");

const ORG_A = "org_a";
const ORG_B = "org_b";

const newTest = () => {
  const t = convexTest(schema, modules);
  agentTest.register(t);
  rateLimiterTest.register(t);
  return t;
};
type T = ReturnType<typeof newTest>;

function as(t: T, userId: string, orgId: string, role = "member") {
  return t.withIdentity({
    subject: userId,
    tokenIdentifier: `https://clerk.test|${userId}`,
    o: { id: orgId, rol: role, slg: orgId },
  });
}

let svixCounter = 0;
async function join(t: T, orgId: string, userId: string, role = "org:member") {
  svixCounter += 1;
  await t.mutation(internal.clerkSync.handleEvent, {
    svixId: `msg_ai_${svixCounter}`,
    type: "organizationMembership.created",
    data: { role, organization: { id: orgId }, public_user_data: { user_id: userId } },
  });
}

async function setPlan(t: T, orgId: string, planSlug: string) {
  await t.run(async (ctx) => {
    await ctx.db.insert("subscriptions", {
      orgId,
      clerkSubscriptionId: `sub_${orgId}`,
      planSlug,
      status: "active",
      updatedAt: 1,
    });
  });
}

async function setup(plan: string | null = "business") {
  const t = newTest();
  await join(t, ORG_A, "admin_a", "org:admin");
  await join(t, ORG_A, "member_a");
  await join(t, ORG_B, "admin_b", "org:admin");
  if (plan !== null) await setPlan(t, ORG_A, plan);
  await setPlan(t, ORG_B, "business");
  const adminA = as(t, "admin_a", ORG_A, "admin");
  const memberA = as(t, "member_a", ORG_A);
  const adminB = as(t, "admin_b", ORG_B, "admin");
  const eng = await adminA.mutation(api.teams.create, { name: "Eng", key: "ENG" });
  return { t, adminA, memberA, adminB, eng };
}

const callerA = { orgId: ORG_A, userId: "admin_a", role: "admin" };
const callerMember = { orgId: ORG_A, userId: "member_a", role: "member" };

describe("AI gating", () => {
  test("a free org can't use the assistant", async () => {
    const { adminA } = await setup(null);
    await expect(adminA.mutation(api.ai.chat.createThread, {})).rejects.toThrow(/FEATURE_NOT_IN_PLAN/);
    await expect(adminA.mutation(internal.ai.guard.begin, {})).rejects.toThrow(/FEATURE_NOT_IN_PLAN/);
    expect(await adminA.query(api.ai.guard.usage, {})).toEqual({ used: 0, limit: 0 });
  });

  test("the org's daily allowance runs out with LIMIT_REACHED", async () => {
    const { adminA, memberA } = await setup("pro");
    // Pro allows 100 requests a day, shared by the whole org.
    for (let i = 0; i < 100; i++) {
      await (i % 2 === 0 ? adminA : memberA).mutation(internal.ai.guard.begin, {});
    }
    expect(await adminA.query(api.ai.guard.usage, {})).toEqual({ used: 100, limit: 100 });
    await expect(memberA.mutation(internal.ai.guard.begin, {})).rejects.toThrow(/LIMIT_REACHED/);
  });

  test("background work skips orgs without the assistant", async () => {
    const { t } = await setup(null);
    expect(await t.mutation(internal.ai.guard.consumeForOrg, { orgId: ORG_A })).toBe(false);
    expect(await t.mutation(internal.ai.guard.consumeForOrg, { orgId: ORG_B })).toBe(true);
  });

  test("with no model available, sending reports MODEL_UNAVAILABLE", async () => {
    const { adminA } = await setup();
    const threadId = await adminA.mutation(api.ai.chat.createThread, {});
    expect(await adminA.action(api.ai.chat.sendMessage, { threadId, text: "What's open?" })).toEqual({
      ok: false,
      reason: "MODEL_UNAVAILABLE",
    });
    const [thread] = await adminA.query(api.ai.chat.listThreads, {});
    expect(thread!.title).toBe("What's open?");
  });
});

describe("threads", () => {
  test("only the owner can read or write a thread", async () => {
    const { adminA, memberA, adminB } = await setup();
    const threadId = await adminA.mutation(api.ai.chat.createThread, {});
    const page = { numItems: 10, cursor: null };
    await expect(memberA.query(api.ai.chat.listMessages, { threadId, paginationOpts: page })).rejects.toThrow(/NOT_FOUND/);
    await expect(adminB.query(api.ai.chat.listMessages, { threadId, paginationOpts: page })).rejects.toThrow(/NOT_FOUND/);
    await expect(memberA.action(api.ai.chat.sendMessage, { threadId, text: "hi" })).rejects.toThrow(/NOT_FOUND/);
    expect(await memberA.query(api.ai.chat.listThreads, {})).toEqual([]);
  });
});

describe("proposals", () => {
  test("a proposal is applied once, by its owner, with activities marked viaAssistant", async () => {
    const { t, adminA, memberA, eng } = await setup();
    const { issueId } = await adminA.mutation(api.issues.create, { teamId: eng, title: "Broken login" });
    const threadId = await adminA.mutation(api.ai.chat.createThread, {});
    const created = await t.mutation(internal.ai.proposals.create, {
      ...callerA,
      threadId,
      action: { kind: "setPriority", identifier: "eng-1", priority: 1 },
    });
    expect(created).toEqual({ ok: true, description: "ENG-1: set priority to Urgent" });
    const [proposal] = await adminA.query(api.ai.proposals.listForThread, { threadId });

    await expect(memberA.mutation(api.ai.proposals.apply, { proposalId: proposal!._id })).rejects.toThrow(/NOT_FOUND/);
    expect(await adminA.mutation(api.ai.proposals.apply, { proposalId: proposal!._id })).toEqual(["ENG-1"]);
    await expect(adminA.mutation(api.ai.proposals.apply, { proposalId: proposal!._id })).rejects.toThrow(/INVALID_INPUT/);

    expect((await adminA.query(api.issues.get, { identifier: "ENG-1" })).priority).toBe(1);
    const activities = await t.run((ctx) =>
      ctx.db.query("activities").withIndex("by_issueId", (q) => q.eq("issueId", issueId)).take(10),
    );
    const priorityChange = activities.find((a) => a.type === "priority");
    expect(priorityChange?.viaAssistant).toBe(true);
  });

  test("proposals are checked against the caller's access", async () => {
    const { t, adminA, adminB } = await setup();
    const secret = await adminA.mutation(api.teams.create, { name: "Secret", key: "SEC", isPrivate: true });
    await adminA.mutation(api.issues.create, { teamId: secret, title: "Hidden" });
    const threadId = await adminA.mutation(api.ai.chat.createThread, {});
    // member_a isn't in SEC, and can't propose into someone else's thread.
    expect(
      await t.mutation(internal.ai.proposals.create, {
        ...callerMember,
        threadId,
        action: { kind: "addComment", identifier: "SEC-1", body: "hi" },
      }),
    ).toEqual({ ok: false, error: "NOT_FOUND" });
    const threadB = await adminB.mutation(api.ai.chat.createThread, {});
    expect(
      await t.mutation(internal.ai.proposals.create, {
        ...callerA,
        threadId: threadB,
        action: { kind: "createIssue", teamKey: "ENG", title: "x", description: "", priority: 0, assigneeId: null },
      }),
    ).toEqual({ ok: false, error: "NOT_FOUND" });
    // Assignees must be members of the org.
    expect(
      await t.mutation(internal.ai.proposals.create, {
        ...callerA,
        threadId,
        action: { kind: "createIssue", teamKey: "ENG", title: "x", description: "", priority: 0, assigneeId: "admin_b" },
      }),
    ).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("a dismissed proposal can't be applied", async () => {
    const { t, adminA, eng } = await setup();
    await adminA.mutation(api.issues.create, { teamId: eng, title: "A" });
    const threadId = await adminA.mutation(api.ai.chat.createThread, {});
    await t.mutation(internal.ai.proposals.create, {
      ...callerA,
      threadId,
      action: { kind: "assignIssue", identifier: "ENG-1", assigneeId: "member_a" },
    });
    const [proposal] = await adminA.query(api.ai.proposals.listForThread, { threadId });
    await adminA.mutation(api.ai.proposals.reject, { proposalId: proposal!._id });
    await expect(adminA.mutation(api.ai.proposals.apply, { proposalId: proposal!._id })).rejects.toThrow(/INVALID_INPUT/);
    expect((await adminA.query(api.issues.get, { identifier: "ENG-1" })).assigneeId).toBeNull();
  });
});

describe("assistant tools", () => {
  test("tools never return another org's issues or private-team issues", async () => {
    const { t, adminA, adminB, eng } = await setup();
    const secret = await adminA.mutation(api.teams.create, { name: "Secret", key: "SEC", isPrivate: true });
    await adminA.mutation(api.issues.create, { teamId: eng, title: "Payment fails on retry" });
    await adminA.mutation(api.issues.create, { teamId: secret, title: "Payment secret plan" });
    const engB = await adminB.mutation(api.teams.create, { name: "Eng", key: "ENG" });
    await adminB.mutation(api.issues.create, { teamId: engB, title: "Payment in org B" });

    const titles = async (caller: typeof callerA) =>
      (await t.query(internal.ai.data.searchIssues, { ...caller, query: "payment" })).map((i) => i.title).sort();
    expect(await titles(callerA)).toEqual(["Payment fails on retry", "Payment secret plan"]);
    expect(await titles(callerMember)).toEqual(["Payment fails on retry"]);

    expect(await t.query(internal.ai.data.getIssue, { ...callerMember, identifier: "SEC-1" })).toBeNull();
    expect((await t.query(internal.ai.data.getIssue, { ...callerA, identifier: "sec-1" }))?.issue.title).toBe(
      "Payment secret plan",
    );
    expect((await t.query(internal.ai.data.listTeams, callerMember)).map((x) => x.key)).toEqual(["ENG"]);
    expect(await t.query(internal.ai.data.listCycles, { ...callerMember, teamKey: "SEC" })).toEqual([]);
  });
});
