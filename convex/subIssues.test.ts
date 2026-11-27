/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ORG_A = "org_a";
const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 0, 5);

type T = ReturnType<typeof convexTest>;

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
    svixId: `msg_sub_${svixCounter}`,
    type: "organizationMembership.created",
    data: { role, organization: { id: orgId }, public_user_data: { user_id: userId } },
  });
}

/** Business plan for org A, so it can have private teams. */
async function setPlan(t: T) {
  await t.run(async (ctx) => {
    await ctx.db.insert("subscriptions", {
      orgId: ORG_A,
      clerkSubscriptionId: `sub_${ORG_A}`,
      planSlug: "business",
      status: "active",
      updatedAt: 1,
    });
  });
}

async function setup() {
  const t = convexTest(schema, modules);
  await join(t, ORG_A, "admin_a", "org:admin");
  await join(t, ORG_A, "member_a");
  const adminA = as(t, "admin_a", ORG_A, "admin");
  const memberA = as(t, "member_a", ORG_A);
  const teamId = await adminA.mutation(api.teams.create, { name: "Eng", key: "ENG" });
  const states = await adminA.query(api.workflowStates.list, { teamId });
  const state = (name: string) => states.find((s) => s.name === name)!._id;
  const projectId = await memberA.mutation(api.projects.create, { name: "Launch" });
  const cycleId = await memberA.mutation(api.cycles.create, { teamId, startsAt: START, endsAt: START + 14 * DAY });
  return { t, adminA, memberA, teamId, state, projectId, cycleId };
}

async function getIssue(t: T, issueId: Id<"issues">) {
  return (await t.run((ctx) => ctx.db.get("issues", issueId)))!;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sub-issues", () => {
  test("a new sub-issue takes its parent's assignee, project and cycle", async () => {
    const { t, memberA, teamId, projectId, cycleId } = await setup();
    const parent = await memberA.mutation(api.issues.create, {
      teamId,
      title: "Parent",
      assigneeId: "member_a",
      projectId,
      cycleId,
    });
    const child = await memberA.mutation(api.issues.create, { teamId, title: "Child", parentId: parent.issueId });
    const doc = await getIssue(t, child.issueId);
    expect(doc.assigneeId).toBe("member_a");
    expect(doc.projectId).toBe(projectId);
    expect(doc.cycleId).toBe(cycleId);
    expect((await memberA.query(api.projects.get, { projectId })).issueCount).toBe(2);
  });

  test("values the caller gives win, including null", async () => {
    const { t, memberA, teamId, projectId } = await setup();
    const parent = await memberA.mutation(api.issues.create, { teamId, title: "Parent", assigneeId: "member_a", projectId });
    const child = await memberA.mutation(api.issues.create, {
      teamId,
      title: "Child",
      parentId: parent.issueId,
      assigneeId: "admin_a",
      projectId: null,
    });
    const doc = await getIssue(t, child.issueId);
    expect(doc.assigneeId).toBe("admin_a");
    expect(doc.projectId).toBeNull();
  });

  test("an inherited value that no longer fits is dropped, not refused", async () => {
    const { t, memberA, teamId, cycleId } = await setup();
    const parent = await memberA.mutation(api.issues.create, { teamId, title: "Parent", cycleId });
    await t.run((ctx) => ctx.db.patch("cycles", cycleId, { status: "completed" }));
    const child = await memberA.mutation(api.issues.create, { teamId, title: "Child", parentId: parent.issueId });
    expect((await getIssue(t, child.issueId)).cycleId).toBeNull();
  });

  test("sub-issue progress counts toward the project", async () => {
    const { memberA, teamId, state, projectId } = await setup();
    const parent = await memberA.mutation(api.issues.create, { teamId, title: "Parent", projectId });
    const child = await memberA.mutation(api.issues.create, { teamId, title: "Child", parentId: parent.issueId });
    await memberA.mutation(api.issues.update, { issueId: child.issueId, stateId: state("Done") });
    const project = await memberA.query(api.projects.get, { projectId });
    expect([project.issueCount, project.completedIssueCount]).toEqual([2, 1]);
  });

  test("counts sub-issues for list rows, hiding what the caller can't see", async () => {
    const { t, adminA, memberA, teamId } = await setup();
    await join(t, "org_b", "admin_b", "org:admin");
    const adminB = as(t, "admin_b", "org_b", "admin");
    const parent = await memberA.mutation(api.issues.create, { teamId, title: "Parent" });
    const lone = await memberA.mutation(api.issues.create, { teamId, title: "Lone" });
    const a = await memberA.mutation(api.issues.create, { teamId, title: "A", parentId: parent.issueId });
    await memberA.mutation(api.issues.create, { teamId, title: "B", parentId: parent.issueId });
    await memberA.mutation(api.issues.create, { teamId, title: "A1", parentId: a.issueId });
    await memberA.mutation(api.issues.archive, { issueId: a.issueId });

    const counts = await memberA.query(api.issues.subIssueCounts, { issueIds: [parent.issueId, lone.issueId, a.issueId] });
    // A is archived, so the parent has one live sub-issue; A still counts its own child.
    expect(counts).toEqual([
      { issueId: parent.issueId, count: 1 },
      { issueId: a.issueId, count: 1 },
    ]);
    expect(await adminB.query(api.issues.subIssueCounts, { issueIds: [parent.issueId] })).toEqual([]);

    await setPlan(t);
    const secret = await adminA.mutation(api.teams.create, { name: "Secret", key: "SEC", isPrivate: true });
    const hidden = await adminA.mutation(api.issues.create, { teamId: secret, title: "Hidden" });
    await adminA.mutation(api.issues.create, { teamId: secret, title: "Child", parentId: hidden.issueId });
    expect(await memberA.query(api.issues.subIssueCounts, { issueIds: [hidden.issueId] })).toEqual([]);
    expect(await adminA.query(api.issues.subIssueCounts, { issueIds: [hidden.issueId] })).toHaveLength(1);
  });

  test("the backfill puts old sub-issues in their ancestor's project and cycle", async () => {
    const { t, memberA, teamId, projectId, cycleId } = await setup();
    const parent = await memberA.mutation(api.issues.create, { teamId, title: "Parent", projectId, cycleId });
    const child = await memberA.mutation(api.issues.create, { teamId, title: "Child", parentId: parent.issueId });
    const grandchild = await memberA.mutation(api.issues.create, { teamId, title: "Grandchild", parentId: child.issueId });
    // As they were before sub-issues inherited: no project, no cycle, not counted.
    await t.run(async (ctx) => {
      for (const id of [child.issueId, grandchild.issueId]) await ctx.db.patch("issues", id, { projectId: null, cycleId: null });
      await ctx.db.patch("projects", projectId, { issueCount: 1 });
    });

    await t.mutation(internal.subIssueBackfill.run, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    for (const id of [child.issueId, grandchild.issueId]) {
      const doc = await getIssue(t, id);
      expect([doc.projectId, doc.cycleId]).toEqual([projectId, cycleId]);
    }
    expect((await memberA.query(api.projects.get, { projectId })).issueCount).toBe(3);
    // A second run changes nothing.
    await t.mutation(internal.subIssueBackfill.run, {});
    expect((await memberA.query(api.projects.get, { projectId })).issueCount).toBe(3);
  });

  test("moving a parent to another project or cycle brings its sub-issues along", async () => {
    const { t, memberA, teamId, projectId, cycleId } = await setup();
    const other = await memberA.mutation(api.projects.create, { name: "Other" });
    const elsewhere = await memberA.mutation(api.projects.create, { name: "Elsewhere" });
    const parent = await memberA.mutation(api.issues.create, { teamId, title: "Parent", projectId });
    const child = await memberA.mutation(api.issues.create, { teamId, title: "Child", parentId: parent.issueId });
    const grandchild = await memberA.mutation(api.issues.create, { teamId, title: "Grandchild", parentId: child.issueId });
    const placed = await memberA.mutation(api.issues.create, {
      teamId,
      title: "Placed elsewhere",
      parentId: parent.issueId,
      projectId: elsewhere,
    });

    await memberA.mutation(api.issues.update, { issueId: parent.issueId, projectId: other, cycleId });

    expect((await getIssue(t, child.issueId)).projectId).toBe(other);
    expect((await getIssue(t, grandchild.issueId)).projectId).toBe(other);
    expect((await getIssue(t, grandchild.issueId)).cycleId).toBe(cycleId);
    expect((await getIssue(t, placed.issueId)).projectId).toBe(elsewhere);
    expect((await memberA.query(api.projects.get, { projectId })).issueCount).toBe(0);
    expect((await memberA.query(api.projects.get, { projectId: other })).issueCount).toBe(3);
    const activity = await memberA.query(api.activities.listForIssue, {
      issueId: child.issueId,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(activity.page.some((entry) => entry.type === "project")).toBe(true);
  });
});
