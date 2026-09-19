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

Every external dependency (LLM, video, voice, storage) is selected at
runtime based on environment variables. If a key is missing:

- In development, a deterministic **mock adapter** is used so the full
  pipeline runs end-to-end without spending money or requiring credentials.
  Mock outputs are always clearly labeled (`[MOCK]`, `mock-storage.local`, …).
- In production (`NODE_ENV=production`), missing credentials for the LLM or
  storage provider throw at startup rather than silently faking a
  successful generation — see spec sections 52/61.

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
