import { Agent, stepCountIs } from "@convex-dev/agent";
import type { ToolSet } from "ai";
import { components } from "../_generated/api";
import { aiConfigured, chatModel, fallbackChatModel } from "./models";

const INSTRUCTIONS = `You are the assistant inside Velo, an issue tracker for product teams.
Answer questions about the user's workspace using the tools: search and read issues, and list teams, members, projects, cycles and labels. Never invent issue identifiers, people or data you did not get from a tool.
You cannot change anything directly. To create or change issues, call a propose* tool: it records a proposal that the user reviews and applies themselves. Say clearly that the change is a proposal waiting for them.
Be brief. Use Markdown lists for several items, and write issue identifiers like ENG-12.`;

/** The assistant with the given model and tools (tools are built per request). */
export function buildAgent(languageModel: ReturnType<typeof chatModel>, tools: ToolSet = {}) {
  return new Agent(components.agent, {
    name: "Velo assistant",
    languageModel,
    instructions: INSTRUCTIONS,
    tools,
    // Enough for a few lookups plus a proposal, without runaway loops.
    stopWhen: stepCountIs(8),
  });
}

export type ModelResult<T> = { ok: true; value: T } | { ok: false; reason: "MODEL_UNAVAILABLE" };

/**
 * Runs `attempt` with the primary model, then once with the fallback when the
 * primary fails (rate limits and provider errors are common on free models).
 * Reports MODEL_UNAVAILABLE instead of throwing when both fail or no key is set.
 */
export async function withFallback<T>(
  attempt: (model: ReturnType<typeof chatModel>) => Promise<T>,
): Promise<ModelResult<T>> {
  if (!aiConfigured()) {
    return { ok: false, reason: "MODEL_UNAVAILABLE" };
  }
  for (const model of [chatModel, fallbackChatModel]) {
    try {
      return { ok: true, value: await attempt(model()) };
    } catch (error) {
      console.warn("Assistant model failed", error instanceof Error ? error.message : error);
    }
  }
  return { ok: false, reason: "MODEL_UNAVAILABLE" };
}
