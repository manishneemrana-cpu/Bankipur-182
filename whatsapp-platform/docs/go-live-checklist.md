# Go-live checklist (Phase 13)

This is the punch list before this platform sends a real WhatsApp message to a real customer
or charges a real card. Everything in this repo up to Phase 12 was built and tested in
`MOCK_META=true` / `MOCK_PAYMENTS=true` mode — none of it has ever made a real Meta or
Razorpay API call. Going live is a deliberate, checked switch, not a default.

## 1. Meta App Review & Business verification

**Do this first — it can take days to weeks and blocks everything else.**

- [ ] Complete Meta Business Verification for SitesNSign Prop Tech Pvt. Ltd.
- [ ] Confirm this app's use case with Meta as a **Tech Provider** (not Solution Partner) —
      the whole `whatsapp_credentials` per-organization token design in this codebase assumes
      that model (see `docs/decisions.md`, `docs/meta-current-state.md`'s "Token model" section).
      If Meta's onboarding flow steers you toward Solution Partner instead, stop and re-read
      that section before proceeding — the architecture would need to change.
- [ ] Submit for App Review requesting `whatsapp_business_management` and
      `whatsapp_business_messaging` (Advanced Access). Per `docs/meta-current-state.md`
      (unverified against the primary source — see below), the reviewer demo reportedly needs
      to show an actual message send and an actual template creation through this app, not a
      screenshot.
- [ ] **Re-verify every fact in `docs/meta-current-state.md` against
      `developers.facebook.com` directly before submitting.** That document was written from
      search-engine snippets because this development environment's network policy blocked
      direct access to Meta's docs — it is explicitly flagged there as unverified secondhand
      information, current only as of September 2026, and Meta changes these details often.
      In particular: the Graph API version, the Embedded Signup v4 migration deadline
      (reportedly October 15, 2026), and the exact App Review demo requirements.

## 2. Switching Meta from mock to live

- [ ] Look up the actual current stable Graph API version at
      https://developers.facebook.com/docs/graph-api/changelog and set `META_GRAPH_API_VERSION`
      to it — never copy the number from `docs/meta-current-state.md`, which explicitly says
      not to trust its own guess.
- [ ] Set `META_APP_ID`, `META_APP_SECRET`, `META_BUSINESS_ID`, `META_WEBHOOK_VERIFY_TOKEN`,
      `META_WEBHOOK_APP_SECRET`, `META_EMBEDDED_SIGNUP_CONFIG_ID` from your real Meta App
      dashboard.
- [ ] Set `MOCK_META=false`. `src/server/env.ts` will refuse to boot if any required var above
      is missing — that's intentional, not a bug to work around.
- [ ] Register the production webhook URL (`https://<your-domain>/api/webhooks/meta/whatsapp`)
      in the Meta App dashboard and complete the verification handshake.
- [ ] Read `docs/embedded-signup.md` for what the Embedded Signup flow does and does NOT
      implement yet (the live JS SDK integration and code-exchange call are explicitly
      documented there as not built) — this must be finished before a real client can connect
      their own WhatsApp number.
- [ ] Onboard one real WhatsApp Business Account end-to-end (Embedded Signup → webhook
      verification → send a real template message → receive a real inbound message) before
      onboarding any actual customer. This is the first real integration test this codebase
      will have had with Meta's live systems.

## 3. Billing (Razorpay)

- [ ] `src/server/payments/provider.ts` only has a mock provider — no real `PaymentProvider`
      implementation exists yet (see `docs/billing.md`). Build and test one against Razorpay's
      current API/webhook docs before setting `MOCK_PAYMENTS=false`.
- [ ] Real prices: edit the seeded Starter/Business/AI Business/Enterprise plans at
      `/admin/plans` — the seeded values in migration `0006_seed_default_plans.sql` are
      explicitly placeholders, never meant to be quoted to a real customer.
- [ ] Real per-message pricing: populate `pricing_config` with real, dated rates once Meta
      confirms current pricing for your markets — never the illustrative figures in
      `docs/meta-current-state.md`.

## 4. Security

- [ ] Rotate `SESSION_SECRET` and `ENCRYPTION_KEY` to freshly generated values for production
      (never reuse a value from local development or this repo's `.env.example`).
- [ ] Confirm `DATABASE_URL` points at the unprivileged app role, never the superuser —
      `npm run migrate` creates and manages that role; see `docs/decisions.md` for why a
      superuser connection would silently bypass every RLS policy in this codebase.
- [ ] Run the full test suite (`npx vitest run`) against the production database configuration
      before first deploy — `tests/tenant-isolation.test.ts` and the RLS-focused tests across
      the suite are the actual guarantee that one organization can't see another's data.
- [ ] Read `docs/security-and-data-lifecycle.md` for what's built (audit logging, data export,
      contact/organization deletion requests) and what isn't (rate limiting, CSRF beyond
      Next.js defaults, automatic retention).

## 5. Legal

- [ ] `/privacy`, `/terms`, `/data-deletion` are explicitly placeholder pages
      (`src/components/legal-page.tsx`) — they say so on the page itself. Replace with real
      legal text reviewed by counsel for SitesNSign Prop Tech Pvt. Ltd. before accepting a
      single real customer. This codebase does not and should not attempt to draft real legal
      text.

## 6. Deployment

- [ ] Follow `docs/deployment-vps.md` for the VPS setup, including re-running
      `npm run migrate` on every deploy (it's idempotent — see the doc for why this matters).
- [ ] Set up backups (`pg_dump` on a schedule) — not yet covered by anything in this repo.
- [ ] After deploy, check `/admin/system-health` (not just `/api/health`) for database status,
      applied migration count, and mock-mode flags before announcing anything is live.

## What "done" looks like

Every phase 1-12 gate (typecheck, lint, build, `npx vitest run`, and a live Playwright-driven
browser check of the feature) has passed at every commit on this branch — see `docs/decisions.md`
for the recurring bug classes that discipline actually caught. None of that substitutes for the
items above: it proves the code behaves correctly in mock mode against a real Postgres instance,
not that Meta's live API, Razorpay's live API, or a lawyer has signed off on anything.
