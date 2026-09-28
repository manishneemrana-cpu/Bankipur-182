# Plot Platform

Upload a plot layout PDF → get a live, branded, mobile-first project website with an
interactive plot map, live availability, AI sales assistant and lead capture on one link.

Product spec: [`docs/MASTER_PROMPT.md`](docs/MASTER_PROMPT.md). Working rules: [`CLAUDE.md`](CLAUDE.md).
Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Deploy/ops: [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

## Status

All 10 build phases (§20) are in: foundation, data/admin inventory + RLS, the 2D map engine,
the buyer-facing project site (search/filters/Find My Plot/compare), deep links/sharing/leads,
the AI sales assistant, layout ingestion (manual tracing + GeoJSON/KML import), the location
map + illustrative 3D view, analytics + SaaS billing scaffolding, and the scale/advanced
extras (embed widget, custom-domain settings stub, Docker/VPS deploy path).

Several features that need credentials this environment doesn't have (an AI provider key, a
maps API key, Razorpay keys, an SMS/OTP provider, a WhatsApp Business API adapter) are built as
real, provider-agnostic interfaces that report themselves honestly as "not configured" rather
than failing or fabricating a response — see `docs/ARCHITECTURE.md`'s "What's deliberately not
built" section for the full, disclosed list (PDF auto-extraction and DXF import are the two
biggest ones).

## Run it

```bash
cd plot-platform
npm install
cp .env.example .env.local    # fill in Supabase URL + anon key to use auth/data features
npm run dev                   # http://localhost:3000
```

Without `.env.local`, the app still boots (`/`, `/api/health`) but `/dashboard` needs a real
Supabase project to sign in against.

## Database

```bash
npm run db:start   # local Postgres (Docker) with the shim + all migrations + seed applied
npm run db:reset   # re-apply from scratch
```

Migrations live in `supabase/migrations/`, demo data in `supabase/seed.sql`. Both are also
applied to the project's real Supabase instance (see the owner for the project ref).

## Checks

| Command             | What                                                        |
| ------------------- | ----------------------------------------------------------- |
| `npm run ci`        | typecheck, lint, format check, unit tests, DB/RLS tests     |
| `npm run test:db`   | just the DB/RLS suite, against a throwaway local Postgres   |
| `npm run test:eval` | AI behavioral eval suite — skips cleanly without AI_API_KEY |
| `npm run test:e2e`  | Playwright smoke (desktop + mobile viewports)               |
| `npm run format`    | apply Prettier                                              |

CI runs typecheck/lint/format/unit tests, the DB/RLS suite against a Postgres service
container, and a production build + Playwright e2e, on every push/PR touching
`plot-platform/` (`.github/workflows/plot-platform-ci.yml` at the repo root).

## Deploying

Vercel (primary) or Docker/VPS (`Dockerfile` + `docker-compose.yml`) — see
[`docs/RUNBOOK.md`](docs/RUNBOOK.md) for both paths, required env vars, and the "adding a new
project" walkthrough.

## Layout

```
app/(public)/p/[projectSlug]/...   buyer-facing project site
app/(public)/embed/[projectSlug]/  embeddable widget (iframe target)
app/(admin)/dashboard/...          org admin: projects, inventory, layout, conflicts, leads,
                                    analytics, billing
app/(ops)/ops/...                  platform ops console
app/api/ai/chat/                   AI assistant route
app/login, app/signup, app/setup-org, app/auth/callback   auth
components/{map2d,map3d,plot,chat,tracing,lead,ui,forms,import,public}
lib/{db,env,geometry,units,search,ai,import,storage,messaging,analytics,billing,otp,i18n,data}
supabase/                          migrations + seed (applied locally and to the real project)
tests/{unit,db,e2e,eval}
```
