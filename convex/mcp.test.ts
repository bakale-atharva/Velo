/// <reference types="vite/client" />
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { hashKey } from "./agentKeys";
import type { AgentClient } from "./mcp/client";
import { handleMcp, SUPPORTED_VERSIONS } from "./mcp/protocol";
import { ALL_TOOLS } from "./mcp/tools";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ORG_A = "org_a";
const ORG_B = "org_b";

const newTest = () => {
  const t = convexTest(schema, modules);
  // authenticate rate-limits each key.
  rateLimiterTest.register(t);
  return t;
};
type T = ReturnType<typeof newTest>;

function as(t: T, userId: string, orgId: string, role = "member") {
  return t.withIdentity({
    subject: userId,
    tokenIdentifier: `https://velo.test|${userId}`,
    o: { id: orgId, rol: role, slg: orgId },
  });
}

/** The production AgentClient, but calling through convex-test as `userId`. */
function clientFor(t: T, userId: string, orgId: string, role = "member"): AgentClient {
  // Forwards calls unchanged; the generic signatures differ only in typing.
  type Call = (ref: unknown, args: unknown) => Promise<unknown>;
  const identity = as(t, userId, orgId, role) as unknown as { query: Call; mutation: Call; action: Call };
  return {
    query: (ref: unknown, args: unknown) => identity.query(ref, args),
    mutation: (ref: unknown, args: unknown) => identity.mutation(ref, args),
    action: (ref: unknown, args: unknown) => identity.action(ref, args),
  } as unknown as AgentClient;
}

let svixCounter = 0;
async function join(t: T, orgId: string, userId: string, role = "org:member") {
  svixCounter += 1;
  await t.mutation(internal.clerkSync.handleEvent, {
    svixId: `msg_mcp_${svixCounter}`,
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

async function agentUser(t: T, agentId: Id<"agents">) {
  return await t.run(async (ctx) => (await ctx.db.get("agents", agentId))!);
}

/** Org A with team ENG, a master agent "Lead" (an admin), and org B. */
async function setup() {
  const t = newTest();
  await join(t, ORG_A, "admin_a", "org:admin");
  await join(t, ORG_B, "admin_b", "org:admin");
  const adminA = as(t, "admin_a", ORG_A, "admin");
  await adminA.mutation(api.teams.create, { name: "Engineering", key: "ENG" });
  const leadId = await adminA.mutation(api.agents.create, { name: "Lead", runtime: "claude" });
  const lead = await agentUser(t, leadId);
  return { t, adminA, leadId, lead: clientFor(t, lead.userId, ORG_A, "admin"), leadUserId: lead.userId };
}

/** One of Lead's agents (a member), with a client acting as it. */
async function makeWorker(t: T, lead: AgentClient, name = "Worker") {
  const created = JSON.parse((await call(lead, "create_agent", { name })).content![0].text) as {
    userId: string;
  };
  return { userId: created.userId, client: clientFor(t, created.userId, ORG_A, "member") };
}

type Body = {
  result?: {
    isError?: boolean;
    content?: { text: string }[];
    structuredContent?: Record<string, unknown>;
    [key: string]: unknown;
  };
  error?: { code: number; message: string; data?: unknown };
};

async function rpc(
  client: AgentClient,
  method: string,
  params: Record<string, unknown> = {},
  headers: Record<string, string> = {},
  id: number | null = 1,
) {
  const message = { jsonrpc: "2.0", method, params, ...(id === null ? {} : { id }) };
  const response = await handleMcp(message, new Headers(headers), { tools: ALL_TOOLS, client });
  return { status: response.status, body: response.body as Body };
}

async function call(client: AgentClient, name: string, args: Record<string, unknown> = {}) {
  const { body } = await rpc(client, "tools/call", { name, arguments: args });
  return body.result!;
}

async function ok(client: AgentClient, name: string, args: Record<string, unknown> = {}) {
  const result = await call(client, name, args);
  if (result.isError) throw new Error(`${name} failed: ${result.content?.[0]?.text}`);
  return JSON.parse(result.content![0].text);
}

describe("MCP protocol", () => {
  test("legacy clients get an initialize handshake", async () => {
    const { lead } = await setup();
    const { status, body } = await rpc(lead, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(status).toBe(200);
    expect(body.result).toMatchObject({
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "velo" },
    });
    // An unknown version is answered with the newest legacy one.
    const other = await rpc(lead, "initialize", { protocolVersion: "1999-01-01" });
    expect(other.body.result?.protocolVersion).toBe("2025-11-25");
    // Notifications are accepted with no body.
    expect((await rpc(lead, "notifications/initialized", {}, {}, null)).status).toBe(202);
  });

  test("modern clients use per-request metadata and server/discover", async () => {
    const { lead } = await setup();
    const meta = { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } };
    const header = { "MCP-Protocol-Version": "2026-07-28" };
    const discover = await rpc(lead, "server/discover", meta, header);
    expect(discover.body.result).toMatchObject({
      resultType: "complete",
      supportedVersions: SUPPORTED_VERSIONS,
      capabilities: { tools: {} },
    });
    const list = await rpc(lead, "tools/list", meta, header);
    expect(list.body.result?.resultType).toBe("complete");
    expect(list.body.result?.cacheScope).toBe("private");

    const mismatch = await rpc(lead, "tools/list", meta, { "MCP-Protocol-Version": "2025-11-25" });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error?.code).toBe(-32020);

    const unsupported = await rpc(
      lead,
      "tools/list",
      { _meta: { "io.modelcontextprotocol/protocolVersion": "2030-01-01" } },
      { "MCP-Protocol-Version": "2030-01-01" },
    );
    expect(unsupported.status).toBe(400);
    expect(unsupported.body.error).toMatchObject({ code: -32022, data: { requested: "2030-01-01" } });

    const unknown = await rpc(lead, "resources/list", meta, header);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error?.code).toBe(-32601);
  });

  test("rejects malformed messages", async () => {
    const { lead } = await setup();
    const parse = await handleMcp(undefined, new Headers(), { tools: ALL_TOOLS, client: lead });
    expect(parse.status).toBe(400);
    const batch = await handleMcp([{ jsonrpc: "2.0", id: 1, method: "ping" }], new Headers(), {
      tools: ALL_TOOLS,
      client: lead,
    });
    expect(batch.status).toBe(400);
  });

  test("tools/list describes every tool with an object schema", async () => {
    const { lead } = await setup();
    const { body } = await rpc(lead, "tools/list");
    const tools = body.result!.tools as {
      name: string;
      description: string;
      inputSchema: { type: string };
      annotations: { readOnlyHint?: boolean; destructiveHint?: boolean };
    }[];
    expect(tools.length).toBe(ALL_TOOLS.length);
    expect(new Set(tools.map((t) => t.name)).size).toBe(tools.length);
    for (const tool of tools) {
      expect(tool.name).toMatch(/^[a-z_]+$/);
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema.type).toBe("object");
    }
    const byName = new Map(tools.map((t) => [t.name, t]));
    expect(byName.get("delete_issue")?.annotations.destructiveHint).toBe(true);
    expect(byName.get("list_teams")?.annotations.readOnlyHint).toBe(true);
  });

  test("unknown tools and invalid input are reported, not thrown", async () => {
    const { lead } = await setup();
    const unknown = await rpc(lead, "tools/call", { name: "drop_database", arguments: {} });
    expect(unknown.body.error?.code).toBe(-32602);
    const invalid = await call(lead, "create_issue", { team: "ENG", priority: 9 });
    expect(invalid.isError).toBe(true);
    expect(invalid.content![0].text).toMatch(/^INVALID_INPUT: .*title/);
    const missing = await call(lead, "get_issue", { issue: "ENG-404" });
    expect(missing.isError).toBe(true);
    expect(missing.content![0].text).toMatch(/^NOT_FOUND/);
  });
});

describe("MCP tools", () => {
  test("an agent plans work, creates a subagent and delegates to it", async () => {
    const { t, lead, leadUserId } = await setup();

    const me = await ok(lead, "whoami");
    expect(me.you).toMatchObject({ userId: leadUserId, isAgent: true, role: "admin" });
    expect(me).toMatchObject({ isMaster: true, canCreateAgents: true });

    const sub = await ok(lead, "create_agent", {
      name: "Reviewer",
      imageUrl: "https://example.com/reviewer.png",
      description: "Reviews pull requests",
      model: "claude-opus-5-5",
      metadata: { focus: "tests" },
      teams: ["ENG"],
    });
    expect(sub).toMatchObject({
      name: "Reviewer",
      imageUrl: "https://example.com/reviewer.png",
      metadata: { focus: "tests" },
      role: "member",
    });

    const issue = await ok(lead, "create_issue", {
      team: "eng",
      title: "Cover the MCP server with tests",
      priority: 2,
      dueDate: "2026-12-01",
      assignee: "Reviewer",
    });
    expect(issue).toMatchObject({
      identifier: "ENG-1",
      assignee: "Reviewer",
      assigneeId: sub.userId,
      priorityName: "high",
      dueDate: "2026-12-01",
      state: "Todo",
    });

    await ok(lead, "add_comment", { issue: "ENG-1", body: "Over to you, Reviewer." });
    const moved = await ok(lead, "update_issue", { issue: "ENG-1", state: "In Progress" });
    expect(moved.stateType).toBe("started");

    // The subagent sees its work.
    const reviewer = clientFor(t, sub.userId, ORG_A);
    const mine = await ok(reviewer, "my_issues");
    expect(mine.issues.map((i: { identifier: string }) => i.identifier)).toEqual(["ENG-1"]);
    const detail = await ok(reviewer, "get_issue", { issue: "ENG-1" });
    expect(detail.comments[0]).toMatchObject({ body: "Over to you, Reviewer.", authorId: leadUserId });

    // Every change is attributed to the agent that made it.
    const activity = await ok(lead, "issue_activity", { issue: "ENG-1" });
    expect(activity.activities.every((a: { actorId: string }) => a.actorId === leadUserId)).toBe(true);

    // The subagent and the team see each other.
    const members = await ok(lead, "list_team_members", { team: "ENG" });
    expect(members.members.map((m: { userId: string }) => m.userId)).toContain(sub.userId);

    // Board moves land in the right column.
    await ok(lead, "move_issue", { issue: "ENG-1", state: "Done", position: "top" });
    const board = await ok(lead, "board", { team: "ENG" });
    const done = board.columns.find((c: { state: string }) => c.state === "Done");
    expect(done.issues[0].identifier).toBe("ENG-1");
  });

  test("a master's agent can't do admin work or create agents", async () => {
    const { t, lead } = await setup();
    const worker = await makeWorker(t, lead);
    const archive = await call(worker.client, "archive_team", { team: "ENG" });
    expect(archive.content![0].text).toMatch(/^FORBIDDEN/);
    const del = await call(worker.client, "delete_team", { team: "ENG", confirmKey: "ENG" });
    expect(del.isError).toBe(true);
    expect(del.content![0].text).toMatch(/^FORBIDDEN/);
    const label = await call(worker.client, "create_label", { name: "bug" });
    expect(label.content![0].text).toMatch(/^FORBIDDEN/);
    const agent = await call(worker.client, "create_agent", { name: "Grandchild" });
    expect(agent.content![0].text).toMatch(/^FORBIDDEN/);
  });

  test("private teams stay hidden from agents outside them", async () => {
    const { t, adminA, lead } = await setup();
    await setPlan(t, ORG_A, "business");
    const secret = await adminA.mutation(api.teams.create, { name: "Secret", key: "SEC", isPrivate: true });
    await adminA.mutation(api.issues.create, { teamId: secret, title: "Hidden plan" });

    const teams = await ok(lead, "list_teams");
    expect(teams.teams.map((x: { key: string }) => x.key)).toEqual(["ENG"]);
    const hidden = await call(lead, "get_issue", { issue: "SEC-1" });
    expect(hidden.content![0].text).toMatch(/^NOT_FOUND/);
    const search = await ok(lead, "search_issues", { query: "Hidden" });
    expect(search.issues).toEqual([]);
  });

  test("an agent can't reach another workspace", async () => {
    const { t, adminA, lead } = await setup();
    await adminA.mutation(api.issues.create, {
      teamId: (await adminA.query(api.teams.get, { key: "ENG" }))._id,
      title: "Org A work",
    });
    const adminB = as(t, "admin_b", ORG_B, "admin");
    const outsiderId = await adminB.mutation(api.agents.create, { name: "Outsider" });
    const outsider = await agentUser(t, outsiderId);
    const client = clientFor(t, outsider.userId, ORG_B);

    expect((await call(client, "get_issue", { issue: "ENG-1" })).content![0].text).toMatch(/^NOT_FOUND/);
    expect((await call(client, "get_team", { team: "ENG" })).content![0].text).toMatch(/^NOT_FOUND/);
    const lookup = await call(client, "update_agent", { agent: "Lead", name: "Pwned" });
    expect(lookup.content![0].text).toMatch(/^NOT_FOUND/);
    expect((await ok(lead, "get_agent", { agent: "Lead" })).name).toBe("Lead");
    expect((await ok(client, "list_members")).members.map((m: { userId: string }) => m.userId)).toEqual([
      "admin_b",
      outsider.userId,
    ]);
  });

  test("projects, cycles and saved views by name", async () => {
    const { lead } = await setup();
    const project = await ok(lead, "create_project", {
      name: "Launch",
      status: "started",
      lead: "me",
      targetDate: "2027-01-15",
    });
    expect(project).toMatchObject({ name: "Launch", targetDate: "2027-01-15", progress: 0 });
    const cycle = await ok(lead, "create_cycle", { team: "ENG", starts: "2026-12-01", ends: "2026-12-15" });
    expect(cycle).toMatchObject({ starts: "2026-12-01", ends: "2026-12-15", number: 1 });

    await ok(lead, "create_issue", { team: "ENG", title: "Ship it", project: "launch", cycle: "1" });
    expect((await ok(lead, "project_issues", { project: "Launch" })).issues).toHaveLength(1);
    expect((await ok(lead, "cycle_issues", { team: "ENG", cycle: "1" })).issues).toHaveLength(1);

    const { viewId } = await ok(lead, "create_view", {
      name: "Launch work",
      filter: { project: "Launch", stateTypes: ["unstarted"] },
    });
    const view = await ok(lead, "get_view", { viewId });
    expect(view.issues.map((i: { title: string }) => i.title)).toEqual(["Ship it"]);
    const filtered = await ok(lead, "filter_issues", { assignees: ["none"], team: "ENG" });
    expect(filtered.issues).toHaveLength(1);
  });

  test("a master agent manages roles and reads the audit log", async () => {
    const { t, adminA } = await setup();
    await setPlan(t, ORG_A, "business");
    const opsId = await adminA.mutation(api.agents.create, { name: "Ops" });
    const ops = clientFor(t, (await agentUser(t, opsId)).userId, ORG_A, "admin");
    const worker = await makeWorker(t, ops);
    await ok(ops, "create_role", { name: "Triager", permissions: ["issues.delete", "labels.manage"] });
    await ok(ops, "assign_role", { member: worker.userId, role: "triager" });
    const assignments = await ok(ops, "role_assignments");
    expect(assignments.assignments).toHaveLength(1);
    const audit = await ok(ops, "audit_log", { limit: 50 });
    expect(audit.entries.map((e: { action: string }) => e.action)).toContain("role.created");
  });
});

describe("MCP door", () => {
  test("requests without a valid key are refused", async () => {
    const { t } = await setup();
    const missing = await t.fetch("/mcp", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    expect(missing.status).toBe(401);
    expect(missing.headers.get("WWW-Authenticate")).toMatch(/^Bearer/);
    const wrongScheme = await t.fetch("/mcp", {
      method: "POST",
      headers: { Authorization: "Bearer sk_not_velo" },
      body: "{}",
    });
    expect(wrongScheme.status).toBe(401);
    expect((await t.fetch("/mcp", { method: "GET" })).status).toBe(405);
  });

  test("authenticate accepts live keys and refuses revoked keys and disabled agents", async () => {
    const { t, adminA, leadId, leadUserId } = await setup();
    const { key, keyId } = await adminA.action(api.agentKeys.create, { agentId: leadId, label: "test" });
    const keyHash = await hashKey(key);

    const accepted = await t.mutation(internal.mcp.auth.authenticate, { keyHash });
    expect(accepted).toMatchObject({ ok: true, caller: { userId: leadUserId, orgId: ORG_A, role: "admin" } });
    const wrong = await t.mutation(internal.mcp.auth.authenticate, { keyHash: await hashKey(`${key}x`) });
    expect(wrong).toEqual({ ok: false, reason: "INVALID_KEY" });

    await adminA.mutation(api.agents.disable, { agentId: leadId });
    expect((await t.mutation(internal.mcp.auth.authenticate, { keyHash })).ok).toBe(false);
    await adminA.mutation(api.agents.enable, { agentId: leadId });
    expect((await t.mutation(internal.mcp.auth.authenticate, { keyHash })).ok).toBe(true);

    await adminA.mutation(api.agentKeys.revoke, { keyId });
    expect(await t.mutation(internal.mcp.auth.authenticate, { keyHash })).toEqual({
      ok: false,
      reason: "INVALID_KEY",
    });
  });
});
