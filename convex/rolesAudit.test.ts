/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ORG_A = "org_a";
const ORG_B = "org_b";
const PAGE = { numItems: 100, cursor: null };

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
    svixId: `msg_ra_${svixCounter}`,
    type: "organizationMembership.created",
    data: { role, organization: { id: orgId }, public_user_data: { user_id: userId } },
  });
}

async function setPlan(t: T, orgId: string, planSlug: string) {
  await t.run(async (ctx) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .unique();
    if (existing !== null) {
      await ctx.db.patch("subscriptions", existing._id, { planSlug });
      return;
    }
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
  if (plan !== null) {
    await setPlan(t, ORG_A, plan);
  }
  const adminA = as(t, "admin_a", ORG_A, "admin");
  const memberA = as(t, "member_a", ORG_A);
  const adminB = as(t, "admin_b", ORG_B, "admin");
  const eng = await adminA.mutation(api.teams.create, { name: "Eng", key: "ENG" });
  return { t, adminA, memberA, adminB, eng };
}

describe("permissions", () => {
  test("members get the defaults, admins get everything", async () => {
    const { adminA, memberA, eng } = await setup(null);
    // Defaults include projects.manage but not labels.manage or issues.delete.
    await memberA.mutation(api.projects.create, { name: "Launch" });
    await expect(
      memberA.mutation(api.labels.create, { name: "Bug", color: "#ff0000" }),
    ).rejects.toThrow(/FORBIDDEN/);
    const { issueId } = await memberA.mutation(api.issues.create, { teamId: eng, title: "A" });
    await expect(memberA.mutation(api.issues.remove, { issueId })).rejects.toThrow(/FORBIDDEN/);
    await adminA.mutation(api.labels.create, { name: "Bug", color: "#ff0000" });
    await adminA.mutation(api.issues.remove, { issueId });
  });

  test("a custom role replaces the member defaults", async () => {
    const { adminA, memberA, eng } = await setup();
    const roleId = await adminA.mutation(api.roles.create, {
      name: "Triager",
      permissions: ["issues.delete", "labels.manage"],
    });
    await adminA.mutation(api.roles.assign, { userId: "member_a", roleId });

    await memberA.mutation(api.labels.create, { name: "Bug", color: "#ff0000" });
    const { issueId } = await memberA.mutation(api.issues.create, { teamId: eng, title: "A" });
    await memberA.mutation(api.issues.remove, { issueId });
    // The role does not list projects.manage, so the default no longer applies.
    await expect(memberA.mutation(api.projects.create, { name: "Launch" })).rejects.toThrow(
      /FORBIDDEN/,
    );
  });

  test("custom roles stop applying when the plan loses the feature", async () => {
    const { t, adminA, memberA } = await setup();
    const roleId = await adminA.mutation(api.roles.create, {
      name: "Labeler",
      permissions: ["labels.manage"],
    });
    await adminA.mutation(api.roles.assign, { userId: "member_a", roleId });
    await memberA.mutation(api.labels.create, { name: "Bug", color: "#ff0000" });

    await setPlan(t, ORG_A, "pro");
    await expect(
      memberA.mutation(api.labels.create, { name: "Docs", color: "#00ff00" }),
    ).rejects.toThrow(/FORBIDDEN/);
    await memberA.mutation(api.projects.create, { name: "Launch" });
  });

  test("deleting a role sends its members back to the defaults", async () => {
    const { adminA, memberA } = await setup();
    const roleId = await adminA.mutation(api.roles.create, {
      name: "Labeler",
      permissions: ["labels.manage"],
    });
    await adminA.mutation(api.roles.assign, { userId: "member_a", roleId });
    await adminA.mutation(api.roles.remove, { roleId });
    await expect(
      memberA.mutation(api.labels.create, { name: "Bug", color: "#ff0000" }),
    ).rejects.toThrow(/FORBIDDEN/);
    await memberA.mutation(api.projects.create, { name: "Launch" });
  });
});

describe("private teams on projects", () => {
  test("a project does not reveal private teams the caller is not in", async () => {
    const { adminA, memberA, eng } = await setup();
    const secret = await adminA.mutation(api.teams.create, {
      name: "Secret",
      key: "SEC",
      isPrivate: true,
    });
    const projectId = await adminA.mutation(api.projects.create, { name: "Launch" });
    await adminA.mutation(api.issues.create, { teamId: eng, title: "Open", projectId });
    await adminA.mutation(api.issues.create, { teamId: secret, title: "Hidden", projectId });

    expect((await adminA.query(api.projects.get, { projectId })).teamIds.sort()).toEqual(
      [eng, secret].sort(),
    );
    expect((await memberA.query(api.projects.get, { projectId })).teamIds).toEqual([eng]);
    const [listed] = await memberA.query(api.projects.list, {});
    expect(listed.teamIds).toEqual([eng]);
  });
});

describe("custom roles", () => {
  test("only admins on a plan with custom_roles can manage roles", async () => {
    const free = await setup(null);
    await expect(free.adminA.query(api.roles.list, {})).rejects.toThrow(/FEATURE_NOT_IN_PLAN/);

    const { adminA, memberA } = await setup();
    await expect(memberA.query(api.roles.list, {})).rejects.toThrow(/FORBIDDEN/);
    await expect(
      memberA.mutation(api.roles.create, { name: "Mine", permissions: ["teams.manage"] }),
    ).rejects.toThrow(/FORBIDDEN/);
    expect(await adminA.query(api.roles.list, {})).toEqual([]);
  });

  test("role names are unique and roles stay inside their org", async () => {
    const { t, adminA, adminB } = await setup();
    await setPlan(t, ORG_B, "business");
    const roleId = await adminA.mutation(api.roles.create, {
      name: "Triager",
      permissions: ["issues.delete"],
    });
    await expect(
      adminA.mutation(api.roles.create, { name: "Triager", permissions: [] }),
    ).rejects.toThrow(/INVALID_INPUT/);
    expect(await adminB.query(api.roles.list, {})).toEqual([]);
    await expect(
      adminB.mutation(api.roles.update, { roleId, name: "Taken" }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(adminB.mutation(api.roles.remove, { roleId })).rejects.toThrow(/NOT_FOUND/);
    await expect(
      adminA.mutation(api.roles.assign, { userId: "admin_b", roleId }),
    ).rejects.toThrow(/NOT_FOUND/);
  });
});

describe("audit log", () => {
  test("org-level changes are recorded, newest first", async () => {
    const { adminA, eng, memberA } = await setup();
    const roleId = await adminA.mutation(api.roles.create, {
      name: "Triager",
      permissions: ["issues.delete"],
    });
    await adminA.mutation(api.roles.assign, { userId: "member_a", roleId });
    const { issueId } = await memberA.mutation(api.issues.create, { teamId: eng, title: "Gone" });
    await memberA.mutation(api.issues.remove, { issueId });

    const log = await adminA.query(api.auditLogs.list, { paginationOpts: PAGE });
    const actions = log.page.map((entry) => entry.action);
    expect(actions.slice(0, 3)).toEqual(["issue.deleted", "role.assigned", "role.created"]);
    const deleted = log.page[0];
    expect(deleted.actorId).toBe("member_a");
    expect(deleted.targetId).toBe(issueId);
    expect(deleted.metadata.title).toBe("Gone");
  });

  test("only admins on a plan with audit_log can read it, and only their org's", async () => {
    const free = await setup(null);
    await expect(
      free.adminA.query(api.auditLogs.list, { paginationOpts: PAGE }),
    ).rejects.toThrow(/FEATURE_NOT_IN_PLAN/);

    const { t, adminA, memberA, adminB } = await setup();
    await expect(memberA.query(api.auditLogs.list, { paginationOpts: PAGE })).rejects.toThrow(
      /FORBIDDEN/,
    );
    await adminA.mutation(api.roles.create, { name: "Triager", permissions: [] });
    await setPlan(t, ORG_B, "business");
    const other = await adminB.query(api.auditLogs.list, { paginationOpts: PAGE });
    expect(other.page.every((entry) => entry.orgId === ORG_B)).toBe(true);
    expect(other.page.some((entry) => entry.action === "role.created")).toBe(false);
  });
});
