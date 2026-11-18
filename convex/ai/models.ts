import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { env } from "../_generated/server";

// Models and why they were chosen: docs/ai-models.md. All free on OpenRouter.

export const CHAT_MODEL = "google/gemma-4-31b-it:free";
export const FALLBACK_CHAT_MODEL = "google/gemma-4-26b-a4b-it:free";
export const EMBEDDING_MODEL = "nvidia/nemotron-3-embed-1b:free";
/** Length of every vector EMBEDDING_MODEL returns; the vector index is fixed to it. */
export const EMBEDDING_DIMENSIONS = 2048;

/** True when the OpenRouter key is set on the deployment. */
export function aiConfigured(): boolean {
  return (env.OPENROUTER_API_KEY ?? "") !== "";
}

/** The OpenRouter key; throws when it isn't set (actions check aiConfigured first). */
export function openRouterKey(): string {
  const key = env.OPENROUTER_API_KEY;
  if (key === undefined || key === "") {
    throw new Error("OPENROUTER_API_KEY is not set on this deployment");
  }
  return key;
}

function provider() {
  return createOpenRouter({ apiKey: openRouterKey() });
}

// Built per call so a key set after deploy is picked up without a redeploy.
export const chatModel = () => provider().chat(CHAT_MODEL);
export const fallbackChatModel = () => provider().chat(FALLBACK_CHAT_MODEL);
