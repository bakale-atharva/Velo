import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { Agent } from "@convex-dev/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { env } from "../_generated/server";

/** A chat model in the form the agent library takes (AI SDK v7 models). */
export type LanguageModel = NonNullable<ConstructorParameters<typeof Agent>[1]["languageModel"]>;

// Models and why they were chosen: docs/ai-models.md. Everything here is
// free: OpenRouter's `:free` models, then NVIDIA's hosted NIM API.

type Provider = "openrouter" | "nvidia";

/**
 * Chat models in the order they are tried. OpenRouter's free models come
 * first, from two providers (a rate limit upstream at Google would hit a
 * second Gemma too). NVIDIA NIM follows: it has its own per-minute limits and
 * no daily cap, so it answers once OpenRouter's daily free allowance is gone.
 * No paid models.
 */
export const CHAT_MODELS: readonly { id: string; provider: Provider }[] = [
  { id: "google/gemma-4-31b-it:free", provider: "openrouter" },
  { id: "baidu/ernie-5.5-flash-preview:free", provider: "openrouter" },
  { id: "nvidia/nemotron-3.5-super-vl-120b-a12b", provider: "nvidia" },
  { id: "nvidia/nemotron-3.5-lightning-30b-a3b", provider: "nvidia" },
];

/**
 * Retries per model call. Zero: the chain already moves to the next model,
 * and every retry of a rate-limited request spends more of the free allowance.
 */
export const MODEL_RETRIES = 0;

const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1";

/** OpenRouter's free models carry the `:free` suffix and share its daily cap. */
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

const keyFor = (provider: Provider) =>
  (provider === "openrouter" ? env.OPENROUTER_API_KEY : env.NVIDIA_API_KEY) ?? "";

/** True when at least one model provider's key is set on the deployment. */
export function aiConfigured(): boolean {
  return keyFor("openrouter") !== "" || keyFor("nvidia") !== "";
}

/** The OpenRouter key (embeddings use it); throws when it isn't set. */
export function openRouterKey(): string {
  const key = keyFor("openrouter");
  if (key === "") {
    throw new Error("OPENROUTER_API_KEY is not set on this deployment");
  }
  return key;
}

// Built per call so a key set after deploy is picked up without a redeploy.
function languageModel(id: string, provider: Provider): LanguageModel {
  if (provider === "nvidia") {
    return createOpenAICompatible({ name: "nvidia", baseURL: NIM_BASE_URL, apiKey: keyFor("nvidia") }).chatModel(id);
  }
  return createOpenRouter({ apiKey: keyFor("openrouter") }).chat(id);
}

export type ChainEntry = { id: string; model: () => LanguageModel };

/** The models to try, in order, leaving out any provider whose key isn't set. */
export function chatChain(): ChainEntry[] {
  return CHAT_MODELS.filter((m) => keyFor(m.provider) !== "").map((m) => ({
    id: m.id,
    model: () => languageModel(m.id, m.provider),
  }));
}
