/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ORG_A = "org_a";
const ORG_B = "org_b";
const PAGE = { numItems: 100, cursor: null };
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
    svixId: `msg_pc_${svixCounter}`,
    type: "organizationMembership.created",
    data: { role, organization: { id: orgId }, public_user_data: { user_id: userId } },
  });
}

async function setup() {
  const t = convexTest(schema, modules);
  await join(t, ORG_A, "admin_a", "org:admin");
  await join(t, ORG_A, "member_a");
  await join(t, ORG_B, "admin_b", "org:admin");
  const adminA = as(t, "admin_a", ORG_A, "admin");
  const memberA = as(t, "member_a", ORG_A);
  const adminB = as(t, "admin_b", ORG_B, "admin");
  const teamId = await adminA.mutation(api.teams.create, { name: "Eng", key: "ENG" });
  const states = await adminA.query(api.workflowStates.list, { teamId });
  const state = (name: string) => states.find((s) => s.name === name)!._id;
  return { t, adminA, memberA, adminB, teamId, state };
}

type Caller = ReturnType<typeof as>;

async function counts(caller: Caller, projectId: Id<"projects">) {
  const project = await caller.query(api.projects.get, { projectId });
  return [project.issueCount, project.completedIssueCount];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("projects", () => {
  test("members create projects; leads must be org members", async () => {
    const { memberA } = await setup();
    const projectId = await memberA.mutation(api.projects.create, { name: "Launch" });
    const project = await memberA.query(api.projects.get, { projectId });
    expect(project.status).toBe("planned");
    expect(await memberA.query(api.projects.list, {})).toHaveLength(1);
    await expect(
      memberA.mutation(api.projects.create, { name: "X", leadId: "admin_b" }),
    ).rejects.toThrow(/INVALID_INPUT/);
    await expect(
      memberA.mutation(api.projects.create, { name: "X", startDate: 10, targetDate: 5 }),
    ).rejects.toThrow(/INVALID_INPUT/);
  });

  test("counts stay right across create, complete, move, archive and remove", async () => {
    const { adminA, memberA, teamId, state } = await setup();
    const p1 = await memberA.mutation(api.projects.create, { name: "One" });
    const p2 = await memberA.mutation(api.projects.create, { name: "Two" });

    const a = await memberA.mutation(api.issues.create, { teamId, title: "A", projectId: p1 });
    const b = await memberA.mutation(api.issues.create, { teamId, title: "B", projectId: p1 });
    expect(await counts(memberA, p1)).toEqual([2, 0]);
    expect((await memberA.query(api.projects.get, { projectId: p1 })).teamIds).toEqual([
      teamId,
    ]);

    await memberA.mutation(api.issues.update, { issueId: a.issueId, stateId: state("Done") });
    expect(await counts(memberA, p1)).toEqual([2, 1]);

    await memberA.mutation(api.issues.move, {
      issueId: a.issueId,
      stateId: state("In Progress"),
      beforeRank: null,
      afterRank: null,
    });
    expect(await counts(memberA, p1)).toEqual([2, 0]);

    // Canceled issues leave the progress counts.
    await memberA.mutation(api.issues.update, { issueId: b.issueId, stateId: state("Canceled") });
    expect(await counts(memberA, p1)).toEqual([1, 0]);

    await memberA.mutation(api.issues.update, {
      issueId: a.issueId,
      stateId: state("Done"),
      projectId: p2,
    });
    expect(await counts(memberA, p1)).toEqual([0, 0]);
    expect(await counts(memberA, p2)).toEqual([1, 1]);

    await memberA.mutation(api.issues.archive, { issueId: a.issueId });
    expect(await counts(memberA, p2)).toEqual([0, 0]);

    const c = await memberA.mutation(api.issues.create, { teamId, title: "C", projectId: p2 });
    expect(await counts(memberA, p2)).toEqual([1, 0]);
    await adminA.mutation(api.issues.remove, { issueId: c.issueId });
    expect(await counts(memberA, p2)).toEqual([0, 0]);
  });

  test("project activity is logged and listIssues returns the project's issues", async () => {
    const { memberA, teamId } = await setup();
    const projectId = await memberA.mutation(api.projects.create, { name: "Launch" });
    const { issueId } = await memberA.mutation(api.issues.create, { teamId, title: "A" });
    await memberA.mutation(api.issues.update, { issueId, projectId });
    const feed = await memberA.query(api.activities.listForIssue, {
      issueId,
      paginationOpts: PAGE,
    });
    expect(feed.page[0]).toMatchObject({ type: "project", from: null, to: "Launch" });
    const issues = await memberA.query(api.projects.listIssues, {
      projectId,
      paginationOpts: PAGE,
    });
    expect(issues.page.map((i) => i.title)).toEqual(["A"]);
  });

  test("removing a project deletes its issues and nothing else", async () => {
    const { t, adminA, memberA, teamId } = await setup();
    const projectId = await memberA.mutation(api.projects.create, { name: "Launch" });
    const otherProject = await memberA.mutation(api.projects.create, { name: "Other" });
    const inProject = await memberA.mutation(api.issues.create, { teamId, title: "A", projectId });
    await memberA.mutation(api.comments.create, { issueId: inProject.issueId, body: "Hi" });
    const elsewhere = await memberA.mutation(api.issues.create, {
      teamId,
      title: "Child elsewhere",
      projectId: otherProject,
      parentId: inProject.issueId,
    });
    const loose = await memberA.mutation(api.issues.create, { teamId, title: "No project" });

    // A member without issues.delete can't delete issues by deleting their project.
    await expect(memberA.mutation(api.projects.remove, { projectId })).rejects.toThrow(/FORBIDDEN/);
    await adminA.mutation(api.projects.remove, { projectId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await expect(memberA.query(api.projects.get, { projectId })).rejects.toThrow(/NOT_FOUND/);
    await expect(memberA.query(api.issues.get, { identifier: inProject.identifier })).rejects.toThrow(
      /NOT_FOUND/,
    );
    const comments = await t.run((ctx) =>
      ctx.db
        .query("comments")
        .withIndex("by_issueId", (q) => q.eq("issueId", inProject.issueId))
        .take(10),
    );
    expect(comments).toEqual([]);
    // Issues outside the project stay; a sub-issue elsewhere only loses its parent.
    const child = await memberA.query(api.issues.get, { identifier: elsewhere.identifier });
    expect(child).toMatchObject({ projectId: otherProject, parentId: null });
    expect((await memberA.query(api.issues.get, { identifier: loose.identifier })).title).toBe("No project");
    const audit = await t.run((ctx) => ctx.db.query("auditLogs").take(50));
    expect(audit.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(["project.deleted", "issue.deleted"]),
    );

    // An empty project needs only projects.manage.
    const empty = await memberA.mutation(api.projects.create, { name: "Empty" });
    await memberA.mutation(api.projects.remove, { projectId: empty });
    await expect(memberA.query(api.projects.get, { projectId: empty })).rejects.toThrow(/NOT_FOUND/);
  });

  test("the orphan repair deletes only issues whose project is gone", async () => {
    const { t, memberA, teamId } = await setup();
    const liveProject = await memberA.mutation(api.projects.create, { name: "Live" });
    const goneProject = await memberA.mutation(api.projects.create, { name: "Gone" });
    const live = await memberA.mutation(api.issues.create, { teamId, title: "Live", projectId: liveProject });
    const loose = await memberA.mutation(api.issues.create, { teamId, title: "Loose" });
    const orphan = await memberA.mutation(api.issues.create, { teamId, title: "Orphan", projectId: goneProject });
    // Deleted behind the app's back, as happened in production.
    await t.run((ctx) => ctx.db.delete("projects", goneProject));

    const dry = await t.mutation(internal.projects.deleteOrphanedIssues, { orgId: ORG_A, dryRun: true });
    expect(dry).toMatchObject({ scanned: 3, deleted: 0 });
    expect(dry.orphans.map((o) => o.identifier)).toEqual([orphan.identifier]);
    expect((await memberA.query(api.issues.get, { identifier: orphan.identifier })).title).toBe("Orphan");

    // Another org's run sees none of these.
    expect(
      (await t.mutation(internal.projects.deleteOrphanedIssues, { orgId: ORG_B, dryRun: false })).orphans,
    ).toEqual([]);

    const real = await t.mutation(internal.projects.deleteOrphanedIssues, { orgId: ORG_A, dryRun: false });
    expect(real.deleted).toBe(1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(memberA.query(api.issues.get, { identifier: orphan.identifier })).rejects.toThrow(/NOT_FOUND/);
    expect((await memberA.query(api.issues.get, { identifier: live.identifier })).title).toBe("Live");
    expect((await memberA.query(api.issues.get, { identifier: loose.identifier })).title).toBe("Loose");
    // Running it again finds nothing.
    expect(
      (await t.mutation(internal.projects.deleteOrphanedIssues, { orgId: ORG_A, dryRun: true })).orphans,
    ).toEqual([]);
  });

  test("another org cannot read, change or use a project", async () => {
    const { adminA, adminB } = await setup();
    const projectId = await adminA.mutation(api.projects.create, { name: "Secret" });
    await expect(adminB.query(api.projects.get, { projectId })).rejects.toThrow(/NOT_FOUND/);
    await expect(
      adminB.query(api.projects.listIssues, { projectId, paginationOpts: PAGE }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(
      adminB.mutation(api.projects.update, { projectId, name: "Mine" }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(adminB.mutation(api.projects.remove, { projectId })).rejects.toThrow(
      /NOT_FOUND/,
    );
    expect(await adminB.query(api.projects.list, {})).toHaveLength(0);
    const teamB = await adminB.mutation(api.teams.create, { name: "Eng", key: "ENG" });
    await expect(
      adminB.mutation(api.issues.create, { teamId: teamB, title: "X", projectId }),
    ).rejects.toThrow(/NOT_FOUND/);
  });
});

describe("cycles", () => {
  test("cycles are numbered per team and overlaps are rejected", async () => {
    const { memberA, teamId } = await setup();
    const first = await memberA.mutation(api.cycles.create, {
      teamId,
      startsAt: START,
      endsAt: START + 14 * DAY,
    });
    const second = await memberA.mutation(api.cycles.create, {
      teamId,
      startsAt: START + 14 * DAY,
      endsAt: START + 28 * DAY,
    });
    expect((await memberA.query(api.cycles.get, { teamId, number: 1 }))._id).toBe(first);
    const two = await memberA.query(api.cycles.get, { teamId, number: 2 });
    expect(two).toMatchObject({ _id: second, name: "Cycle 2", status: "upcoming" });
    expect((await memberA.query(api.cycles.get, { teamId, number: 1 })).status).toBe("active");

    for (const [startsAt, endsAt] of [
      [START + 7 * DAY, START + 20 * DAY],
      [START + 20 * DAY, START + 30 * DAY],
      [START - DAY, START + 40 * DAY],
    ]) {
      await expect(
        memberA.mutation(api.cycles.create, { teamId, startsAt, endsAt }),
      ).rejects.toThrow(/INVALID_INPUT/);
    }
    await expect(
      memberA.mutation(api.cycles.update, { cycleId: second, startsAt: START + 13 * DAY }),
    ).rejects.toThrow(/INVALID_INPUT/);
    // Moving a cycle within its own old range is not an overlap with itself.
    await memberA.mutation(api.cycles.update, {
      cycleId: second,
      startsAt: START + 15 * DAY,
      endsAt: START + 27 * DAY,
    });
    await expect(
      memberA.mutation(api.cycles.create, {
        teamId,
        startsAt: START - 10 * DAY,
        endsAt: START - DAY,
      }),
    ).rejects.toThrow(/INVALID_INPUT/);
  });

  test("an issue's cycle must be an open cycle of its team", async () => {
    const { adminA, memberA, teamId } = await setup();
    const otherTeam = await adminA.mutation(api.teams.create, { name: "Ops", key: "OPS" });
    const otherCycle = await memberA.mutation(api.cycles.create, {
      teamId: otherTeam,
      startsAt: START,
      endsAt: START + DAY,
    });
    await expect(
      memberA.mutation(api.issues.create, { teamId, title: "A", cycleId: otherCycle }),
    ).rejects.toThrow(/INVALID_INPUT/);
  });

  test("rollover moves only unfinished issues to the next cycle", async () => {
    const { t, memberA, teamId, state } = await setup();
    const current = await memberA.mutation(api.cycles.create, {
      teamId,
      startsAt: START,
      endsAt: START + 14 * DAY,
    });
    const next = await memberA.mutation(api.cycles.create, {
      teamId,
      startsAt: START + 14 * DAY,
      endsAt: START + 28 * DAY,
    });
    const open = await memberA.mutation(api.issues.create, {
      teamId,
      title: "Open",
      cycleId: current,
    });
    const done = await memberA.mutation(api.issues.create, {
      teamId,
      title: "Done",
      cycleId: current,
      stateId: state("Done"),
    });
    const canceled = await memberA.mutation(api.issues.create, {
      teamId,
      title: "Canceled",
      cycleId: current,
      stateId: state("Canceled"),
    });

    vi.setSystemTime(START + 14 * DAY + 1);
    await t.mutation(internal.cycles.rollover, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect((await memberA.query(api.cycles.get, { teamId, number: 1 })).status).toBe(
      "completed",
    );
    expect((await memberA.query(api.cycles.get, { teamId, number: 2 })).status).toBe("active");
    const cycleOf = async (identifier: string) =>
      (await memberA.query(api.issues.get, { identifier })).cycleId;
    expect(await cycleOf(open.identifier)).toBe(next);
    expect(await cycleOf(done.identifier)).toBe(current);
    expect(await cycleOf(canceled.identifier)).toBe(current);

    const feed = await memberA.query(api.activities.listForIssue, {
      issueId: open.issueId,
      paginationOpts: PAGE,
    });
    expect(feed.page[0]).toMatchObject({
      type: "cycle",
      actorId: "system",
      from: "Cycle 1",
      to: "Cycle 2",
    });
  });

  test("with no next cycle, unfinished issues leave the cycle", async () => {
    const { t, memberA, teamId } = await setup();
    const cycleId = await memberA.mutation(api.cycles.create, {
      teamId,
      startsAt: START,
      endsAt: START + DAY,
    });
    const { identifier } = await memberA.mutation(api.issues.create, {
      teamId,
      title: "Open",
      cycleId,
    });
    vi.setSystemTime(START + 2 * DAY);
    await t.mutation(internal.cycles.rollover, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await memberA.query(api.issues.get, { identifier })).cycleId).toBeNull();
    await expect(
      memberA.mutation(api.issues.create, { teamId, title: "Late", cycleId }),
    ).rejects.toThrow(/INVALID_INPUT/);
  });

  test("another org cannot see or change a team's cycles", async () => {
    const { adminB, memberA, teamId } = await setup();
    const cycleId = await memberA.mutation(api.cycles.create, {
      teamId,
      startsAt: START,
      endsAt: START + DAY,
    });
    await expect(adminB.query(api.cycles.list, { teamId })).rejects.toThrow(/NOT_FOUND/);
    await expect(adminB.query(api.cycles.get, { teamId, number: 1 })).rejects.toThrow(
      /NOT_FOUND/,
    );
    await expect(
      adminB.query(api.cycles.listIssues, { cycleId, paginationOpts: PAGE }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(
      adminB.mutation(api.cycles.update, { cycleId, name: "Mine" }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(
      adminB.mutation(api.cycles.create, { teamId, startsAt: START + 5 * DAY, endsAt: START + 6 * DAY }),
    ).rejects.toThrow(/NOT_FOUND/);
  });
});
