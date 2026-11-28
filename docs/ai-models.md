# AI models

Velo's assistant runs on free models only (no paid models, by choice): OpenRouter's `:free` models first, then NVIDIA's hosted NIM API. OpenRouter models chosen on 2026-11-18 from
`GET https://openrouter.ai/api/v1/models` and
`GET https://openrouter.ai/api/v1/embeddings/models`, with each endpoint's data
policy from OpenRouter's endpoint stats. Models marked "Going away" on
OpenRouter (an `expiration_date` in the API) were left out.

| Role | Model | Why |
|---|---|---|
| Primary chat | `google/gemma-4-31b-it:free` | Free, supports tool calling, 256K context. Served by Google AI Studio, which does **not** train on inputs (keeps them 55 days). No expiry date. |
| Fallback chat | `baidu/ernie-5.5-flash-preview:free` | A second provider (Baidu), so a rate limit at Google doesn't take out both. Supports tools. Doesn't train on prompts (does retain them). No expiry date. |
| NIM chat 1 | `nvidia/nemotron-3.5-super-vl-120b-a12b` | NVIDIA NIM (`https://integrate.api.nvidia.com/v1`, key `NVIDIA_API_KEY`). Free, limited per minute, **no daily cap**, so it answers once OpenRouter's daily free allowance is gone. Tool calling checked end to end on 2026-11-28 (about 1.8s). |
| NIM chat 2 | `nvidia/nemotron-3.5-lightning-30b-a3b` | Smaller NIM model, same checks (about 1.5s). |
| Embeddings | `nvidia/nemotron-3-embed-1b:free` | The only free embedding model that was healthy (100% uptime over the last day). **2048-dimensional** vectors (same embedding space as Nemotron 3.5 Embed 1B, documented as 2048-dim). |

`inclusionai/ling-3.2-flash:free` was dropped on 2026-11-28: OpenRouter stopped offering it for free.

## Daily free-model allowance

OpenRouter caps free-model requests **per account per day**; the cap is much higher on accounts that have ever bought credits (requests to `:free` models still cost nothing). Every chat message, summary, report, automatic suggestion and issue embedding spends from it. When it runs out, every `:free` model fails at once with `free-models-per-day` until the daily reset. To make it last (2026-11-28):

- **No retries** (`MODEL_RETRIES = 0`): the AI SDK retried each failed call twice, so one rate-limited message spent up to 3 requests per model.
- **Stop on the cap:** once `free-models-per-day` comes back, `withFallback` (`convex/ai/agent.ts`) skips the remaining free models instead of asking each of them.
- **No automatic suggestions for agent-created issues** (`convex/issues.ts`): agents set their own labels and priority and create issues in bulk.
- Embeddings still run for every new or retitled issue (one request each), so duplicate detection covers agents' issues too.
- **NVIDIA NIM after OpenRouter:** once the cap is hit, the chain goes straight to the NIM models, which have their own per-minute limits and no daily cap. Without `NVIDIA_API_KEY` the NIM models are left out of the chain.

## NVIDIA NIM

- Endpoint `https://integrate.api.nvidia.com/v1` (OpenAI-compatible, `@ai-sdk/openai-compatible`); key from build.nvidia.com, set with `npx convex env set NVIDIA_API_KEY nvapi-…`.
- **NVIDIA's terms say the free hosted API is for development and testing, not production.** Running Velo for a real team on it goes beyond that.
- NIM retires models regularly (Llama 3.3 70B, Nemotron Super 49B and Qwen3 Next were gone by 2026-11-28). To pick replacements, list what the key can use with `GET https://integrate.api.nvidia.com/v1/models` and check tool calling before swapping the ids in `CHAT_MODELS`.

## Data use

- **Embeddings send issue titles and descriptions to NVIDIA, which may train on them** (`training: true`, `retainsPrompts: true`). Every free embedding model on OpenRouter has this policy. The user chose to accept it (2026-11-18). For a workspace with sensitive issues, swap in a paid model that doesn't train (e.g. `openai/text-embedding-3-small`) and update `EMBEDDING_MODEL` and `EMBEDDING_DIMENSIONS` in `convex/ai/models.ts`.
- Chat messages go to Google AI Studio: not used for training, retained up to 55 days.

## Why the fallbacks are from other providers

The first live test (2026-11-18) found both Gemma models rate-limited at the
same time: they share one upstream, Google AI Studio. `google/gemma-4-26b-a4b-it:free`
was the original fallback and was swapped for Ling and ERNIE.

## Considered and left out

- `thinkingmachines/inkling-2-small:free`: going away 2026-11-19.
- `dots-studio/dots-3-note-preview:free`: going away 2026-12-31.
- NVIDIA Nemotron chat models (`nemotron-3-ultra`, `nemotron-3.5-super-vl`, `nemotron-3.5-lightning`): free with tools, but NVIDIA and OpenRouter may train on prompts.
- `nvidia/nemotron-3.5-embed-1b:free` and `nemotron-3.5-embed-8b:free`: degraded at the time of choosing (8B at 35% uptime).
- `openrouter/free`: routes to whichever free model is available, so behaviour and data policy change per request.

## Changing models

Free models come and go. If a model starts failing or shows "Going away", pick a
replacement the same way and update `convex/ai/models.ts`. Changing the embedding
dimensions means re-embedding every issue (the vector index is fixed-size).
