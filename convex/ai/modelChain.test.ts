import { describe, expect, test, vi } from "vitest";
import { runChain } from "./agent";
import { CHAT_MODELS, isFreeDailyCap, isFreeModel } from "./models";

const CAP = new Error(
  "Failed after 3 attempts. Last error: AI_APICallError: Rate limit exceeded: free-models-per-day. Add 10 credits",
);

const chainOf = (ids: string[]) => ids.map((id) => ({ id, model: () => id }));

describe("assistant model chain", () => {
  test("free models first, then paid ones, without the retired free Ling", () => {
    const free = CHAT_MODELS.filter(isFreeModel);
    const paid = CHAT_MODELS.filter((id) => !isFreeModel(id));
    expect(free.length).toBeGreaterThan(0);
    expect(paid.length).toBeGreaterThan(0);
    expect(CHAT_MODELS.slice(0, free.length)).toEqual(free);
    expect(CHAT_MODELS).not.toContain("inclusionai/ling-3.2-flash:free");
  });

  test("the daily free cap skips the other free models and reaches a paid one", async () => {
    const tried: string[] = [];
    const result = await runChain(chainOf(["a:free", "b:free", "paid"]), async (id) => {
      tried.push(id);
      if (id.endsWith(":free")) throw CAP;
      return `answer from ${id}`;
    });
    expect(result).toEqual({ ok: true, value: "answer from paid" });
    expect(tried).toEqual(["a:free", "paid"]);
  });

  test("other errors still try every model in order", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const tried: string[] = [];
    const result = await runChain(chainOf(["a:free", "b:free", "paid"]), async (id) => {
      tried.push(id);
      throw new Error("provider down");
    });
    expect(result).toEqual({ ok: false, reason: "MODEL_UNAVAILABLE" });
    expect(tried).toEqual(["a:free", "b:free", "paid"]);
  });

  test("recognises the cap error", () => {
    expect(isFreeDailyCap(CAP)).toBe(true);
    expect(isFreeDailyCap(new Error("This model is unavailable for free."))).toBe(false);
  });
});
