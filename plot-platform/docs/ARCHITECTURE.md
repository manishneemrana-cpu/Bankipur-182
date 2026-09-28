# Architecture

Full product spec: [`MASTER_PROMPT.md`](MASTER_PROMPT.md). This document is the map of how the
build actually implements it, phase by phase, for anyone picking the codebase up cold.

## Stack

- **Next.js 16** (App Router, Turbopack), strict TypeScript, `proxy.ts` (not `middleware.ts`).
- **Supabase**: Postgres + Auth + Storage. Every table has Row Level Security; anonymous
  (buyer-facing) access goes exclusively through `SECURITY DEFINER` RPCs in `public`/`app`
  schemas — never a direct table grant to `anon`.
- **Tailwind v4 + shadcn/ui**, Vitest (unit + DB), Playwright (e2e smoke), GitHub Actions CI.

## Layers

```
app/(public)/p/[projectSlug]/...   buyer-facing project site
app/(public)/embed/[projectSlug]/  embeddable widget (iframe target)
app/(admin)/dashboard/...          org admin: projects, inventory, layout, conflicts,
                                    leads, analytics, billing
app/(ops)/ops/...                  platform ops console (platform_owner only)
app/api/ai/chat/                   AI assistant route (tool-use loop server-side)
components/{map2d,map3d,chat,tracing,public,lead,plot,ui}
lib/{db,env,geometry,units,search,ai,import,storage,messaging,analytics,billing,otp,i18n,data}
supabase/migrations/               one file per phase, applied in order; supabase/seed.sql
tests/{unit,db,e2e,eval}
```

## Data model & tenancy

Every business table carries `org_id` (tenant) and, where relevant, `project_id`. RLS policies
call role-helper functions in the `app` schema (`app.has_project_role`, `app.has_org_role`,
`app.is_platform_owner`, ...) rather than duplicating role logic per policy. A
`platform_owner` (via `platform_staff`) satisfies every org/project role check — the ops
console relies on this rather than needing separate "superuser" policies.

## The public site's one access path

Buyer-facing reads/writes never touch tables directly under the `anon` role. Instead:

- `get_public_site_data(slug, password)` returns one JSON payload with everything the public
  page needs — already stripped of internal-only fields, so nothing downstream (search, the
  AI assistant, the embed widget) can leak what it was never given.
- `submit_public_lead`, `verify_project_password`, `track_event`, `reserve_ai_turn`,
  `log_ai_turn` are the only other anon-callable RPCs, each re-validating link/publish state on
  every call (`app.check_public_project_access`) rather than trusting a prior check.

## Layout ingestion (Phase 7)

`layout_versions` holds one row per traced/imported version of a project's layout; only one can
have `status = 'published'` at a time (a partial unique index). Three ways to populate one:

1. **Manual tracing** (`components/tracing/tracing-editor.tsx`) — an SVG polygon tracer over an
   uploaded raster image, with a calibration step (two clicked points + a real distance) that
   converts traced pixel coordinates into real-world feet.
2. **GeoJSON/KML import** (`lib/import/{geojson,kml}.ts`) — when the builder already has vector
   data, coordinates are projected into local feet around the project's own lat/lng
   (`lib/geometry/projection.ts`, a flat-earth approximation that's accurate to well under a
   foot at single-project scale) and imported directly, already calibrated.
3. **PDF vector/raster auto-extraction and an AI vision adapter are _not_ implemented** — the
   spec's own honesty note says fully automatic extraction isn't reliable, and building it
   without a way to validate results in this environment would just be a fragile approximation
   presented as more capable than it is. The `extraction_jobs` table and its `kind` enum
   already model where this would plug in later.

Whichever path populates it, `public.publish_layout_version()` gates publishing on: at least
one traced plot, and zero open `data_conflicts` on this version's plots.

## AI assistant (Phase 6)

`lib/ai/provider.ts` defines a provider-agnostic `ChatProvider` interface; `anthropic-provider.ts`
runs the Anthropic tool-use loop server-side (max 6 rounds) so no raw provider message ever
reaches the client. Tools (`lib/ai/tools.ts`) read only from the already public-safe
`PublicSiteData` payload — the model cannot be handed a field it wasn't given. `reserve_ai_turn`
meters usage against the org's plan _before_ the model is called; `log_ai_turn` records the
exchange after. With no `AI_API_KEY` configured, the route returns an honest
"not configured" message rather than failing or fabricating a reply — the same pattern used
for maps (`MAP_API_KEY`), billing (`RAZORPAY_*`), and OTP.

## Analytics & billing (Phase 9)

`analytics_events` is one flat table; the admin Analytics page reconciles funnel numbers,
most-viewed plots, and a demand-vs-inventory gap table directly from it plus `leads`/
`site_visits` — no separate rollup table to drift out of sync. Plan limits
(`plans.limits` jsonb: `projects`, `plots`, `ai_messages_per_month`) are enforced by
`BEFORE INSERT` triggers on `projects`/`plots`, not just checked in the UI, and usage is
metered in `usage_counters` keyed by `(org_id, period, metric)`.

## What's deliberately not built

Every one of these is a disclosed gap (Product Contract rule 2: truth over polish), not an
oversight:

- PDF vector-path extraction and AI-vision layout assist (see above).
- DXF import (a real CAD-format parser is a substantial project on its own).
- A real payment provider adapter — `lib/billing/provider.ts` defines the interface;
  `getBillingProvider()` returns `null` without Razorpay keys rather than faking checkout.
- A real OTP/SMS adapter — `lib/otp/provider.ts`, same pattern.
- A real WhatsApp Business API adapter — `lib/messaging/whatsapp-business.ts`, same pattern;
  today's WhatsApp integration is click-to-chat `wa.me` links, which need no credentials.
- Custom domain provisioning — documented as a manual step in project settings.
- Background worker migration — there's no heavy synchronous processing in this build (no
  PDF extraction pipeline) to migrate off the request/response path.
- AR-ready hooks — the spec explicitly says not to build this unless asked.
