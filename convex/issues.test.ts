/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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
    svixId: `msg_issues_${svixCounter}`,
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

async function subscribe(t: T, orgId: string, planSlug: string) {
  await send(t, "subscription.updated", {
    id: `csub_${orgId}`,
    status: "active",
    updated_at: 1000,
    payer: { organization_id: orgId },
    items: [{ id: "csubi_1", status: "active", plan: { slug: planSlug } }],
  });
}

/** Two orgs, each with an admin and a member. */
async function setup() {
  const t = convexTest(schema, modules);
  await join(t, ORG_A, "admin_a", "org:admin");
  await join(t, ORG_A, "member_a");
  await join(t, ORG_B, "admin_b", "org:admin");
  await join(t, ORG_B, "member_b");
  return {
    t,
    adminA: as(t, "admin_a", ORG_A, "admin"),
    memberA: as(t, "member_a", ORG_A),
    adminB: as(t, "admin_b", ORG_B, "admin"),
    memberB: as(t, "member_b", ORG_B),
  };
}

type Caller = ReturnType<typeof as>;

async function createTeam(admin: Caller, key = "ENG", isPrivate = false) {
  const teamId = await admin.mutation(api.teams.create, {
    name: `Team ${key}`,
    key,
    isPrivate,
  });
  const states = await admin.query(api.workflowStates.list, { teamId });
  const state = (name: string) => states.find((s) => s.name === name)!._id;
  return { teamId, states, state };
}

async function activityTypes(caller: Caller, issueId: Id<"issues">) {
  const feed = await caller.query(api.activities.listForIssue, {
    issueId,
    paginationOpts: PAGE,
  });
  return feed.page.map((a) => a.type).reverse();
}

describe("teams", () => {
  test("a new team gets the five default states and its creator as member", async () => {
    const { adminA } = await setup();
    const { teamId, states } = await createTeam(adminA);
    expect(states.map((s) => [s.name, s.type])).toEqual([
      ["Backlog", "backlog"],
      ["Todo", "unstarted"],
      ["In Progress", "started"],
      ["Done", "completed"],
      ["Canceled", "canceled"],
    ]);
    expect(await adminA.query(api.teams.listMembers, { teamId })).toEqual(["admin_a"]);
  });

  test("only admins create teams; keys are validated and unique per org", async () => {
    const { adminA, memberA } = await setup();
    await expect(
      memberA.mutation(api.teams.create, { name: "Eng", key: "ENG" }),
    ).rejects.toThrow(/FORBIDDEN/);
    for (const key of ["E", "eng", "TOOLONG", "EN1"]) {
      await expect(
        adminA.mutation(api.teams.create, { name: "Eng", key }),
      ).rejects.toThrow(/INVALID_INPUT/);
    }
    await createTeam(adminA, "ENG");
    await expect(
      adminA.mutation(api.teams.create, { name: "Again", key: "ENG" }),
    ).rejects.toThrow(/INVALID_INPUT/);
  });

  test("two orgs can both have team key ENG", async () => {
    const { adminA, adminB, memberA } = await setup();
    const a = await createTeam(adminA, "ENG");
    const b = await createTeam(adminB, "ENG");
    const issueA = await adminA.mutation(api.issues.create, { teamId: a.teamId, title: "A" });
    const issueB = await adminB.mutation(api.issues.create, { teamId: b.teamId, title: "B" });
    expect(issueA.identifier).toBe("ENG-1");
    expect(issueB.identifier).toBe("ENG-1");
    expect((await memberA.query(api.issues.get, { identifier: "ENG-1" })).title).toBe("A");
    expect((await memberA.query(api.teams.get, { key: "ENG" }))._id).toBe(a.teamId);
    expect(await memberA.query(api.teams.list, {})).toHaveLength(1);
  });

  test("archived teams leave the list and take no new issues", async () => {
    const { adminA } = await setup();
    const { teamId } = await createTeam(adminA);
    await adminA.mutation(api.teams.archive, { teamId });
    expect(await adminA.query(api.teams.list, {})).toHaveLength(0);
    expect(await adminA.query(api.teams.list, { includeArchived: true })).toHaveLength(1);
    await expect(
      adminA.mutation(api.issues.create, { teamId, title: "Late" }),
    ).rejects.toThrow(/INVALID_INPUT/);
  });
});

describe("private teams", () => {
  test("creating one on Free throws FEATURE_NOT_IN_PLAN", async () => {
    const { adminA } = await setup();
    await expect(
      adminA.mutation(api.teams.create, { name: "Secret", key: "SEC", isPrivate: true }),
    ).rejects.toThrow(/FEATURE_NOT_IN_PLAN/);
    const { teamId } = await createTeam(adminA, "PUB");
    await expect(
      adminA.mutation(api.teams.update, { teamId, isPrivate: true }),
    ).rejects.toThrow(/FEATURE_NOT_IN_PLAN/);
  });

  test("a non-member gets NOT_FOUND, even as admin", async () => {
    const { t, adminA, memberA } = await setup();
    await subscribe(t, ORG_A, "business");
    await join(t, ORG_A, "admin_a2", "org:admin");
    const otherAdmin = as(t, "admin_a2", ORG_A, "admin");
    const { teamId, state } = await createTeam(adminA, "SEC", true);
    const { issueId } = await adminA.mutation(api.issues.create, { teamId, title: "Secret" });

    for (const outsider of [memberA, otherAdmin]) {
      expect(await outsider.query(api.teams.list, {})).toHaveLength(0);
      await expect(outsider.query(api.teams.get, { key: "SEC" })).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.query(api.issues.get, { identifier: "SEC-1" }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.query(api.issues.listForBoard, { teamId }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.mutation(api.issues.create, { teamId, title: "Sneak" }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.mutation(api.issues.update, { issueId, title: "Sneak" }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.mutation(api.issues.move, {
          issueId,
          stateId: state("Done"),
          beforeRank: null,
          afterRank: null,
        }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.mutation(api.comments.create, { issueId, body: "Hi" }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.query(api.activities.listForIssue, { issueId, paginationOpts: PAGE }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.query(api.workflowStates.list, { teamId }),
      ).rejects.toThrow(/NOT_FOUND/);
    }
    await expect(
      otherAdmin.mutation(api.teams.addMember, { teamId, userId: "admin_a2" }),
    ).rejects.toThrow(/NOT_FOUND/);

    await adminA.mutation(api.teams.addMember, { teamId, userId: "member_a" });
    expect((await memberA.query(api.issues.get, { identifier: "SEC-1" })).title).toBe("Secret");
    expect(await memberA.query(api.teams.list, {})).toHaveLength(1);
  });

  test("members come from the org, and the last one cannot be removed", async () => {
    const { t, adminA } = await setup();
    await subscribe(t, ORG_A, "business");
    const { teamId } = await createTeam(adminA, "SEC", true);
    await expect(
      adminA.mutation(api.teams.addMember, { teamId, userId: "member_b" }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(
      adminA.mutation(api.teams.removeMember, { teamId, userId: "admin_a" }),
    ).rejects.toThrow(/INVALID_INPUT/);
    await expect(
      adminA.mutation(api.issues.create, { teamId, title: "X", assigneeId: "member_a" }),
    ).rejects.toThrow(/INVALID_INPUT/);
  });
});

describe("issues", () => {
  test("numbering is sequential per team", async () => {
    const { adminA, memberA } = await setup();
    const eng = await createTeam(adminA, "ENG");
    const ops = await createTeam(adminA, "OPS");
    const made = [];
    for (const [caller, teamId] of [
      [adminA, eng.teamId],
      [memberA, eng.teamId],
      [memberA, ops.teamId],
      [adminA, eng.teamId],
    ] as const) {
      made.push((await caller.mutation(api.issues.create, { teamId, title: "T" })).identifier);
    }
    expect(made).toEqual(["ENG-1", "ENG-2", "OPS-1", "ENG-3"]);
  });

  test("a new issue starts in the first unstarted state, at the column's end", async () => {
    const { adminA, memberA } = await setup();
    const { teamId, state } = await createTeam(adminA);
    await memberA.mutation(api.issues.create, { teamId, title: "First" });
    await memberA.mutation(api.issues.create, { teamId, title: "Second" });
    const board = await memberA.query(api.issues.listForBoard, { teamId });
    const todo = board.find((column) => column.stateId === state("Todo"))!;
    expect(todo.issues.map((i) => i.title)).toEqual(["First", "Second"]);
    expect(todo.issues[0].stateType).toBe("unstarted");
    expect(todo.issues[0]).not.toHaveProperty("searchText");
  });

  test("input is validated", async () => {
    const { adminA, memberA } = await setup();
    const { teamId } = await createTeam(adminA);
    const bad = [
      { title: "   " },
      { title: "T", priority: 5 },
      { title: "T", priority: 1.5 },
      { title: "T", estimate: -1 },
      { title: "T", assigneeId: "member_b" },
    ];
    for (const input of bad) {
      await expect(
        memberA.mutation(api.issues.create, { teamId, ...input }),
      ).rejects.toThrow(/INVALID_INPUT/);
    }
  });

  test("cross-org get, update, move and comment all throw NOT_FOUND", async () => {
    const { adminA, adminB, memberB } = await setup();
    const a = await createTeam(adminA, "ENG");
    const b = await createTeam(adminB, "OPS");
    const { issueId } = await adminA.mutation(api.issues.create, {
      teamId: a.teamId,
      title: "Org A only",
    });
    const commentId = await adminA.mutation(api.comments.create, { issueId, body: "Hi" });

    for (const outsider of [adminB, memberB]) {
      await expect(
        outsider.query(api.issues.get, { identifier: "ENG-1" }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.mutation(api.issues.update, { issueId, title: "Hacked" }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.mutation(api.issues.move, {
          issueId,
          stateId: b.state("Done"),
          beforeRank: null,
          afterRank: null,
        }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.mutation(api.issues.archive, { issueId }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.mutation(api.comments.create, { issueId, body: "Hi" }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.mutation(api.comments.update, { commentId, body: "Hacked" }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.query(api.comments.list, { issueId, paginationOpts: PAGE }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.query(api.issues.listByTeam, { teamId: a.teamId, paginationOpts: PAGE }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.query(api.issues.listSubIssues, { issueId }),
      ).rejects.toThrow(/NOT_FOUND/);
      await expect(
        outsider.mutation(api.issues.create, { teamId: a.teamId, title: "Sneak" }),
      ).rejects.toThrow(/NOT_FOUND/);
    }
    await expect(adminB.mutation(api.issues.remove, { issueId })).rejects.toThrow(/NOT_FOUND/);
    await expect(
      adminB.mutation(api.teams.update, { teamId: a.teamId, name: "Hacked" }),
    ).rejects.toThrow(/NOT_FOUND/);
    // Org B cannot pull org A's issue, state or label into its own issue.
    const labelA = await adminA.mutation(api.labels.create, { name: "bug", color: "#ff0000" });
    await expect(
      adminB.mutation(api.issues.create, { teamId: b.teamId, title: "X", parentId: issueId }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(
      adminB.mutation(api.issues.create, {
        teamId: b.teamId,
        title: "X",
        stateId: a.state("Todo"),
      }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(
      adminB.mutation(api.issues.create, { teamId: b.teamId, title: "X", labelIds: [labelA] }),
    ).rejects.toThrow(/NOT_FOUND/);
    expect((await adminA.query(api.issues.get, { identifier: "ENG-1" })).title).toBe(
      "Org A only",
    );
  });

  test("update writes one activity per changed field", async () => {
    const { adminA, memberA } = await setup();
    const { teamId, state } = await createTeam(adminA);
    const bug = await adminA.mutation(api.labels.create, { name: "bug", color: "#ff0000" });
    const { issueId } = await memberA.mutation(api.issues.create, { teamId, title: "Old" });
    expect(await activityTypes(memberA, issueId)).toEqual(["created"]);

    await memberA.mutation(api.issues.update, {
      issueId,
      title: "New",
      priority: 2,
      assigneeId: "admin_a",
      labelIds: [bug],
      // Unchanged values write nothing.
      description: "",
      estimate: null,
    });
    expect(await activityTypes(memberA, issueId)).toEqual([
      "created",
      "title",
      "priority",
      "assignee",
      "labels",
    ]);
    const feed = await memberA.query(api.activities.listForIssue, {
      issueId,
      paginationOpts: PAGE,
    });
    expect(feed.page.find((a) => a.type === "title")).toMatchObject({
      from: "Old",
      to: "New",
      actorId: "member_a",
      viaAssistant: false,
    });
    expect(feed.page.find((a) => a.type === "labels")).toMatchObject({ from: null, to: "bug" });

    await memberA.mutation(api.issues.update, { issueId, title: "New", priority: 2 });
    expect(await activityTypes(memberA, issueId)).toHaveLength(5);

    await memberA.mutation(api.issues.update, { issueId, stateId: state("Done") });
    let issue = await memberA.query(api.issues.get, { identifier: "ENG-1" });
    expect(issue.stateType).toBe("completed");
    expect(issue.completedAt).not.toBeNull();
    await memberA.mutation(api.issues.update, { issueId, stateId: state("Todo") });
    issue = await memberA.query(api.issues.get, { identifier: "ENG-1" });
    expect(issue.completedAt).toBeNull();
    const states = (
      await memberA.query(api.activities.listForIssue, { issueId, paginationOpts: PAGE })
    ).page.filter((a) => a.type === "state");
    expect(states.map((a) => [a.from, a.to])).toEqual([
      ["Done", "Todo"],
      ["Todo", "Done"],
    ]);
  });

  test("a state from another team is rejected", async () => {
    const { adminA, memberA } = await setup();
    const eng = await createTeam(adminA, "ENG");
    const ops = await createTeam(adminA, "OPS");
    const foreign = ops.state("Done");
    await expect(
      memberA.mutation(api.issues.create, { teamId: eng.teamId, title: "T", stateId: foreign }),
    ).rejects.toThrow(/INVALID_INPUT/);
    const { issueId } = await memberA.mutation(api.issues.create, {
      teamId: eng.teamId,
      title: "T",
    });
    await expect(
      memberA.mutation(api.issues.update, { issueId, stateId: foreign }),
    ).rejects.toThrow(/INVALID_INPUT/);
    await expect(
      memberA.mutation(api.issues.move, {
        issueId,
        stateId: foreign,
        beforeRank: null,
        afterRank: null,
      }),
    ).rejects.toThrow(/INVALID_INPUT/);
  });

  test("move reorders within a column and across columns", async () => {
    const { adminA, memberA } = await setup();
    const { teamId, state } = await createTeam(adminA);
    const ids: Id<"issues">[] = [];
    for (const title of ["A", "B", "C"]) {
      ids.push((await memberA.mutation(api.issues.create, { teamId, title })).issueId);
    }
    const column = async (name: string) =>
      (await memberA.query(api.issues.listForBoard, { teamId })).find(
        (c) => c.stateId === state(name),
      )!.issues;

    // C between A and B.
    let todo = await column("Todo");
    await memberA.mutation(api.issues.move, {
      issueId: ids[2],
      stateId: state("Todo"),
      beforeRank: todo[0].rank,
      afterRank: todo[1].rank,
    });
    todo = await column("Todo");
    expect(todo.map((i) => i.title)).toEqual(["A", "C", "B"]);
    expect(await activityTypes(memberA, ids[2])).toEqual(["created"]);

    // A to the top of Done.
    await memberA.mutation(api.issues.move, {
      issueId: ids[0],
      stateId: state("Done"),
      beforeRank: null,
      afterRank: null,
    });
    expect((await column("Todo")).map((i) => i.title)).toEqual(["C", "B"]);
    const done = await column("Done");
    expect(done.map((i) => i.title)).toEqual(["A"]);
    expect(done[0].completedAt).not.toBeNull();
    expect(await activityTypes(memberA, ids[0])).toEqual(["created", "state"]);

    await expect(
      memberA.mutation(api.issues.move, {
        issueId: ids[1],
        stateId: state("Todo"),
        beforeRank: todo[1].rank,
        afterRank: todo[0].rank,
      }),
    ).rejects.toThrow(/INVALID_INPUT/);
  });

  test("sub-issues: same team only, no cycles", async () => {
    const { adminA, memberA } = await setup();
    const eng = await createTeam(adminA, "ENG");
    const ops = await createTeam(adminA, "OPS");
    const parent = await memberA.mutation(api.issues.create, { teamId: eng.teamId, title: "P" });
    const child = await memberA.mutation(api.issues.create, {
      teamId: eng.teamId,
      title: "C",
      parentId: parent.issueId,
    });
    const subs = await memberA.query(api.issues.listSubIssues, { issueId: parent.issueId });
    expect(subs.map((i) => i.identifier)).toEqual([child.identifier]);

    await expect(
      memberA.mutation(api.issues.update, { issueId: parent.issueId, parentId: child.issueId }),
    ).rejects.toThrow(/INVALID_INPUT/);
    await expect(
      memberA.mutation(api.issues.update, { issueId: parent.issueId, parentId: parent.issueId }),
    ).rejects.toThrow(/INVALID_INPUT/);
    await expect(
      memberA.mutation(api.issues.create, {
        teamId: ops.teamId,
        title: "X",
        parentId: parent.issueId,
      }),
    ).rejects.toThrow(/INVALID_INPUT/);
  });

  test("archive hides an issue from lists; remove is admin-only and cleans up", async () => {
    const { t, adminA, memberA } = await setup();
    const { teamId } = await createTeam(adminA);
    const parent = await memberA.mutation(api.issues.create, { teamId, title: "P" });
    const child = await memberA.mutation(api.issues.create, {
      teamId,
      title: "C",
      parentId: parent.issueId,
    });
    const gone = await memberA.mutation(api.issues.create, { teamId, title: "Gone" });
    await memberA.mutation(api.comments.create, { issueId: parent.issueId, body: "Hi" });

    await memberA.mutation(api.issues.archive, { issueId: gone.issueId });
    const listed = await memberA.query(api.issues.listByTeam, { teamId, paginationOpts: PAGE });
    expect(listed.page.map((i) => i.title).sort()).toEqual(["C", "P"]);
    expect(await activityTypes(memberA, gone.issueId)).toEqual(["created", "archived"]);

    // The app's lists and board show top-level issues; sub-issues sit under their parent.
    const topLevel = await memberA.query(api.issues.listByTeam, { teamId, topLevel: true, paginationOpts: PAGE });
    expect(topLevel.page.map((i) => i.title)).toEqual(["P"]);
    const board = await memberA.query(api.issues.listForBoard, { teamId, topLevel: true });
    expect(board.flatMap((column) => column.issues).map((i) => i.title)).toEqual(["P"]);
    const filtered = await memberA.query(api.issues.listFiltered, {
      filter: { teamId },
      topLevel: true,
      paginationOpts: PAGE,
    });
    expect(filtered.page.map((i) => i.title)).toEqual(["P"]);
    expect((await memberA.query(api.issues.listSubIssues, { issueId: parent.issueId })).map((i) => i.title)).toEqual([
      "C",
    ]);

    await expect(
      memberA.mutation(api.issues.remove, { issueId: parent.issueId }),
    ).rejects.toThrow(/FORBIDDEN/);
    await adminA.mutation(api.issues.remove, { issueId: parent.issueId });
    await expect(
      memberA.query(api.issues.get, { identifier: parent.identifier }),
    ).rejects.toThrow(/NOT_FOUND/);
    expect(
      (await memberA.query(api.issues.get, { identifier: child.identifier })).parentId,
    ).toBeNull();
    // With its parent gone, the sub-issue is a top-level issue again.
    const orphaned = await memberA.query(api.issues.listByTeam, { teamId, topLevel: true, paginationOpts: PAGE });
    expect(orphaned.page.map((i) => i.title)).toEqual(["C"]);
    const leftovers = await t.run(async (ctx) => ({
      comments: await ctx.db
        .query("comments")
        .withIndex("by_issueId", (q) => q.eq("issueId", parent.issueId))
        .take(10),
      activities: await ctx.db
        .query("activities")
        .withIndex("by_issueId", (q) => q.eq("issueId", parent.issueId))
        .take(10),
    }));
    expect(leftovers).toEqual({ comments: [], activities: [] });
    // Numbers are never reused.
    expect((await memberA.mutation(api.issues.create, { teamId, title: "N" })).identifier).toBe(
      "ENG-4",
    );
  });
});

describe("comments", () => {
  test("author edits, author or admin deletes, each logged", async () => {
    const { t, adminA, memberA } = await setup();
    await join(t, ORG_A, "member_a2");
    const other = as(t, "member_a2", ORG_A);
    const { teamId } = await createTeam(adminA);
    const { issueId } = await memberA.mutation(api.issues.create, { teamId, title: "T" });
    const first = await memberA.mutation(api.comments.create, { issueId, body: " First " });
    const second = await memberA.mutation(api.comments.create, { issueId, body: "Second" });
    await expect(
      memberA.mutation(api.comments.create, { issueId, body: "  " }),
    ).rejects.toThrow(/INVALID_INPUT/);

    await expect(
      other.mutation(api.comments.update, { commentId: first, body: "Mine now" }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      adminA.mutation(api.comments.update, { commentId: first, body: "Mine now" }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      other.mutation(api.comments.remove, { commentId: first }),
    ).rejects.toThrow(/FORBIDDEN/);

    await memberA.mutation(api.comments.update, { commentId: first, body: "Edited" });
    await adminA.mutation(api.comments.remove, { commentId: second });

    const comments = await other.query(api.comments.list, { issueId, paginationOpts: PAGE });
    expect(comments.page).toHaveLength(1);
    expect(comments.page[0]).toMatchObject({ body: "Edited", authorId: "member_a" });
    expect(comments.page[0].editedAt).not.toBeNull();

    const feed = await other.query(api.activities.listForIssue, { issueId, paginationOpts: PAGE });
    expect(
      feed.page.filter((a) => a.type === "comment").map((a) => [a.actorId, a.to]),
    ).toEqual([
      ["admin_a", "deleted"],
      ["member_a", "edited"],
      ["member_a", "created"],
      ["member_a", "created"],
    ]);
  });
});

describe("workflow states and labels", () => {
  test("only admins change states; a state in use cannot be removed", async () => {
    const { adminA, memberA, adminB } = await setup();
    const { teamId, states, state } = await createTeam(adminA);
    await expect(
      memberA.mutation(api.workflowStates.create, {
        teamId,
        name: "Review",
        type: "started",
        color: "#123456",
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    const review = await adminA.mutation(api.workflowStates.create, {
      teamId,
      name: "Review",
      type: "started",
      color: "#123456",
    });
    await expect(
      adminB.mutation(api.workflowStates.update, { stateId: review, name: "Hacked" }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(
      adminA.mutation(api.workflowStates.update, { stateId: review, color: "red" }),
    ).rejects.toThrow(/INVALID_INPUT/);

    const order = [review, ...states.map((s) => s._id)];
    await adminA.mutation(api.workflowStates.reorder, { teamId, stateIds: order });
    expect(
      (await memberA.query(api.workflowStates.list, { teamId })).map((s) => s._id),
    ).toEqual(order);
    await expect(
      adminA.mutation(api.workflowStates.reorder, { teamId, stateIds: order.slice(1) }),
    ).rejects.toThrow(/INVALID_INPUT/);

    await memberA.mutation(api.issues.create, { teamId, title: "T", stateId: review });
    await expect(
      adminA.mutation(api.workflowStates.remove, { stateId: review }),
    ).rejects.toThrow(/INVALID_INPUT/);
    await adminA.mutation(api.workflowStates.remove, { stateId: state("Canceled") });
    expect(await memberA.query(api.workflowStates.list, { teamId })).toHaveLength(5);
  });

  test("labels are per org, admin-managed and unique by name", async () => {
    const { adminA, memberA, adminB, memberB } = await setup();
    await expect(
      memberA.mutation(api.labels.create, { name: "bug", color: "#ff0000" }),
    ).rejects.toThrow(/FORBIDDEN/);
    const bug = await adminA.mutation(api.labels.create, { name: "bug", color: "#FF0000" });
    await expect(
      adminA.mutation(api.labels.create, { name: "bug", color: "#00ff00" }),
    ).rejects.toThrow(/INVALID_INPUT/);
    await adminB.mutation(api.labels.create, { name: "bug", color: "#0000ff" });

    expect(await memberA.query(api.labels.list, {})).toMatchObject([
      { name: "bug", color: "#ff0000" },
    ]);
    expect(await memberB.query(api.labels.list, {})).toMatchObject([
      { name: "bug", color: "#0000ff" },
    ]);
    await expect(
      adminB.mutation(api.labels.update, { labelId: bug, name: "hacked" }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(adminB.mutation(api.labels.remove, { labelId: bug })).rejects.toThrow(
      /NOT_FOUND/,
    );
    await adminA.mutation(api.labels.remove, { labelId: bug });
    expect(await memberA.query(api.labels.list, {})).toEqual([]);
  });
});
