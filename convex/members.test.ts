/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ORG_A = "org_a";
const ORG_B = "org_b";

// Same shape as a real Clerk v2 session token seen by Convex.
function identity(userId: string, orgId?: string, role = "member") {
  return {
    subject: userId,
    tokenIdentifier: `https://clerk.test|${userId}`,
    ...(orgId ? { o: { id: orgId, rol: role, slg: orgId } } : {}),
  };
}

let svixCounter = 0;
function nextSvixId() {
  svixCounter += 1;
  return `msg_${svixCounter}`;
}

function userEvent(id: string, firstName: string) {
  return {
    id,
    first_name: firstName,
    last_name: null,
    username: null,
    image_url: `https://img.test/${id}`,
    primary_email_address_id: `idn_${id}`,
    email_addresses: [{ id: `idn_${id}`, email_address: `${id}@example.com` }],
  };
}

function orgEvent(id: string) {
  return { id, name: `Org ${id}`, slug: id, has_image: false, image_url: "" };
}

function membershipEvent(orgId: string, userId: string, role = "org:member") {
  return {
    role,
    organization: orgEvent(orgId),
    public_user_data: { user_id: userId },
  };
}

type T = ReturnType<typeof convexTest>;

async function send(t: T, type: string, data: unknown, svixId = nextSvixId()) {
  await t.mutation(internal.clerkSync.handleEvent, { svixId, type, data });
}

async function seed(t: T) {
  await send(t, "organization.created", orgEvent(ORG_A));
  await send(t, "organization.created", orgEvent(ORG_B));
  for (const [user, name] of [
    ["user_a", "Alice"],
    ["user_a2", "Anna"],
    ["user_b", "Bob"],
  ]) {
    await send(t, "user.created", userEvent(user, name));
  }
  await send(t, "organizationMembership.created", membershipEvent(ORG_A, "user_a", "org:admin"));
  await send(t, "organizationMembership.created", membershipEvent(ORG_A, "user_a2"));
  await send(t, "organizationMembership.created", membershipEvent(ORG_B, "user_b"));
}

describe("tenancy", () => {
  test("unauthenticated calls throw UNAUTHENTICATED", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.members.list, {})).rejects.toThrow(/UNAUTHENTICATED/);
    await expect(t.query(api.members.me, {})).rejects.toThrow(/UNAUTHENTICATED/);
    await expect(t.query(api.organizations.current, {})).rejects.toThrow(/UNAUTHENTICATED/);
  });

  test("signed in without an active org throws NO_ACTIVE_ORG", async () => {
    const t = convexTest(schema, modules);
    const noOrg = t.withIdentity(identity("user_a"));
    await expect(noOrg.query(api.members.list, {})).rejects.toThrow(/NO_ACTIVE_ORG/);
    await expect(noOrg.query(api.organizations.current, {})).rejects.toThrow(/NO_ACTIVE_ORG/);
  });

  test("a member of org A never sees org B", async () => {
    const t = convexTest(schema, modules);
    await seed(t);

    const alice = t.withIdentity(identity("user_a", ORG_A, "admin"));
    const members = await alice.query(api.members.list, {});
    expect(members.map((m) => m.userId).sort()).toEqual(["user_a", "user_a2"]);
    expect(members.find((m) => m.userId === "user_a")).toMatchObject({
      role: "admin",
      name: "Alice",
      email: "user_a@example.com",
    });
    expect((await alice.query(api.organizations.current, {}))?.clerkOrgId).toBe(ORG_A);

    const bob = t.withIdentity(identity("user_b", ORG_B));
    const bobMembers = await bob.query(api.members.list, {});
    expect(bobMembers.map((m) => m.userId)).toEqual(["user_b"]);
    expect((await bob.query(api.organizations.current, {}))?.clerkOrgId).toBe(ORG_B);

    expect(await alice.query(api.members.me, {})).toMatchObject({
      userId: "user_a",
      orgId: ORG_A,
      role: "admin",
    });
  });

  test("a replayed svix-id is ignored", async () => {
    const t = convexTest(schema, modules);
    await send(t, "user.created", userEvent("user_a", "Alice"), "msg_same");
    await send(t, "user.updated", userEvent("user_a", "Mallory"), "msg_same");

    const users = await t.run((ctx) => ctx.db.query("users").take(10));
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe("Alice");
    const events = await t.run((ctx) => ctx.db.query("webhookEvents").take(10));
    expect(events).toHaveLength(1);
  });

  test("a deleted membership is removed from the list", async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    await send(t, "organizationMembership.deleted", membershipEvent(ORG_A, "user_a2"));

    const alice = t.withIdentity(identity("user_a", ORG_A, "admin"));
    const members = await alice.query(api.members.list, {});
    expect(members.map((m) => m.userId)).toEqual(["user_a"]);
  });

  test("deleting an org or user removes their memberships", async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    await send(t, "user.deleted", { id: "user_a2", deleted: true, object: "user" });
    await send(t, "organization.deleted", { id: ORG_B, deleted: true, object: "organization" });

    const memberships = await t.run((ctx) => ctx.db.query("memberships").take(10));
    expect(memberships.map((m) => m.userId)).toEqual(["user_a"]);
    const orgs = await t.run((ctx) => ctx.db.query("organizations").take(10));
    expect(orgs.map((o) => o.clerkOrgId)).toEqual([ORG_A]);
  });

  test("membership role update strips the org: prefix", async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    await send(t, "organizationMembership.updated", membershipEvent(ORG_A, "user_a2", "org:admin"));

    const alice = t.withIdentity(identity("user_a", ORG_A, "admin"));
    const members = await alice.query(api.members.list, {});
    expect(members.find((m) => m.userId === "user_a2")?.role).toBe("admin");
  });
});
