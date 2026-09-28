# Plot Platform

Upload a plot layout PDF → get a live, branded, mobile-first project website with an
interactive plot map, live availability, AI sales assistant and lead capture on one link.

Product spec: [`docs/MASTER_PROMPT.md`](docs/MASTER_PROMPT.md). Working rules: [`CLAUDE.md`](CLAUDE.md).

## Status

**Phase 1 — Data & Admin Inventory.** All 20 tables + Row Level Security (§5), auth
(email/password via Supabase Auth, org self-signup), org/project/plot CRUD, the plot status
state machine, anti-double-booking holds, audit trails (`plot_status_history`,
`field_change_log`, `audit_log`), CSV inventory import with row-level validation, the data
conflicts workflow (Product Contract rule 4), and the "Green Valley Enclave (DEMO)" seed data
(§19) — applied to the live Supabase project and to a disposable local Postgres for tests.

Phase 0 (foundation) is unchanged underneath: Next.js 16, strict TypeScript, Tailwind v4 +
shadcn/ui, ESLint + Prettier, Vitest, Playwright, GitHub Actions CI.

The buyer-facing public site, 2D map, AI assistant, layout ingestion and 3D view land in later
phases (§20) — the admin dashboard here is functional, not yet polished.

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

| Command            | What                                                      |
| ------------------ | --------------------------------------------------------- |
| `npm run ci`       | typecheck, lint, format check, unit tests, DB/RLS tests   |
| `npm run test:db`  | just the DB/RLS suite, against a throwaway local Postgres |
| `npm run test:e2e` | Playwright smoke (desktop + mobile viewports)             |
| `npm run format`   | apply Prettier                                            |

CI runs typecheck/lint/format/unit tests, the DB/RLS suite against a Postgres service
container, and a production build + Playwright e2e, on every push/PR touching
`plot-platform/` (`.github/workflows/plot-platform-ci.yml` at the repo root).

## Layout

```
app/(public)/p/[projectSlug]/...   buyer-facing project site (Phase 3+)
app/(admin)/dashboard/...          org admin: overview, projects, plots, import, conflicts
app/(ops)/ops/...                  platform ops console (Phase 9)
app/login, app/signup, app/setup-org, app/auth/callback   auth
app/api/                           route handlers (/api/health today)
components/{map2d,map3d,plot,chat,lead,ui,forms,import}
lib/{db,env,geometry,units,ai,pdf,import,maps,analytics,billing,messaging,i18n,data}
supabase/                          migrations + seed (applied locally and to the real project)
tests/{unit,db,e2e}
```
