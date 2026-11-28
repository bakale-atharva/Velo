import { describe, expect, test } from "vitest";
import { isPriorityOrg } from "./lib/entitlements";

describe("priority orgs", () => {
  test("only listed org ids are priority", () => {
    const list = " org_priority , org_other,";
    expect(isPriorityOrg("org_priority", list)).toBe(true);
    expect(isPriorityOrg("org_other", list)).toBe(true);
    expect(isPriorityOrg("org_priorit", list)).toBe(false);
    expect(isPriorityOrg("", list)).toBe(false);
    expect(isPriorityOrg("org_priority", undefined)).toBe(false);
    expect(isPriorityOrg("org_priority", "")).toBe(false);
  });
});
