# Runbook

Operational notes for running, deploying and maintaining Plot Platform. See
[`ARCHITECTURE.md`](ARCHITECTURE.md) for how it's built, and [`MASTER_PROMPT.md`](MASTER_PROMPT.md)
for the product spec.

## Deploying

### Vercel (primary path)

The app deploys as a normal Next.js project — connect the repo, set the project root to
`plot-platform/`, and set the environment variables from `.env.example` in the Vercel project
settings (Production + Preview). `next.config.ts` sets `output: "standalone"`, which Vercel
handles natively; nothing extra is needed there.

Minimum to go live: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `PUBLIC_BASE_URL` (your production URL). Everything
else (`AI_*`, `MAP_*`, `RAZORPAY_*`, `WHATSAPP_API_ADAPTER`) is optional — its feature degrades
to an honest "not configured" message when unset rather than failing.

### Docker / VPS (alternative path)

```bash
cp .env.example .env        # fill in the same variables as above
docker compose up -d --build
```

This runs the Next.js app only (see `docker-compose.yml`'s comment) — you still need a Supabase
project (hosted, or self-hosted separately; that's a much larger undertaking, see
<https://supabase.com/docs/guides/self-hosting>) for Postgres/Auth/Storage. Put a reverse proxy
(Caddy/nginx/Traefik) with TLS in front of port 3000 for a real domain.

## Database

- Migrations: `supabase/migrations/*.sql`, one file per phase, applied in order — never edit an
  already-applied migration; add a new one.
- Apply to a fresh local Postgres for testing: `npm run test:db` (wraps `scripts/db-local.sh`,
  no Docker needed — it uses the sandbox's own `postgresql` binaries).
- Apply to the real Supabase project: via the Supabase CLI (`supabase db push`) or the
  Supabase MCP tool's `apply_migration`, in migration-file order.
- Demo data: `supabase/seed.sql` — idempotent (fixed UUIDs, `on conflict do nothing`), safe to
  re-run.

## Backups

Supabase hosted projects take automatic daily backups (point-in-time recovery on paid tiers) —
no extra setup needed for the primary data store. For self-hosted Postgres, schedule
`pg_dump` (or a WAL-archiving tool) separately; this isn't wired up in this build.

Uploaded layout files live in the `project-files` Storage bucket (private) — back it up the
same way you'd back up any object storage the Supabase project uses.

## Adding a new project (as a builder)

1. Sign up / sign in, create an org (`/setup-org` on first login).
2. `Dashboard → Projects → New` — basic info.
3. `Settings → Location` — set the project's address/city/state/lat/lng (needed for the public
   Location map and as the projection origin for GeoJSON/KML import).
4. `Layout` — upload a PDF/image and trace it, or import GeoJSON/KML if you already have
   vector data.
5. `Import inventory` — CSV of plots (template columns shown on that page).
6. `Conflicts` — resolve anything flagged between the traced layout and the imported inventory.
7. `Settings` — link security (public/password/unlisted/expiring), then **Publish project**.
8. `Layout` → open the version → **Publish this version** once at least one plot is traced and
   there are no open conflicts on it.
9. Share the link: `PUBLIC_BASE_URL/p/{slug}`, or the embed snippet from `Settings`.

## Known operational gaps (see `ARCHITECTURE.md` for the full list)

- No real payment/OTP/WhatsApp-Business/maps provider is wired up without their respective API
  keys — those features report themselves as unavailable rather than failing silently.
- No automatic PDF vector extraction — every raster/PDF upload needs manual tracing (or use the
  GeoJSON/KML import path if vector data already exists).
- No DXF import.
- `npm run test:eval` (the AI behavioral eval suite, §21 tests 9-11 + red-team) only runs real
  assertions when `AI_API_KEY` is set in the shell running it — it skips cleanly otherwise, so
  it's always safe to run but only meaningful with a key.
