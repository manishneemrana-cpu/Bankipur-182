@AGENTS.md

# Plot Platform — working agreement

Full spec: `docs/MASTER_PROMPT.md`. Build **one phase at a time** (§20); stop at each gate
and list what the owner should verify. Do not start the next phase unasked.

This app lives in `plot-platform/` inside a repo that also holds an unrelated app at the repo
root. Never modify files outside `plot-platform/` except `.github/workflows/plot-platform-ci.yml`
(the root `tsconfig.json` and `eslint.config.mjs` exclude this folder so the two apps never
type-check or lint each other).

## Commands (run from `plot-platform/`)

- `npm run dev` — dev server (works with no env vars set)
- `npm run ci` — typecheck + lint + format check + unit tests (same as CI)
- `npm run test:e2e` — Playwright smoke tests (desktop + Pixel 7)
- `npm run db:start` / `db:reset` — local Supabase (needs Docker)

## Conventions

- Next.js 16: `proxy.ts` not `middleware.ts`; `params`/`searchParams`/`cookies()` are async;
  use the global `PageProps<'/route'>` / `LayoutProps<'/route'>` helpers.
- Env: server code reads `serverEnv()` from `lib/env/server.ts`; client code reads
  `clientEnv` from `lib/env/client.ts`. Features call `required(env, "KEY")` at use time.
- The platform name lives only in `lib/constants.ts` (a unit test enforces this).
- Every table: `id`, `org_id`, `created_at`, `updated_at`, `created_by`, RLS on.

---

## 0. PRODUCT CONTRACT (copy this section into CLAUDE.md)

**Product name:** `{{PRODUCT_NAME}}` (placeholder — keep it configurable in one constants file; never hard-code any company name in UI).

**One-line promise:** _"Upload your plot layout PDF. Get a live, branded, mobile-first project website with an interactive plot map, real-time availability, AI sales assistant and lead capture — on one WhatsApp-shareable link."_

**Who pays:** Builders, land developers, plotting-scheme promoters, brokers / channel partners.
**Who uses the output:** Their buyers — mostly on mid-range Android phones, opening a WhatsApp link on 4G, in Hindi or English.

**Non-negotiable rules (apply to every phase):**

1. **White-label.** No platform/vendor branding on any public page, metadata, OG image, favicon, email or WhatsApp text unless an org admin explicitly turns on "Powered by" in settings (default OFF).
2. **Truth over polish.** Never fabricate plot data, prices, availability, coordinates, distances, 3D features, legal status or returns. Missing data shows as "Not provided" / "Contact sales" — never a guess.
3. **Draft → Review → Publish.** Anything produced by AI, OCR, CV or auto-calculation is a DRAFT until a human with the right role approves it.
4. **Conflicts are surfaced, never silently resolved.** Two sources disagree → create a `data_conflict` record and block "verified" status for that field.
5. **Availability is live or it is hidden.** If live inventory can't be fetched, show "Live availability temporarily unavailable — please contact sales." Never show cached "Available" as current.
6. **Mobile first, 2D first.** Public page must be usable on a 360px-wide phone on slow 4G. 3D loads only on demand.
7. **Tenant isolation.** Every row belongs to an organization; enforce with Postgres Row Level Security, not just app code.
8. **No secrets in the client.** All AI, maps and storage keys are server-side.
9. **Small, verifiable steps.** Each phase ends with passing tests and a runnable demo. Don't start the next phase unasked.
