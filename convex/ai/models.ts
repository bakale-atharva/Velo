import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { env } from "../_generated/server";

// Models and why they were chosen: docs/ai-models.md.

/**
 * Chat models in the order they are tried: free only, from two providers (a
 * rate limit upstream at Google would hit a second Gemma too). No paid models.
 */
export const CHAT_MODELS = ["google/gemma-4-31b-it:free", "baidu/ernie-5.5-flash-preview:free"] as const;

/**
 * Retries per model call. Zero: the chain already moves to the next model,
 * and every retry of a rate-limited request spends more of the free allowance.
 */
export const MODEL_RETRIES = 0;
export const CHAT_MODEL = CHAT_MODELS[0];

/** Free OpenRouter models carry the `:free` suffix. */
export function isFreeModel(id: string): boolean {
  return id.endsWith(":free");
}

/** OpenRouter's account-wide daily cap on free models; every free model then fails. */
export function isFreeDailyCap(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("free-models-per-day");
}

export const EMBEDDING_MODEL = "nvidia/nemotron-3-embed-1b:free";
/** Length of every vector EMBEDDING_MODEL returns; the vector index is fixed to it. */
export { EMBEDDING_DIMENSIONS } from "./embeddingConfig";

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
export const chatModel = (id: string = CHAT_MODEL) => provider().chat(id);

/** Tried in order until one answers. */
export const CHAT_CHAIN = CHAT_MODELS.map((id) => ({ id, model: () => chatModel(id) }));
