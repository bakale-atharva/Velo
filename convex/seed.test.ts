/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("seed fills an org once and the data is readable", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.clerkSync.handleEvent, {
    svixId: "msg_seed_1",
    type: "organizationMembership.created",
    data: {
      role: "org:admin",
      organization: { id: "org_s" },
      public_user_data: { user_id: "admin_s" },
    },
  });
  const counts = await t.mutation(internal.seed.org, { orgId: "org_s" });
  expect(counts).toEqual({ teams: 3, labels: 6, projects: 3, cycles: 9, issues: 22 });
  await expect(t.mutation(internal.seed.org, { orgId: "org_s" })).rejects.toThrow(
    /INVALID_INPUT/,
  );

  const admin = t.withIdentity({
    subject: "admin_s",
    tokenIdentifier: "https://clerk.test|admin_s",
    o: { id: "org_s", rol: "admin", slg: "org_s" },
  });
  expect(await admin.query(api.teams.list, {})).toHaveLength(3);
  const web = await admin.query(api.issues.get, { identifier: "WEB-1" });
  expect(web.title).toMatch(/drag and drop/);
  const launch = (await admin.query(api.projects.list, {})).find(
    (p) => p.name === "Public launch",
  )!;
  expect(launch.issueCount).toBe(4);
  expect(launch.completedIssueCount).toBe(1);
  expect((await admin.query(api.issues.listMine, {})).length).toBeGreaterThan(10);
});

test("seed:clear removes only what the seed made", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  await t.mutation(internal.clerkSync.handleEvent, {
    svixId: "msg_seed_2",
    type: "organizationMembership.created",
    data: {
      role: "org:admin",
      organization: { id: "org_c" },
      public_user_data: { user_id: "admin_c" },
    },
  });
  const admin = t.withIdentity({
    subject: "admin_c",
    tokenIdentifier: "https://clerk.test|admin_c",
    o: { id: "org_c", rol: "admin", slg: "org_c" },
  });
  await t.mutation(internal.seed.org, { orgId: "org_c" });
  const ownTeam = await admin.mutation(api.teams.create, { name: "Own", key: "OWN" });
  await admin.mutation(api.issues.create, { teamId: ownTeam, title: "Mine" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const removed = await t.mutation(internal.seed.clear, { orgId: "org_c" });
  expect(removed).toEqual({ teams: 3, projects: 3, labels: 6 });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  expect((await admin.query(api.teams.list, {})).map((team) => team.key)).toEqual(["OWN"]);
  expect(await admin.query(api.projects.list, {})).toHaveLength(0);
  const issues = await t.run((ctx) => ctx.db.query("issues").take(50));
  expect(issues.map((issue) => issue.title)).toEqual(["Mine"]);
  const cycles = await t.run((ctx) => ctx.db.query("cycles").take(50));
  expect(cycles).toHaveLength(0);
  vi.useRealTimers();
});
