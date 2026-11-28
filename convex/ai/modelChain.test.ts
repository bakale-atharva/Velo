import { describe, expect, test, vi } from "vitest";
import { runChain } from "./agent";
import { CHAT_MODELS, isFreeDailyCap, isFreeModel, MODEL_RETRIES } from "./models";

const CAP = new Error(
  "Failed after 3 attempts. Last error: AI_APICallError: Rate limit exceeded: free-models-per-day. Add 10 credits",
);

const chainOf = (ids: string[]) => ids.map((id) => ({ id, model: () => id }));

describe("assistant model chain", () => {
  test("only free models, without the retired free Ling, and no retries", () => {
    expect(CHAT_MODELS.length).toBeGreaterThan(1);
    expect(CHAT_MODELS.every(isFreeModel)).toBe(true);
    expect(CHAT_MODELS).not.toContain("inclusionai/ling-3.2-flash:free");
    expect(MODEL_RETRIES).toBe(0);
  });

  test("once the daily free cap is hit, no further requests are spent", async () => {
    const tried: string[] = [];
    const result = await runChain(chainOf([...CHAT_MODELS]), async (id) => {
      tried.push(id);
      throw CAP;
    });
    expect(result).toEqual({ ok: false, reason: "MODEL_UNAVAILABLE" });
    expect(tried).toEqual([CHAT_MODELS[0]]);
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
