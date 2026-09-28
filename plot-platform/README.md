# Plot Platform

Upload a plot layout PDF → get a live, branded, mobile-first project website with an
interactive plot map, live availability, AI sales assistant and lead capture on one link.

Product spec: [`docs/MASTER_PROMPT.md`](docs/MASTER_PROMPT.md). Working rules: [`CLAUDE.md`](CLAUDE.md).

## Status

**Phase 0 — Foundation.** Next.js 16 (App Router) + strict TypeScript, Tailwind v4 +
shadcn/ui, ESLint + Prettier, zod-validated env, Supabase local dev config, Vitest,
Playwright, GitHub Actions CI. No product features yet.

## Run it

```bash
cd plot-platform
npm install
cp .env.example .env.local    # optional in Phase 0 — the app boots without it
npm run dev                   # http://localhost:3000
```

Local database (needs Docker, used from Phase 1):

```bash
npm run db:start              # prints the local URL + keys for .env.local
```

## Checks

| Command            | What                                          |
| ------------------ | --------------------------------------------- |
| `npm run ci`       | typecheck, lint, format check, unit tests     |
| `npm run test:e2e` | Playwright smoke (desktop + mobile viewports) |
| `npm run format`   | apply Prettier                                |

CI runs the same steps plus a production build and e2e on every push/PR touching
`plot-platform/` (`.github/workflows/plot-platform-ci.yml` at the repo root).

## Layout

```
app/(public)/p/[projectSlug]/...   buyer-facing project site (Phase 3+)
app/(admin)/dashboard/...          org admin (Phase 1+)
app/(ops)/ops/...                  platform ops console (Phase 9)
app/api/                           route handlers (/api/health today)
components/{map2d,map3d,plot,chat,lead,ui}
lib/{db,env,geometry,ai,pdf,import,maps,analytics,billing,messaging,i18n}
supabase/                          local config + migrations
tests/{unit,e2e}
```
