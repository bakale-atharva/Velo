/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
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
