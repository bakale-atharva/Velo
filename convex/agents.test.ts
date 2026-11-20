/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { hashKey } from "./agentKeys";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ORG_A = "org_a";
const ORG_B = "org_b";

const newTest = () => convexTest(schema, modules);
type T = ReturnType<typeof newTest>;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** A person (Clerk token) or an agent (Velo token); same claim shape. */
function as(t: T, userId: string, orgId: string, role = "member") {
  const issuer = userId.startsWith("agent_") ? "https://velo.test/agents" : "https://clerk.test";
  return t.withIdentity({
    subject: userId,
    tokenIdentifier: `${issuer}|${userId}`,
    o: { id: orgId, rol: role, slg: orgId },
  });
}

let svixCounter = 0;
async function join(t: T, orgId: string, userId: string, role = "org:member") {
  svixCounter += 1;
  await t.mutation(internal.clerkSync.handleEvent, {
    svixId: `msg_ag_${svixCounter}`,
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

async function setup() {
  const t = newTest();
  await join(t, ORG_A, "admin_a", "org:admin");
  await join(t, ORG_A, "member_a");
  await join(t, ORG_B, "admin_b", "org:admin");
  const adminA = as(t, "admin_a", ORG_A, "admin");
  const memberA = as(t, "member_a", ORG_A);
  const adminB = as(t, "admin_b", ORG_B, "admin");
  const eng = await adminA.mutation(api.teams.create, { name: "Eng", key: "ENG" });
  return { t, adminA, memberA, adminB, eng };
}

/** Creates an agent as `by` and returns its id, user id and a client for it. */
async function makeAgent(
  t: T,
  by: ReturnType<typeof as>,
  args: Partial<{ name: string; role: "member" | "admin"; canManageAgents: boolean }> = {},
) {
  const agentId = await by.mutation(api.agents.create, {
    name: args.name ?? "Builder",
    role: args.role,
    canManageAgents: args.canManageAgents,
  });
  const agent = await t.run(async (ctx) => (await ctx.db.get("agents", agentId))!);
  const membership = await t.run(async (ctx) =>
    ctx.db
      .query("memberships")
      .withIndex("by_orgId_and_userId", (q) =>
        q.eq("orgId", agent.orgId).eq("userId", agent.userId),
      )
      .unique(),
  );
  return {
    agentId,
    userId: agent.userId,
    client: as(t, agent.userId, agent.orgId, membership!.role),
  };
}

describe("agent members", () => {
  test("an admin creates an agent that is a member with a mirror profile", async () => {
    const { t, adminA } = await setup();
    const agentId = await adminA.mutation(api.agents.create, {
      name: "Reviewer",
      imageUrl: "https://example.com/r.png",
      description: "Reviews pull requests",
      model: "claude-opus-5-5",
      runtime: "claude",
      metadata: { repo: "velo" },
    });
    const view = await adminA.query(api.agents.get, { agentId });
    expect(view).toMatchObject({
      name: "Reviewer",
      imageUrl: "https://example.com/r.png",
      model: "claude-opus-5-5",
      runtime: "claude",
      metadata: { repo: "velo" },
      role: "member",
      parentAgentId: null,
      canManage: true,
    });
    expect(view.userId).toMatch(/^agent_[a-z0-9]{24}$/);
    const members = await adminA.query(api.members.list, {});
    expect(members.find((m) => m.userId === view.userId)).toMatchObject({ name: "Reviewer" });
    const user = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", view.userId))
        .unique(),
    );
    expect(user?.isAgent).toBe(true);
  });

  test("rejects bad input", async () => {
    const { adminA } = await setup();
    await expect(
      adminA.mutation(api.agents.create, { name: "A", imageUrl: "http://example.com/a.png" }),
    ).rejects.toThrow(/INVALID_INPUT/);
    await expect(
      adminA.mutation(api.agents.create, { name: "A", metadata: { "bad key": "x" } }),
    ).rejects.toThrow(/INVALID_INPUT/);
    await expect(adminA.mutation(api.agents.create, { name: "  " })).rejects.toThrow(
      /INVALID_INPUT/,
    );
  });

  test("members without agents.manage can't create agents", async () => {
    const { memberA } = await setup();
    await expect(memberA.mutation(api.agents.create, { name: "A" })).rejects.toThrow(
      /FORBIDDEN/,
    );
  });

  test("agents don't use seats: a full Free org can still add agents", async () => {
    const { t, adminA } = await setup();
    await join(t, ORG_A, "member_a2");
    expect(await adminA.query(api.billing.seats, {})).toEqual({ used: 3, limit: 3 });
    const { client } = await makeAgent(t, adminA);
    await makeAgent(t, adminA, { name: "Second" });
    expect(await adminA.query(api.billing.seats, {})).toEqual({ used: 3, limit: 3 });
    // The agent is let in even though every seat is taken.
    expect((await client.query(api.members.me, {})).role).toBe("member");
  });

  test("an agent without canManageAgents can't create subagents", async () => {
    const { t, adminA } = await setup();
    const { client } = await makeAgent(t, adminA);
    await expect(client.mutation(api.agents.create, { name: "Sub" })).rejects.toThrow(
      /FORBIDDEN/,
    );
  });

  test("subagents go below their creator and can't outrank it", async () => {
    const { t, adminA } = await setup();
    const lead = await makeAgent(t, adminA, { name: "Lead", canManageAgents: true });
    await expect(
      lead.client.mutation(api.agents.create, { name: "Boss", role: "admin" }),
    ).rejects.toThrow(/FORBIDDEN/);
    const subId = await lead.client.mutation(api.agents.create, { name: "Sub" });
    const sub = await adminA.query(api.agents.get, { agentId: subId });
    expect(sub.parentAgentId).toBe(lead.agentId);
    expect(sub.createdBy).toBe(lead.userId);
    // The lead manages its subagent but not itself.
    expect((await lead.client.query(api.agents.get, { agentId: subId })).canManage).toBe(true);
    expect((await lead.client.query(api.agents.get, { agentId: lead.agentId })).canManage).toBe(
      false,
    );
    await expect(
      lead.client.mutation(api.agents.update, { agentId: lead.agentId, role: "admin" }),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  test("a member with agents.manage can't create or manage admin agents", async () => {
    const { t, adminA, memberA } = await setup();
    await setPlan(t, ORG_A, "business");
    const roleId = await adminA.mutation(api.roles.create, {
      name: "Agent wrangler",
      permissions: ["agents.manage"],
    });
    await adminA.mutation(api.roles.assign, { userId: "member_a", roleId });
    await memberA.mutation(api.agents.create, { name: "Helper" });
    await expect(
      memberA.mutation(api.agents.create, { name: "Root", role: "admin" }),
    ).rejects.toThrow(/FORBIDDEN/);
    const admin = await makeAgent(t, adminA, { name: "Ops", role: "admin" });
    await expect(
      memberA.action(api.agentKeys.create, { agentId: admin.agentId, label: "steal" }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      memberA.mutation(api.agents.remove, { agentId: admin.agentId }),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  test("an agent can't manage agents outside its subtree", async () => {
    const { t, adminA } = await setup();
    const lead = await makeAgent(t, adminA, { name: "Lead", canManageAgents: true });
    const other = await makeAgent(t, adminA, { name: "Other" });
    await expect(
      lead.client.mutation(api.agents.update, { agentId: other.agentId, name: "Mine" }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(lead.client.mutation(api.agents.disable, { agentId: other.agentId })).rejects.toThrow(
      /FORBIDDEN/,
    );
  });

  test("an agent edits its own profile", async () => {
    const { t, adminA } = await setup();
    const { agentId, client } = await makeAgent(t, adminA);
    await client.mutation(api.agents.update, {
      agentId,
      name: "Builder 2",
      imageUrl: "https://example.com/b.png",
      metadata: { mood: "focused" },
    });
    expect(await adminA.query(api.agents.get, { agentId })).toMatchObject({
      name: "Builder 2",
      imageUrl: "https://example.com/b.png",
      metadata: { mood: "focused" },
    });
    await expect(
      client.mutation(api.agents.update, { agentId, canManageAgents: true }),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  test("a disabled agent can no longer manage agents", async () => {
    const { t, adminA } = await setup();
    const lead = await makeAgent(t, adminA, { name: "Lead", canManageAgents: true });
    await adminA.mutation(api.agents.disable, { agentId: lead.agentId });
    await expect(lead.client.mutation(api.agents.create, { name: "Sub" })).rejects.toThrow(
      /FORBIDDEN/,
    );
    await adminA.mutation(api.agents.enable, { agentId: lead.agentId });
    await lead.client.mutation(api.agents.create, { name: "Sub" });
  });

  test("another org's agent is not found", async () => {
    const { t, adminA, adminB } = await setup();
    const { agentId } = await makeAgent(t, adminA);
    await expect(adminB.query(api.agents.get, { agentId })).rejects.toThrow(/NOT_FOUND/);
    await expect(adminB.mutation(api.agents.update, { agentId, name: "X" })).rejects.toThrow(
      /NOT_FOUND/,
    );
    await expect(adminB.mutation(api.agents.remove, { agentId })).rejects.toThrow(/NOT_FOUND/);
    expect(await adminB.query(api.agents.list, {})).toEqual([]);
  });

  test("agents can be assigned issues and added to private teams", async () => {
    const { t, adminA, eng } = await setup();
    await setPlan(t, ORG_A, "business");
    const lead = await makeAgent(t, adminA, { name: "Lead", canManageAgents: true });
    const subId = await lead.client.mutation(api.agents.create, { name: "Sub", teamIds: [eng] });
    const sub = await adminA.query(api.agents.get, { agentId: subId });
    expect(sub.teamIds).toEqual([eng]);

    // The lead creates an issue and hands it to its subagent.
    const { issueId } = await lead.client.mutation(api.issues.create, {
      teamId: eng,
      title: "Write tests",
      assigneeId: sub.userId,
    });
    const issue = await t.run(async (ctx) => (await ctx.db.get("issues", issueId))!);
    expect(issue.assigneeId).toBe(sub.userId);
    expect(issue.creatorId).toBe(lead.userId);

    // A private team the subagent is added to becomes visible to it.
    const secret = await adminA.mutation(api.teams.create, {
      name: "Secret",
      key: "SEC",
      isPrivate: true,
    });
    const subClient = as(t, sub.userId, ORG_A);
    await expect(subClient.query(api.teams.get, { key: "SEC" })).rejects.toThrow(/NOT_FOUND/);
    await adminA.mutation(api.agents.addToTeam, { agentId: subId, teamId: secret });
    expect((await subClient.query(api.teams.get, { key: "SEC" }))._id).toBe(secret);
    // The lead can't see the private team, so it can't add agents to it.
    await expect(
      lead.client.mutation(api.agents.addToTeam, { agentId: subId, teamId: secret }),
    ).rejects.toThrow(/NOT_FOUND/);
  });

  test("deleting an agent removes its subtree and unassigns its issues", async () => {
    const { t, adminA, eng } = await setup();
    const lead = await makeAgent(t, adminA, { name: "Lead", canManageAgents: true });
    const subId = await lead.client.mutation(api.agents.create, { name: "Sub", teamIds: [eng] });
    const sub = await adminA.query(api.agents.get, { agentId: subId });
    const { issueId } = await adminA.mutation(api.issues.create, {
      teamId: eng,
      title: "Task",
      assigneeId: sub.userId,
    });
    await adminA.action(api.agentKeys.create, { agentId: subId, label: "ci" });

    await adminA.mutation(api.agents.remove, { agentId: lead.agentId });
    expect(await adminA.query(api.agents.list, {})).toEqual([]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await t.run(async (ctx) => {
      expect(await ctx.db.get("agents", subId)).toBeNull();
      expect((await ctx.db.get("issues", issueId))?.assigneeId).toBeNull();
      expect(await ctx.db.query("agentKeys").take(10)).toEqual([]);
      const memberships = await ctx.db
        .query("memberships")
        .withIndex("by_orgId_and_kind", (q) => q.eq("orgId", ORG_A).eq("kind", "agent"))
        .take(10);
      expect(memberships).toEqual([]);
      const teamRows = await ctx.db
        .query("teamMembers")
        .withIndex("by_orgId_and_userId", (q) => q.eq("orgId", ORG_A).eq("userId", sub.userId))
        .take(10);
      expect(teamRows).toEqual([]);
    });
  });

  test("an agent that is a private team's only member can't be deleted", async () => {
    const { t, adminA } = await setup();
    await setPlan(t, ORG_A, "business");
    const { agentId, client } = await makeAgent(t, adminA);
    const secret = await adminA.mutation(api.teams.create, {
      name: "Secret",
      key: "SEC",
      isPrivate: true,
    });
    await adminA.mutation(api.agents.addToTeam, { agentId, teamId: secret });
    await adminA.mutation(api.teams.removeMember, { teamId: secret, userId: "admin_a" });
    expect((await client.query(api.teams.get, { key: "SEC" }))._id).toBe(secret);
    await expect(adminA.mutation(api.agents.remove, { agentId })).rejects.toThrow(
      /INVALID_INPUT/,
    );
  });
});

describe("agent keys", () => {
  test("a key is returned once and only its hash is stored", async () => {
    const { t, adminA } = await setup();
    const { agentId } = await makeAgent(t, adminA);
    const { key, keyId, prefix } = await adminA.action(api.agentKeys.create, {
      agentId,
      label: "laptop",
    });
    expect(key).toMatch(/^velo_[A-Za-z0-9_-]{43}$/);
    expect(prefix).toBe(key.slice(0, 12));
    const row = await t.run(async (ctx) => (await ctx.db.get("agentKeys", keyId))!);
    expect(row.hash).toBe(await hashKey(key));
    expect(JSON.stringify(row)).not.toContain(key);
    const listed = await adminA.query(api.agentKeys.list, { agentId });
    expect(listed).toHaveLength(1);
    expect(listed[0]).not.toHaveProperty("hash");
  });

  test("the agent itself may make and revoke its keys; strangers may not", async () => {
    const { t, adminA, memberA, adminB } = await setup();
    const { agentId, client } = await makeAgent(t, adminA);
    const { keyId } = await client.action(api.agentKeys.create, { agentId, label: "self" });
    await expect(memberA.query(api.agentKeys.list, { agentId })).rejects.toThrow(/FORBIDDEN/);
    await expect(adminB.mutation(api.agentKeys.revoke, { keyId })).rejects.toThrow(/NOT_FOUND/);
    await client.mutation(api.agentKeys.revoke, { keyId });
    const [row] = await adminA.query(api.agentKeys.list, { agentId });
    expect(row.revokedAt).not.toBeNull();
  });

  test("a parent agent makes keys for its subagent", async () => {
    const { t, adminA } = await setup();
    const lead = await makeAgent(t, adminA, { name: "Lead", canManageAgents: true });
    const subId: Id<"agents"> = await lead.client.mutation(api.agents.create, { name: "Sub" });
    const { key } = await lead.client.action(api.agentKeys.create, {
      agentId: subId,
      label: "sub process",
    });
    expect(key.startsWith("velo_")).toBe(true);
  });
});
