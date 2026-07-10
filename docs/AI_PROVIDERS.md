# AI_PROVIDERS.md — Runtime AI Provider Architecture

Defines which external AI services **the Paw Care Right + product** calls at runtime, and the abstraction that keeps them swappable. This **supersedes every earlier mention of the Anthropic API as a runtime provider** (PRODUCT_SPEC, ARCHITECTURE, PHASES). The app no longer uses `ANTHROPIC_API_KEY`.

> **Scope boundary (read this first).** There are two completely separate AI concerns in this repo:
> 1. **The build loop** — Fable/Sonnet subagents in Claude Code that *write the app's code*. Governed by `docs/MODEL_STRATEGY.md`. Unchanged by this document.
> 2. **The product runtime** — what the shipped app calls to serve pet owners. Governed by *this* document.
> Never wire a product-runtime provider into the build loop or vice-versa. `ANTHROPIC_API_KEY` is not used by either the product runtime (this doc removes it) — the build loop uses your Claude Code session auth, not an app env var.

---

## 1. Provider assignment

| Runtime capability | Provider | Why |
|---|---|---|
| **Image generation** (breed illustrations, marketing/content art, any generated imagery) | **Google Gemini** (image-generation model) | Per your directive: Gemini is the image stack. |
| **Text reasoning** (triage narrative, food-safety fallback, Ask chat, vet-summary generation, content generation) | **Ollama Cloud** (text model, e.g. a Llama-3.x / Qwen-class instruct model) | Per your directive: Ollama Cloud for "other AI stuff." |
| **Vision reasoning** (symptom-photo analysis inside triage) | **Ollama Cloud vision model** (e.g. `llama3.2-vision` / Qwen-VL class) | Ollama Cloud added native vision (Qwen-VL, Llama-3.2-Vision) in 2026. Keeps triage on one provider. |
| **Schema enforcement** for triage/food JSON | **Application-side (Zod) — not trusted to the provider** | See §3. This is the safety-critical decision. |

Env vars (replace the old `ANTHROPIC_API_KEY`):
```
GEMINI_API_KEY=…            # image generation
OLLAMA_CLOUD_API_KEY=…      # text + vision reasoning
OLLAMA_CLOUD_BASE_URL=https://ollama.com   # OpenAI-compatible surface; override for self-host
AI_TEXT_MODEL=…             # e.g. the chosen Ollama text model tag
AI_VISION_MODEL=…           # e.g. the chosen Ollama vision model tag
GEMINI_IMAGE_MODEL=…        # chosen Gemini image model id
```
All are validated by the Zod env schema (`packages/config/env`); `.env.example` lists them with fake values. No provider key ships in the client bundle — all AI calls are server-side (NestJS/workers) only.

## 2. Abstraction (packages/ai stays the seam)

The existing `LlmProvider` seam is kept; only implementations change. Three provider interfaces, one registry:

```
packages/ai/
├── providers/
│   ├── types.ts            # TextProvider, VisionProvider, ImageProvider interfaces
│   ├── ollama-text.ts      # Ollama Cloud (OpenAI-compatible /v1/chat/completions)
│   ├── ollama-vision.ts    # Ollama Cloud vision (images[] in messages)
│   ├── gemini-image.ts     # Gemini image generation
│   └── fake/               # deterministic fakes for tests + CI evals (no network)
├── registry.ts             # picks impl from env; single import point for the app
```

Rules: no app module imports a vendor SDK directly — only `packages/ai`. Swapping a provider later = one new file + a registry line, no app changes. The `fake/` providers are what CI and the AI-eval harness use, so tests never hit the network or spend tokens.

## 3. Schema enforcement is application-side (safety-critical)

The triage `TriageResult` schema (PRODUCT_SPEC §6.3) is safety-critical, and **provider-side structured-output support for Ollama Cloud is not something we rely on** (Ollama's own docs state Cloud does not currently guarantee structured outputs, even though local Ollama and some 2026 reports say otherwise). Therefore, regardless of provider capability:

1. The prompt **embeds the JSON schema as text** and instructs "return only JSON matching this schema" (grounding technique that works on any model).
2. Set **temperature 0** for triage/food calls (determinism).
3. The response is **always parsed and validated with Zod** in `packages/ai` (`parseTriage`). This already exists and is unchanged.
4. On parse/validation failure → **one bounded repair retry** (re-prompt with the validation error), then → **SAFE_FALLBACK** (recommend a vet). Never ship an unvalidated object to the UI. This preserves PRODUCT_SPEC §5 rule 2 ("fail upward") exactly.
5. If `format`/schema-constrained decoding *is* available on the chosen Ollama model, the provider impl may pass it as an **optimization** — but the Zod gate remains the source of truth. Capability is detected/configured, never assumed.

Net effect: the safety guarantee lives in our code, not in a provider feature flag. This is more robust than the previous Anthropic-structured-output assumption, not less.

## 4. Cost & performance notes

- Ollama Cloud pricing (2026): Free / ~$20 Pro / ~$200 Pro Max; OpenAI-compatible surface means the text + vision impls share one client. Keep the triage token budget target (~$0.02/check) as a monitored metric (PRODUCT_SPEC §6.5) — re-baseline it for the chosen model since it's no longer Anthropic-priced.
- Vision adds latency/VRAM vs text-only; the check end-to-end p90 targets (ARCHITECTURE §8) stay, re-measured on the chosen vision model at T052.
- Open-weight instruct models are generally weaker than frontier models at nuanced medical-adjacent reasoning. This raises the stakes on the eval gates (PHASES T037/T038): the golden-set and red-team thresholds are unchanged, but **the model choice must pass them** — if the first Ollama text/vision model can't hit the safety thresholds, try a larger model tag before shipping. The eval harness is exactly the tool for that A/B.
- Gemini image generation is only for non-safety content (illustrations/marketing); it never touches triage.

## 5. Fallback & availability

- Provider down → the same graceful degradation already specified (ARCHITECTURE §8): triage returns SAFE_FALLBACK, food lookups serve the curated dataset/cache, reminders unaffected.
- Because everything is behind `packages/ai`, a future provider change (or adding a frontier provider back for triage only, if evals demand it) is a contained edit. The architecture is provider-agnostic by design; the *choices* here are per your directive.

## 6. Safety policy is unchanged

Nothing in this provider swap relaxes PRODUCT_SPEC §5 or CLAUDE.md §7. Disclaimers, deterministic red-flag emergency escalation (which is **code, not a model**, so provider-independent), no-dosing, and fail-upward all apply identically. The red-flag rules engine (T031) never calls a provider at all — that safety layer is completely insulated from this change.
