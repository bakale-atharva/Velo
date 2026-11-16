/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { IssueFilter } from "./issueFilters";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ORG_A = "org_a";
const ORG_B = "org_b";
const PAGE = { numItems: 100, cursor: null };

type T = ReturnType<typeof convexTest>;

function as(t: T, userId: string, orgId: string, role = "member") {
  return t.withIdentity({
    subject: userId,
    tokenIdentifier: `https://clerk.test|${userId}`,
    o: { id: orgId, rol: role, slg: orgId },
  });
}

let svixCounter = 0;
async function send(t: T, type: string, data: unknown) {
  svixCounter += 1;
  await t.mutation(internal.clerkSync.handleEvent, {
    svixId: `msg_vs_${svixCounter}`,
    type,
    data,
  });
}

async function join(t: T, orgId: string, userId: string, role = "org:member") {
  await send(t, "organizationMembership.created", {
    role,
    organization: { id: orgId },
    public_user_data: { user_id: userId },
  });
}

async function setup() {
  const t = convexTest(schema, modules);
  await join(t, ORG_A, "admin_a", "org:admin");
  await join(t, ORG_A, "member_a");
  await join(t, ORG_A, "member_a2");
  await join(t, ORG_B, "admin_b", "org:admin");
  const adminA = as(t, "admin_a", ORG_A, "admin");
  const memberA = as(t, "member_a", ORG_A);
  const memberA2 = as(t, "member_a2", ORG_A);
  const adminB = as(t, "admin_b", ORG_B, "admin");
  const eng = await adminA.mutation(api.teams.create, { name: "Eng", key: "ENG" });
  const ops = await adminA.mutation(api.teams.create, { name: "Ops", key: "OPS" });
  const states = await adminA.query(api.workflowStates.list, { teamId: eng });
  const state = (name: string) => states.find((s) => s.name === name)!._id;
  return { t, adminA, memberA, memberA2, adminB, eng, ops, state };
}

type Caller = ReturnType<typeof as>;

async function titles(caller: Caller, filter: IssueFilter) {
  const result = await caller.query(api.issues.listFiltered, {
    filter,
    paginationOpts: PAGE,
  });
  return result.page.map((issue) => issue.title).sort();
}

describe("issue filters", () => {
  test("each filter field narrows the list", async () => {
    const { adminA, memberA, eng, ops, state } = await setup();
    const bug = await adminA.mutation(api.labels.create, { name: "Bug", color: "#ff0000" });
    const projectId = await memberA.mutation(api.projects.create, { name: "Launch" });
    const cycleId = await memberA.mutation(api.cycles.create, {
      teamId: eng,
      startsAt: Date.now(),
      endsAt: Date.now() + 86_400_000,
    });
    await memberA.mutation(api.issues.create, {
      teamId: eng,
      title: "A",
      assigneeId: "member_a",
      priority: 1,
      labelIds: [bug],
      projectId,
    });
    await adminA.mutation(api.issues.create, {
      teamId: eng,
      title: "B",
      stateId: state("Done"),
      priority: 3,
      cycleId,
    });
    await memberA.mutation(api.issues.create, { teamId: ops, title: "C", assigneeId: "admin_a" });
    const archived = await memberA.mutation(api.issues.create, { teamId: eng, title: "Old" });
    await memberA.mutation(api.issues.archive, { issueId: archived.issueId });

    expect(await titles(memberA, {})).toEqual(["A", "B", "C"]);
    expect(await titles(memberA, { teamId: eng })).toEqual(["A", "B"]);
    expect(await titles(memberA, { stateTypes: ["completed"] })).toEqual(["B"]);
    expect(await titles(memberA, { stateIds: [state("Done")] })).toEqual(["B"]);
    expect(await titles(memberA, { assigneeIds: ["member_a"] })).toEqual(["A"]);
    expect(await titles(memberA, { assigneeIds: [null] })).toEqual(["B"]);
    expect(await titles(memberA, { assigneeIds: ["member_a", "admin_a"] })).toEqual([
      "A",
      "C",
    ]);
    expect(await titles(memberA, { labelIds: [bug] })).toEqual(["A"]);
    expect(await titles(memberA, { priorities: [1, 2] })).toEqual(["A"]);
    expect(await titles(memberA, { projectId })).toEqual(["A"]);
    expect(await titles(memberA, { cycleId })).toEqual(["B"]);
    expect(await titles(memberA, { creatorId: "admin_a" })).toEqual(["B"]);
    expect(await titles(memberA, { teamId: eng, priorities: [3] })).toEqual(["B"]);
  });

  test("filters never reach another org or a private team the caller is not in", async () => {
    const { t, adminA, memberA, adminB, eng } = await setup();
    await adminA.mutation(api.issues.create, { teamId: eng, title: "Ours" });
    await send(t, "subscription.updated", {
      id: "csub_a",
      status: "active",
      updated_at: 1000,
      payer: { organization_id: ORG_A },
      items: [{ id: "csubi_1", status: "active", plan: { slug: "business" } }],
    });
    const secret = await adminA.mutation(api.teams.create, {
      name: "Secret",
      key: "SEC",
      isPrivate: true,
    });
    await adminA.mutation(api.issues.create, { teamId: secret, title: "Hidden" });
    expect(await titles(adminA, {})).toEqual(["Hidden", "Ours"]);
    expect(await titles(memberA, {})).toEqual(["Ours"]);
    await expect(titles(memberA, { teamId: secret })).rejects.toThrow(/NOT_FOUND/);

    const bTeam = await adminB.mutation(api.teams.create, { name: "Eng", key: "ENG" });
    await adminB.mutation(api.issues.create, { teamId: bTeam, title: "Theirs" });
    expect(await titles(adminB, {})).toEqual(["Theirs"]);
    await expect(titles(adminB, { teamId: eng })).rejects.toThrow(/NOT_FOUND/);
    const projectA = await adminA.mutation(api.projects.create, { name: "P" });
    await expect(titles(adminB, { projectId: projectA })).rejects.toThrow(/NOT_FOUND/);
  });

  test("my issues lists the caller's open work first", async () => {
    const { memberA, eng, state } = await setup();
    const make = (title: string, extra: Record<string, unknown>) =>
      memberA.mutation(api.issues.create, {
        teamId: eng,
        title,
        assigneeId: "member_a",
        ...extra,
      });
    await make("Done", { stateId: state("Done"), priority: 1 });
    await make("Todo low", { priority: 4 });
    await make("Todo urgent", { priority: 1 });
    await make("Doing", { stateId: state("In Progress") });
    await memberA.mutation(api.issues.create, { teamId: eng, title: "Not mine" });
    const mine = await memberA.query(api.issues.listMine, {});
    expect(mine.map((issue) => issue.title)).toEqual([
      "Doing",
      "Todo urgent",
      "Todo low",
      "Done",
    ]);
  });
});

describe("saved views", () => {
  test("private views are the owner's; shared views are visible to the org", async () => {
    const { memberA, memberA2, adminA, adminB, eng } = await setup();
    const privateView = await memberA.mutation(api.savedViews.create, {
      name: "Mine",
      filter: { teamId: eng },
    });
    const sharedView = await memberA.mutation(api.savedViews.create, {
      name: "Team",
      filter: { stateTypes: ["started"] },
      isShared: true,
      layout: "board",
    });

    expect((await memberA.query(api.savedViews.list, {})).map((v) => v.name)).toEqual([
      "Mine",
      "Team",
    ]);
    expect((await memberA2.query(api.savedViews.list, {})).map((v) => v.name)).toEqual([
      "Team",
    ]);
    await expect(
      memberA2.query(api.savedViews.get, { viewId: privateView }),
    ).rejects.toThrow(/NOT_FOUND/);
    expect((await memberA2.query(api.savedViews.get, { viewId: sharedView })).layout).toBe(
      "board",
    );

    // Only the owner edits; another member cannot, even a shared view.
    await expect(
      memberA2.mutation(api.savedViews.update, { viewId: sharedView, name: "Taken" }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      memberA2.mutation(api.savedViews.remove, { viewId: sharedView }),
    ).rejects.toThrow(/FORBIDDEN/);
    await memberA.mutation(api.savedViews.update, { viewId: privateView, isShared: true });
    expect(await memberA2.query(api.savedViews.list, {})).toHaveLength(2);

    // Another org sees nothing and cannot touch either view.
    expect(await adminB.query(api.savedViews.list, {})).toHaveLength(0);
    await expect(adminB.query(api.savedViews.get, { viewId: sharedView })).rejects.toThrow(
      /NOT_FOUND/,
    );
    await expect(
      adminB.mutation(api.savedViews.remove, { viewId: sharedView }),
    ).rejects.toThrow(/NOT_FOUND/);

    // An admin may delete a shared view.
    await adminA.mutation(api.savedViews.remove, { viewId: sharedView });
    expect(await memberA.query(api.savedViews.list, {})).toHaveLength(1);
  });

  test("oversized filters are refused", async () => {
    const { memberA } = await setup();
    await expect(
      memberA.mutation(api.savedViews.create, {
        name: "Big",
        filter: { priorities: Array.from({ length: 51 }, () => 1) },
      }),
    ).rejects.toThrow(/INVALID_INPUT/);
  });
});

describe("search", () => {
  test("finds issues by title and description within the org only", async () => {
    const { memberA, adminA, adminB, eng, ops } = await setup();
    await memberA.mutation(api.issues.create, { teamId: eng, title: "Login button broken" });
    await memberA.mutation(api.issues.create, {
      teamId: ops,
      title: "Rotate keys",
      description: "The login service needs new keys",
    });
    await memberA.mutation(api.issues.create, { teamId: eng, title: "Unrelated" });
    const bTeam = await adminB.mutation(api.teams.create, { name: "Eng", key: "ENG" });
    await adminB.mutation(api.issues.create, { teamId: bTeam, title: "Login for B" });

    const found = await memberA.query(api.search.issues, { query: "login" });
    expect(found.map((i) => i.title).sort()).toEqual(["Login button broken", "Rotate keys"]);
    const inEng = await memberA.query(api.search.issues, { query: "login", teamId: eng });
    expect(inEng.map((i) => i.title)).toEqual(["Login button broken"]);
    expect(await memberA.query(api.search.issues, { query: "   " })).toEqual([]);

    const fromB = await adminB.query(api.search.issues, { query: "login" });
    expect(fromB.map((i) => i.title)).toEqual(["Login for B"]);
    await expect(
      adminB.query(api.search.issues, { query: "login", teamId: eng }),
    ).rejects.toThrow(/NOT_FOUND/);

    // Search text follows title edits.
    const [issue] = found.filter((i) => i.title === "Login button broken");
    await adminA.mutation(api.issues.update, { issueId: issue._id, title: "Signin button" });
    const after = await memberA.query(api.search.issues, { query: "signin" });
    expect(after.map((i) => i.title)).toEqual(["Signin button"]);
  });

  test("private-team issues stay hidden from non-members", async () => {
    const { t, adminA, memberA } = await setup();
    await send(t, "subscription.updated", {
      id: "csub_a",
      status: "active",
      updated_at: 1000,
      payer: { organization_id: ORG_A },
      items: [{ id: "csubi_1", status: "active", plan: { slug: "business" } }],
    });
    const secret = await adminA.mutation(api.teams.create, {
      name: "Secret",
      key: "SEC",
      isPrivate: true,
    });
    await adminA.mutation(api.issues.create, { teamId: secret, title: "Acquisition plan" });
    expect(await adminA.query(api.search.issues, { query: "acquisition" })).toHaveLength(1);
    expect(await memberA.query(api.search.issues, { query: "acquisition" })).toEqual([]);
  });
});
