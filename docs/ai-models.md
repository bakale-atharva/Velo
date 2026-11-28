# AI models

Velo's assistant runs on free OpenRouter models first, with cheap paid ones behind them. Chosen on 2026-11-18 (paid backstops added 2026-11-28) from
`GET https://openrouter.ai/api/v1/models` and
`GET https://openrouter.ai/api/v1/embeddings/models`, with each endpoint's data
policy from OpenRouter's endpoint stats. Models marked "Going away" on
OpenRouter (an `expiration_date` in the API) were left out.

| Role | Model | Why |
|---|---|---|
| Primary chat | `google/gemma-4-31b-it:free` | Free, supports tool calling, 256K context. Served by Google AI Studio, which does **not** train on inputs (keeps them 55 days). No expiry date. |
| Fallback chat | `baidu/ernie-5.5-flash-preview:free` | A second provider (Baidu), so a rate limit at Google doesn't take out both. Supports tools. Doesn't train on prompts (does retain them). No expiry date. |
| Paid backstop 1 | `google/gemma-4-31b-it` | The paid primary ($0.20 / $0.40 per million input / output tokens, 2026-11-28). Used once the free models fail or OpenRouter's daily free-model cap is reached. |
| Paid backstop 2 | `inclusionai/ling-3.2-flash` | Paid ($0.30 / $0.90 per million). Ant Digital, a different provider. Supports tools. |

`inclusionai/ling-3.2-flash:free` was dropped on 2026-11-28: OpenRouter stopped offering it for free.

## Daily free-model cap

OpenRouter caps free-model requests **per account per day**, and the cap is much higher once the account has bought credits. When it is hit, every `:free` model fails at once with `free-models-per-day`. `withFallback` (`convex/ai/agent.ts`) then skips the remaining free models and goes straight to the paid ones. **The paid backstops need a credit balance on the OpenRouter account**; without credits the assistant reports "unavailable" until the cap resets.
| Embeddings | `nvidia/nemotron-3-embed-1b:free` | The only free embedding model that was healthy (100% uptime over the last day). **2048-dimensional** vectors (same embedding space as Nemotron 3.5 Embed 1B, documented as 2048-dim). |

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
