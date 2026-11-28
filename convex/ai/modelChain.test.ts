import { describe, expect, test, vi } from "vitest";
import { runChain } from "./agent";
import { CHAT_MODELS, isFreeDailyCap, isFreeModel, MODEL_RETRIES } from "./models";

const CAP = new Error(
  "Failed after 3 attempts. Last error: AI_APICallError: Rate limit exceeded: free-models-per-day. Add 10 credits",
);

const chainOf = (ids: string[]) => ids.map((id) => ({ id, model: () => id }));
const ids = CHAT_MODELS.map((m) => m.id);

describe("assistant model chain", () => {
  test("OpenRouter free models first, then NVIDIA NIM; nothing paid, no retries", () => {
    const providers = CHAT_MODELS.map((m) => m.provider);
    expect(providers).toEqual(["openrouter", "openrouter", "nvidia", "nvidia"]);
    // Every OpenRouter model is a free one.
    expect(CHAT_MODELS.filter((m) => m.provider === "openrouter").every((m) => isFreeModel(m.id))).toBe(true);
    expect(ids).not.toContain("inclusionai/ling-3.2-flash:free");
    expect(MODEL_RETRIES).toBe(0);
  });

  test("the daily free cap skips OpenRouter's other free models and reaches NIM", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const tried: string[] = [];
    const result = await runChain(chainOf(ids), async (id) => {
      tried.push(id);
      if (isFreeModel(id)) throw CAP;
      return `answer from ${id}`;
    });
    expect(result).toEqual({ ok: true, value: `answer from ${ids[2]}` });
    expect(tried).toEqual([ids[0], ids[2]]);
  });

  test("other errors still try every model in order", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const tried: string[] = [];
    const result = await runChain(chainOf(ids), async (id) => {
      tried.push(id);
      throw new Error("provider down");
    });
    expect(result).toEqual({ ok: false, reason: "MODEL_UNAVAILABLE" });
    expect(tried).toEqual(ids);
  });

  test("recognises the cap error", () => {
    expect(isFreeDailyCap(CAP)).toBe(true);
    expect(isFreeDailyCap(new Error("This model is unavailable for free."))).toBe(false);
  });
});
