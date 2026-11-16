/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { hasFeature, requireFeature } from "./lib/entitlements";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ORG_A = "org_a";
const ORG_B = "org_b";

type T = ReturnType<typeof convexTest>;

function identity(userId: string, orgId: string, role = "member") {
  return {
    subject: userId,
    tokenIdentifier: `https://clerk.test|${userId}`,
    o: { id: orgId, rol: role, slg: orgId },
  };
}

let svixCounter = 0;
async function send(t: T, type: string, data: unknown) {
  svixCounter += 1;
  await t.mutation(internal.clerkSync.handleEvent, {
    svixId: `msg_billing_${svixCounter}`,
    type,
    data,
  });
}

function subscriptionEvent(
  orgId: string | null,
  planSlug: string | null,
  opts: { status?: string; updatedAt?: number; itemStatus?: string } = {},
) {
  return {
    object: "commerce_subscription",
    id: `csub_${orgId ?? "user"}`,
    status: opts.status ?? "active",
    updated_at: opts.updatedAt ?? 1000,
    payer: orgId ? { organization_id: orgId } : { user_id: "user_x" },
    items:
      planSlug === null
        ? []
        : [
            { id: "csubi_old", status: "ended", plan: { slug: "free_org" } },
            {
              id: `csubi_${planSlug}`,
              status: opts.itemStatus ?? "active",
              plan: { slug: planSlug },
            },
          ],
  };
}

async function subscribe(
  t: T,
  orgId: string,
  planSlug: string | null,
  opts?: Parameters<typeof subscriptionEvent>[2],
) {
  await send(t, "subscription.updated", subscriptionEvent(orgId, planSlug, opts));
}

async function join(t: T, orgId: string, userId: string, role = "org:member") {
  await send(t, "organizationMembership.created", {
    role,
    organization: { id: orgId },
    public_user_data: { user_id: userId },
  });
}

function plan(t: T, orgId: string, userId = "user_admin") {
  return t.withIdentity(identity(userId, orgId, "admin")).query(api.billing.currentPlan, {});
}

describe("entitlements", () => {
  test("no subscription means free_org with no features", async () => {
    const t = convexTest(schema, modules);
    expect(await plan(t, ORG_A)).toEqual({
      planSlug: "free_org",
      features: [],
      aiDailyLimit: 0,
    });
    await expect(
      t.run((ctx) => requireFeature(ctx, ORG_A, "ai_assistant")),
    ).rejects.toThrow(/FEATURE_NOT_IN_PLAN/);
  });

  test("pro has ai_assistant only", async () => {
    const t = convexTest(schema, modules);
    await subscribe(t, ORG_A, "pro");
    expect(await plan(t, ORG_A)).toEqual({
      planSlug: "pro",
      features: ["ai_assistant"],
      aiDailyLimit: 100,
    });
    await t.run(async (ctx) => {
      expect(await hasFeature(ctx, ORG_A, "ai_assistant")).toBe(true);
      expect(await hasFeature(ctx, ORG_A, "private_teams")).toBe(false);
    });
    await expect(
      t.run((ctx) => requireFeature(ctx, ORG_A, "audit_log")),
    ).rejects.toThrow(/FEATURE_NOT_IN_PLAN/);
  });

  test("business has all four features", async () => {
    const t = convexTest(schema, modules);
    await subscribe(t, ORG_A, "business");
    const result = await plan(t, ORG_A);
    expect(result.planSlug).toBe("business");
    expect(result.features.sort()).toEqual(
      ["ai_assistant", "audit_log", "custom_roles", "private_teams"],
    );
    expect(result.aiDailyLimit).toBe(500);
  });

  test("past_due is treated as free_org", async () => {
    const t = convexTest(schema, modules);
    await subscribe(t, ORG_A, "pro", { updatedAt: 1000 });
    await send(
      t,
      "subscription.pastDue",
      subscriptionEvent(ORG_A, "pro", { status: "past_due", updatedAt: 2000 }),
    );
    expect((await plan(t, ORG_A)).planSlug).toBe("free_org");
  });

  test("an unknown plan slug is treated as free_org", async () => {
    const t = convexTest(schema, modules);
    await subscribe(t, ORG_A, "mystery");
    expect((await plan(t, ORG_A)).planSlug).toBe("free_org");
  });

  test("org A's plan never leaks to org B", async () => {
    const t = convexTest(schema, modules);
    await subscribe(t, ORG_A, "enterprise");
    expect((await plan(t, ORG_A)).planSlug).toBe("enterprise");
    expect((await plan(t, ORG_B)).planSlug).toBe("free_org");
  });
});

describe("subscription sync", () => {
  test("the active item's plan wins; no active item means free_org", async () => {
    const t = convexTest(schema, modules);
    await subscribe(t, ORG_A, "pro", { updatedAt: 1000 });
    const rows = await t.run((ctx) => ctx.db.query("subscriptions").take(10));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      orgId: ORG_A,
      clerkSubscriptionId: "csub_org_a",
      planSlug: "pro",
      status: "active",
    });

    await subscribe(t, ORG_A, null, { updatedAt: 2000 });
    expect((await plan(t, ORG_A)).planSlug).toBe("free_org");
  });

  test("an older delivery does not overwrite a newer one", async () => {
    const t = convexTest(schema, modules);
    await subscribe(t, ORG_A, "business", { updatedAt: 2000 });
    await subscribe(t, ORG_A, "pro", { updatedAt: 1000 });
    expect((await plan(t, ORG_A)).planSlug).toBe("business");
  });

  test("user subscriptions are ignored", async () => {
    const t = convexTest(schema, modules);
    await send(t, "subscription.created", subscriptionEvent(null, "pro"));
    const rows = await t.run((ctx) => ctx.db.query("subscriptions").take(10));
    expect(rows).toHaveLength(0);
  });

  test("deleting the org removes its subscription", async () => {
    const t = convexTest(schema, modules);
    await subscribe(t, ORG_A, "pro");
    await send(t, "organization.deleted", { id: ORG_A, deleted: true });
    const rows = await t.run((ctx) => ctx.db.query("subscriptions").take(10));
    expect(rows).toHaveLength(0);
  });
});

describe("seat limits", () => {
  async function fourMembers(t: T) {
    await join(t, ORG_A, "user_1", "org:admin");
    await join(t, ORG_A, "user_2");
    await join(t, ORG_A, "user_3");
    await join(t, ORG_A, "user_4");
  }

  function me(t: T, userId: string, role = "member") {
    return t.withIdentity(identity(userId, ORG_A, role)).query(api.members.me, {});
  }

  test("on Free, members beyond 3 get SEAT_LIMIT_REACHED", async () => {
    const t = convexTest(schema, modules);
    await fourMembers(t);
    for (const user of ["user_2", "user_3"]) {
      await expect(me(t, user)).resolves.toMatchObject({ userId: user });
    }
    await expect(me(t, "user_4")).rejects.toThrow(/SEAT_LIMIT_REACHED/);

    const seats = await t
      .withIdentity(identity("user_1", ORG_A, "admin"))
      .query(api.billing.seats, {});
    expect(seats).toEqual({ used: 4, limit: 3 });
  });

  test("admins always have a seat", async () => {
    const t = convexTest(schema, modules);
    await fourMembers(t);
    await join(t, ORG_A, "user_5", "org:admin");
    await expect(me(t, "user_5", "admin")).resolves.toMatchObject({ role: "admin" });
  });

  test("a member not synced yet gets in only while a seat is free", async () => {
    const t = convexTest(schema, modules);
    await join(t, ORG_A, "user_1", "org:admin");
    await join(t, ORG_A, "user_2");
    await expect(me(t, "user_new")).resolves.toMatchObject({ userId: "user_new" });
    await join(t, ORG_A, "user_3");
    await expect(me(t, "user_new")).rejects.toThrow(/SEAT_LIMIT_REACHED/);
  });

  test("removing a member frees a seat for the next one", async () => {
    const t = convexTest(schema, modules);
    await fourMembers(t);
    await send(t, "organizationMembership.deleted", {
      role: "org:member",
      organization: { id: ORG_A },
      public_user_data: { user_id: "user_2" },
    });
    await expect(me(t, "user_4")).resolves.toMatchObject({ userId: "user_4" });
  });

  test("upgrading lifts the limit; Business is unlimited", async () => {
    const t = convexTest(schema, modules);
    await fourMembers(t);
    await subscribe(t, ORG_A, "business");
    await expect(me(t, "user_4")).resolves.toMatchObject({ userId: "user_4" });
    const seats = await t
      .withIdentity(identity("user_1", ORG_A, "admin"))
      .query(api.billing.seats, {});
    expect(seats).toEqual({ used: 4, limit: null });
  });

  test("Pro allows 20 seats", async () => {
    const t = convexTest(schema, modules);
    await subscribe(t, ORG_A, "pro");
    for (let i = 1; i <= 21; i++) {
      await join(t, ORG_A, `user_${i}`);
    }
    await expect(me(t, "user_20")).resolves.toMatchObject({ userId: "user_20" });
    await expect(me(t, "user_21")).rejects.toThrow(/SEAT_LIMIT_REACHED/);
  });

  test("org B's members do not use org A's seats", async () => {
    const t = convexTest(schema, modules);
    for (const user of ["user_b1", "user_b2", "user_b3"]) {
      await join(t, ORG_B, user);
    }
    await join(t, ORG_A, "user_a1");
    await expect(me(t, "user_a1")).resolves.toMatchObject({ orgId: ORG_A });
  });
});
