# Universal AI UGC Creative & Video Production Engine

A standalone, white-label-ready SaaS platform that turns a product brief into
a fully planned, generated, edited, and quality-controlled UGC video
advertisement. Industry-agnostic, provider-agnostic, multi-tenant.

This lives inside the `Bankipur-182` repo as its own package (`ugc-engine/`)
so it can be extracted into its own repository later without touching the
sibling `sitesnsign-ai-executive` app.

## Architecture

```
Next.js App Router (dashboard, API) ──dispatch──▶ BullMQ / Redis ──▶ background worker
                                                                        │
                                                     ┌──────────────────┼──────────────────┐
                                                     ▼                  ▼                  ▼
                                          10-Agent Creative      Provider Adapters   FFmpeg Render
                                          Director Pipeline      (video/voice/music/  + QC + Captions
                                                                  storage)
```

- **`src/lib/agents/`** — the 10 agents from the spec (Brand Strategist,
  Audience Strategist, Creative Director, Hook Engineer, Script Writer,
  Continuity Architect, Storyboard Director, Voice Director, Audio-Visual
  Editor, Quality Controller), wired together by `CreativeDirectorOrchestrator`.
- **`src/lib/providers/`** — Adapter Pattern for video (Veo/Runway/Luma/Kling),
  voice (ElevenLabs), music, and storage (S3/R2/local). Business logic never
  imports a concrete adapter directly — go through the registry/`index.ts`.
- **`src/lib/prompt/UGCVideoPromptEngine.ts`** — structured prompt formula
  (subject + action + product + environment + camera + lighting + style +
  negative constraints), driven entirely by the Continuity Bible.
- **`src/lib/qc/`**, **`src/lib/render/`**, **`src/lib/audio/`** — quality
  control thresholds, FFmpeg scene concatenation/reframing/caption burn-in,
  and word-level VTT/SRT caption generation.
- **`src/lib/industry/IndustryFrameworks.ts`** — extensible registry (15
  industries seeded); add a new vertical by registering one object, no core
  changes required.
- **`src/lib/cost/`**, **`src/lib/cache/`** — cost estimation and MD5-based
  cache keys so identical requests can be deduped instead of re-billed.
- **`src/workers/videoProductionWorker.ts`** — the master pipeline (spec
  section 59) as a BullMQ worker: strategy → script → storyboard → per-scene
  generation with QC retry → voice → captions → render. Targeted scene
  regeneration only touches the requested scene numbers; locked scenes are
  never overwritten (enforced at the SQL layer too).
- **`db/schema.sql`** — Postgres schema with Row-Level Security on every
  tenant-scoped table, plus white-label columns on `organizations`.

## Provider abstraction & mock mode

Every external dependency (LLM, video, voice, image, speech-to-text,
storage) is selected at runtime based on environment variables, through a
registry (`getLLMProvider()`, `getVoiceProvider()`, etc.) that business
logic calls instead of importing a concrete adapter. If nothing is
configured:

- In development, a deterministic **mock adapter** is used so the full
  pipeline runs end-to-end without spending money or requiring credentials.
  Mock outputs are always clearly labeled (`[MOCK]`, `mock-storage.local`, …).
- In production (`NODE_ENV=production`), a missing LLM or storage
  credential throws at startup rather than silently faking a successful
  generation — see spec sections 52/61 — unless `ALLOW_MOCK_PROVIDERS=true`
  is explicitly set (for a testing deploy on infra with no keys yet).

### Multiple options per capability

Each capability supports more than one provider so you can start on free
tiers and swap providers later without touching agent/worker code — every
adapter for a capability implements the same interface (`ILLMProvider`,
`IVoiceProviderAdapter`, `IImageProviderAdapter`, `ISpeechToTextProvider`,
`IVideoProviderAdapter`, `IMusicProviderAdapter`, `IStorageProviderAdapter`).

| Capability | Options (env var picks one via `DEFAULT_*_PROVIDER`, or auto-detect) | Recommended free start |
|---|---|---|
| **LLM** (script/strategy) | Gemini · OpenRouter · **NVIDIA NIM** · Groq · Together AI | **Groq** — fast, generous free tier |
| **Speech-to-Text** | Groq Whisper · OpenAI Whisper | Groq (reuses `GROQ_API_KEY`) |
| **Image generation** (thumbnails/reference) | **Pollinations.ai (no key)** · NVIDIA NIM · Hugging Face | Pollinations — needs nothing, always works |
| **Voice (TTS)** | ElevenLabs · Hugging Face | ElevenLabs (best quality + word timing), ~10k chars/month free |
| **Video generation** | Google Veo · Runway · Luma · Kling | Whichever you can get a key for first — all cost money per second |
| **Music** | Mubert · Mock | Mubert free tier, or leave unset for Mock |
| **Storage** | S3-compatible (AWS S3 / Cloudflare R2) · local (dev only) | Cloudflare R2 — 10GB free, no egress fee |
| **Final video assembly** | **Shotstack** (cloud, no ffmpeg needed) · FFmpeg (local binary, needs a real server/VPS) | Shotstack "stage" key — free, watermarked, works on Vercel |

`NVIDIA_API_KEY` is reused across three registries (LLM text generation,
image generation, and — if you point `DEFAULT_LLM_PROVIDER=nvidia` — the
main creative pipeline) since NVIDIA NIM hosts both chat and image models
behind one key from https://build.nvidia.com.

One caveat: the multimodal Quality-Control agent (`QualityControlEngine`)
needs a vision-capable model to inspect generated video frames — only
`GeminiLLMProvider` implements that path today. If your `DEFAULT_LLM_PROVIDER`
is OpenRouter/NVIDIA/Groq/Together, QC evaluation is skipped gracefully
(the worker catches the "not supported" error and accepts the scene without
QC) rather than failing the whole pipeline — configure `GEMINI_API_KEY`
alongside your main text provider if you want real QC enforcement.

See `.env.example` for exact variable names, where to get every key, and
inline links.

## Running locally

```bash
cd ugc-engine
npm install
cp .env.example .env       # fill in what you have; everything else falls back to mocks
psql "$DATABASE_URL" -f db/schema.sql

npm run dev      # Next.js dashboard + API on :3000
npm run worker   # BullMQ worker (requires Redis)
```

## What's scaffolded vs. what's a documented next step

Built and wired end-to-end in this scaffold: the full 10-agent pipeline,
provider adapters for 4 video models + voice + music + storage, the
Continuity Bible / prompt engine, QC engine with retry loop, FFmpeg render
engine, industry framework registry, cost/cache engine, BullMQ queue +
worker, the API surface from spec section 39, RLS-enforced Postgres schema,
white-label config resolution, and a minimal dashboard.

Explicitly **not** built yet (tracked here rather than silently assumed):
authentication (the `x-organization-id`/`x-user-id` headers in
`src/lib/auth/tenant.ts` are a placeholder for real session/JWT
verification), billing/Stripe integration, brand kit & creator profile CRUD
UI, admin observability dashboard, adaptive multi-duration re-editing
(spec section 27), and thumbnail/headline generation (section 28). These
are additive on top of the current architecture, not blocked by it.
