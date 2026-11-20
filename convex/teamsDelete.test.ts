/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const ORG_A = "org_a";
const ORG_B = "org_b";

const newTest = () => convexTest(schema, modules);
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
    svixId: `msg_td_${svixCounter}`,
    type: "organizationMembership.created",
    data: { role, organization: { id: orgId }, public_user_data: { user_id: userId } },
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
  const teamId = await adminA.mutation(api.teams.create, { name: "Eng", key: "ENG" });
  const otherId = await adminA.mutation(api.teams.create, { name: "Ops", key: "OPS" });
  return { t, adminA, memberA, adminB, teamId, otherId };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("unarchive", () => {
  test("brings an archived team back", async () => {
    const { adminA, teamId } = await setup();
    await adminA.mutation(api.teams.archive, { teamId });
    expect((await adminA.query(api.teams.list, {})).map((team) => team.key)).toEqual(["OPS"]);
    await adminA.mutation(api.teams.unarchive, { teamId });
    expect((await adminA.query(api.teams.list, {})).map((team) => team.key)).toEqual(["ENG", "OPS"]);
  });

  test("needs teams.manage and stays inside the org", async () => {
    const { adminA, memberA, adminB, teamId } = await setup();
    await adminA.mutation(api.teams.archive, { teamId });
    await expect(memberA.mutation(api.teams.unarchive, { teamId })).rejects.toThrow(/FORBIDDEN/);
    await expect(adminB.mutation(api.teams.unarchive, { teamId })).rejects.toThrow();
  });
});

describe("remove", () => {
  test("refuses active teams, wrong keys, members and other orgs", async () => {
    const { adminA, memberA, adminB, teamId } = await setup();
    await expect(adminA.mutation(api.teams.remove, { teamId, confirmKey: "ENG" })).rejects.toThrow(
      /INVALID_INPUT/,
    );
    await adminA.mutation(api.teams.archive, { teamId });
    await expect(adminA.mutation(api.teams.remove, { teamId, confirmKey: "OPS" })).rejects.toThrow(
      /INVALID_INPUT/,
    );
    await expect(memberA.mutation(api.teams.remove, { teamId, confirmKey: "ENG" })).rejects.toThrow(
      /FORBIDDEN/,
    );
    await expect(adminB.mutation(api.teams.remove, { teamId, confirmKey: "ENG" })).rejects.toThrow();
  });

  test("deletes the team and everything in it, and nothing else", async () => {
    const { t, adminA, teamId, otherId } = await setup();
    const projectId = await adminA.mutation(api.projects.create, { name: "Launch" });
    const { issueId: parent } = await adminA.mutation(api.issues.create, { teamId, title: "Parent", projectId });
    await adminA.mutation(api.issues.create, { teamId, title: "Child", parentId: parent });
    const { issueId: kept } = await adminA.mutation(api.issues.create, {
      teamId: otherId,
      title: "Kept",
      projectId,
    });
    await adminA.mutation(api.comments.create, { issueId: parent, body: "A comment" });
    await adminA.mutation(api.savedViews.create, { name: "Eng only", filter: { teamId } });
    await adminA.mutation(api.savedViews.create, { name: "Ops only", filter: { teamId: otherId } });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await adminA.mutation(api.teams.archive, { teamId });
    await adminA.mutation(api.teams.remove, { teamId, confirmKey: "ENG" });
    // Gone at once, before the cleanup runs.
    await expect(adminA.query(api.teams.get, { key: "ENG" })).rejects.toThrow(/NOT_FOUND/);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await t.run(async (ctx) => {
      expect(await ctx.db.get("teams", teamId)).toBeNull();
      const issues = await ctx.db.query("issues").take(10);
      expect(issues.map((issue) => issue._id)).toEqual([kept]);
      expect(await ctx.db.query("comments").take(10)).toHaveLength(0);
      const states = await ctx.db
        .query("workflowStates")
        .withIndex("by_teamId_and_position", (q) => q.eq("teamId", teamId))
        .take(10);
      expect(states).toHaveLength(0);
      const views = await ctx.db.query("savedViews").take(10);
      expect(views.map((view) => view.name)).toEqual(["Ops only"]);
      const project = await ctx.db.get("projects", projectId);
      expect(project?.teamIds).toEqual([otherId]);
      expect(project?.issueCount).toBe(1);
    });
    const log = await t.run((ctx) => ctx.db.query("auditLogs").take(50));
    expect(log.some((entry) => entry.action === "team.deleted")).toBe(true);
    // The key is free again.
    await adminA.mutation(api.teams.create, { name: "Eng again", key: "ENG" });
  });
});
