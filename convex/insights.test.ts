/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ORG_A = "org_a";
const ORG_B = "org_b";
const DAY = 24 * 60 * 60 * 1000;
// A Monday, so week buckets start on it.
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
    svixId: `msg_in_${svixCounter}`,
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
  const t = convexTest(schema, modules);
  await join(t, ORG_A, "admin_a", "org:admin");
  await join(t, ORG_A, "member_a");
  await join(t, ORG_B, "admin_b", "org:admin");
  await setPlan(t, ORG_A, "business");
  const adminA = as(t, "admin_a", ORG_A, "admin");
  const memberA = as(t, "member_a", ORG_A);
  const adminB = as(t, "admin_b", ORG_B, "admin");
  const teamId = await adminA.mutation(api.teams.create, { name: "Eng", key: "ENG" });
  const states = await adminA.query(api.workflowStates.list, { teamId });
  const state = (name: string) => states.find((s) => s.name === name)!._id;
  return { t, adminA, memberA, adminB, teamId, state };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("team insights", () => {
  test("buckets created and completed issues by week, with open work and cycle time", async () => {
    const { memberA, teamId, state } = await setup();
    const a = await memberA.mutation(api.issues.create, { teamId, title: "A", assigneeId: "member_a" });
    await memberA.mutation(api.issues.create, { teamId, title: "B" });
    vi.setSystemTime(START + 1.5 * DAY);
    await memberA.mutation(api.issues.update, { issueId: a.issueId, stateId: state("Done") });
    vi.setSystemTime(START + 8 * DAY);
    await memberA.mutation(api.issues.create, { teamId, title: "C", stateId: state("In Progress") });

    const result = await memberA.query(api.insights.team, { teamId, now: START + 8 * DAY });
    expect(result.weeks).toHaveLength(12);
    const [previous, last] = result.weeks.slice(-2);
    expect(previous).toEqual({ start: START, completed: 1, created: 2 });
    expect(last).toEqual({ start: START + 7 * DAY, completed: 0, created: 1 });

    const open = Object.fromEntries(result.openByState.map((row) => [row.name, row.count]));
    expect(open["In Progress"]).toBe(1);
    expect(result.openByState.reduce((sum, row) => sum + row.count, 0)).toBe(2);
    expect(result.openByState.some((row) => row.type === "completed")).toBe(false);
    expect(result.openByAssignee).toEqual([{ assigneeId: null, count: 2 }]);

    expect(result.cycleTime.sample).toBe(1);
    expect(result.cycleTime.medianDays).toBe(1.5);
    expect(result.cycleTime.buckets.find((b) => b.label === "1-2d")!.count).toBe(1);
    expect(result.truncated).toBe(false);
  });

  test("another org's team and a private team you're not in look missing", async () => {
    const { adminA, memberA, adminB, teamId } = await setup();
    await expect(adminB.query(api.insights.team, { teamId, now: START })).rejects.toThrow(/NOT_FOUND/);
    const secret = await adminA.mutation(api.teams.create, { name: "Secret", key: "SEC", isPrivate: true });
    await expect(memberA.query(api.insights.team, { teamId: secret, now: START })).rejects.toThrow(/NOT_FOUND/);
    await expect(adminA.query(api.insights.team, { teamId: secret, now: START })).resolves.toBeDefined();
  });

  test("refuses a bad clock value", async () => {
    const { memberA, teamId } = await setup();
    await expect(memberA.query(api.insights.team, { teamId, now: Number.NaN })).rejects.toThrow(/INVALID_INPUT/);
  });
});

describe("project insights", () => {
  test("burn-up counts scope and done per day, with a pace line to the target", async () => {
    const { memberA, adminB, teamId, state } = await setup();
    const projectId = await memberA.mutation(api.projects.create, {
      name: "Launch",
      startDate: START,
      targetDate: START + 4 * DAY,
    });
    const a = await memberA.mutation(api.issues.create, { teamId, title: "A", projectId, estimate: 3 });
    await memberA.mutation(api.issues.create, { teamId, title: "B", projectId, estimate: 2 });
    vi.setSystemTime(START + DAY);
    await memberA.mutation(api.issues.update, { issueId: a.issueId, stateId: state("Done") });
    const c = await memberA.mutation(api.issues.create, { teamId, title: "C", projectId });
    await memberA.mutation(api.issues.update, { issueId: c.issueId, stateId: state("Canceled") });

    const result = await memberA.query(api.insights.project, { projectId, now: START + DAY });
    expect(result.points.map((p) => p.t)).toEqual([0, 1, 2, 3, 4].map((d) => START + d * DAY));
    expect(result.points[0]).toMatchObject({ scope: 2, done: 0 });
    expect(result.points[1]).toMatchObject({ scope: 2, done: 1 });
    // Future days have no actuals, only the pace line, which reaches the scope at the target.
    expect(result.points[2]).toMatchObject({ scope: null, done: null });
    expect(result.points[4].pace).toBe(2);
    // New issues start in Todo (unstarted).
    expect(result.byState).toEqual({ backlog: 0, unstarted: 1, started: 0, completed: 1, canceled: 1 });
    expect(result.estimate).toEqual({ done: 3, total: 5 });

    await expect(adminB.query(api.insights.project, { projectId, now: START })).rejects.toThrow(/NOT_FOUND/);
  });

  test("leaves out issues of private teams the caller is not in", async () => {
    const { adminA, memberA, teamId } = await setup();
    const secret = await adminA.mutation(api.teams.create, { name: "Secret", key: "SEC", isPrivate: true });
    const projectId = await adminA.mutation(api.projects.create, { name: "Launch" });
    await adminA.mutation(api.issues.create, { teamId, title: "Open", projectId });
    await adminA.mutation(api.issues.create, { teamId: secret, title: "Hidden", projectId });
    const forMember = await memberA.query(api.insights.project, { projectId, now: START });
    const forAdmin = await adminA.query(api.insights.project, { projectId, now: START });
    expect(forMember.points.at(-1)!.scope).toBe(1);
    expect(forAdmin.points.at(-1)!.scope).toBe(2);
  });

  test("sparklines count completions per week for each project", async () => {
    const { memberA, adminB, teamId, state } = await setup();
    const projectId = await memberA.mutation(api.projects.create, { name: "Launch" });
    const a = await memberA.mutation(api.issues.create, { teamId, title: "A", projectId });
    await memberA.mutation(api.issues.update, { issueId: a.issueId, stateId: state("Done") });
    const rows = await memberA.query(api.insights.projectSparklines, { now: START });
    expect(rows).toEqual([{ projectId, weeks: [...Array(11).fill(0), 1] }]);
    expect(await adminB.query(api.insights.projectSparklines, { now: START })).toEqual([]);
  });
});

describe("cycle insights", () => {
  test("burndown counts remaining issues per day against an ideal line", async () => {
    const { memberA, teamId, state } = await setup();
    const cycleId = await memberA.mutation(api.cycles.create, {
      teamId,
      startsAt: START,
      endsAt: START + 4 * DAY,
    });
    const a = await memberA.mutation(api.issues.create, { teamId, title: "A", cycleId });
    await memberA.mutation(api.issues.create, { teamId, title: "B", cycleId, estimate: 5 });
    vi.setSystemTime(START + DAY);
    await memberA.mutation(api.issues.update, { issueId: a.issueId, stateId: state("Done") });

    const result = await memberA.query(api.insights.cycle, { cycleId, now: START + DAY });
    expect(result.points).toHaveLength(4);
    expect(result.points.map((p) => p.remaining)).toEqual([2, 1, null, null]);
    expect(result.points.map((p) => p.ideal)).toEqual([1.5, 1, 0.5, 0]);
    expect(result).toMatchObject({ total: 2, completed: 1, estimate: { done: 0, total: 5 } });
  });
});

describe("my insights", () => {
  test("counts only the caller's completed issues", async () => {
    const { memberA, adminA, teamId, state } = await setup();
    const mine = await memberA.mutation(api.issues.create, { teamId, title: "Mine", assigneeId: "member_a" });
    const theirs = await memberA.mutation(api.issues.create, { teamId, title: "Theirs", assigneeId: "admin_a" });
    await memberA.mutation(api.issues.update, { issueId: mine.issueId, stateId: state("Done") });
    await memberA.mutation(api.issues.update, { issueId: theirs.issueId, stateId: state("Done") });
    const result = await memberA.query(api.insights.mine, { now: START });
    expect(result.weeks).toHaveLength(8);
    expect(result.weeks.at(-1)).toEqual({ start: START, completed: 1 });
    expect((await adminA.query(api.insights.mine, { now: START })).weeks.at(-1)!.completed).toBe(1);
  });
});
