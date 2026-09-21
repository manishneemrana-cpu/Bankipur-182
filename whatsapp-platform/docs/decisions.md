# Decisions and assumptions (Phase 1)

This file records every architectural assumption made so far, per the project rule that
nothing about Meta, hosting, or tenant isolation gets invented silently.

## Tenant term

Every tenant-scoped table uses `organization_id` (not `tenant_id`), consistently across
the schema, the code, and RLS policies.

## Hosting: self-hosted Postgres + Docker on a Hostinger VPS, not Supabase/Vercel

The original brief assumed Supabase (managed Postgres/Auth/Storage/Realtime) and Vercel.
The founder wants everything running on a Hostinger VPS under `www.manishpandey.in`, so
Phase 1 instead uses:
- Plain PostgreSQL 16 (via Docker) instead of Supabase — RLS still works identically,
  since it's a native Postgres feature, not a Supabase-only one.
- A custom session-cookie auth system (bcrypt + signed JWT cookie) instead of Supabase Auth.
- No Supabase Storage yet — deferred until a phase that needs file uploads (media messages,
  template assets). Will likely be local disk + a periodic backup job, or S3-compatible
  object storage if the VPS plan doesn't have enough disk headroom.
- No Supabase Realtime yet — deferred until the shared inbox phase. Options to evaluate then:
  a lightweight WebSocket server in the same Next.js process, or a small dedicated service.
- Redis is provisioned in `docker-compose.yml` from day one (cheap on a VPS) but unused
  until the job-queue/bulk-sending phase, per the "don't add infrastructure before it's
  needed" principle in the project rules.

This is a bigger change than "swap one library for another" — it means Phase 1 rebuilds
auth and the DB access layer from scratch rather than reusing Supabase's. That tradeoff was
made explicitly with the founder rather than assumed silently.

## Two-role database model (a real production requirement, not a style choice)

**Postgres superusers always bypass Row-Level Security, and table owners bypass it too
unless `FORCE ROW LEVEL SECURITY` is set** — this was discovered empirically while writing
the tenant-isolation tests in Phase 1 (see `tests/tenant-isolation.test.ts`), not assumed.
The first version of the migration script ran everything (schema creation AND the app's
runtime queries) as the same Postgres bootstrap superuser, which made every RLS policy in
`migrations/0001_init.sql` silently do nothing.

The fix, now in place:
- `MIGRATE_DATABASE_URL` — a superuser-ish connection, used **only** by `npm run migrate`
  to create/alter tables.
- `DATABASE_URL` — a separate, unprivileged role (`NOSUPERUSER NOBYPASSRLS`) that the
  Next.js app and the automated tests actually connect as. `npm run migrate` creates and
  grants this role automatically from the credentials embedded in `DATABASE_URL`.

Anyone deploying this must keep those two URLs genuinely different. Using the same
superuser connection string for both would quietly disable tenant isolation.

## RLS and connection pooling: normalizing `''` vs `NULL`

Also discovered while writing the isolation tests: once a custom Postgres GUC like
`app.org_id` has been `SET LOCAL` on a given backend connection, Postgres resets it to an
**empty string**, not `NULL`, once that transaction ends — because the placeholder
variable now exists. Since `pg.Pool` reuses backend connections across requests, a request
that forgot to set `app.org_id` would either crash on `''::uuid` or (worse, in a subtly
different policy shape) silently inherit a stale value from a previous request on the same
connection. Fixed with two SQL helper functions, `app_org_id()` and
`app_is_platform_admin()`, that both treat `''` and unset as "no value" (see
`migrations/0001_init.sql`).

## Platform-admin bypass is opt-in per table, not global

Only `organizations` and `organization_members` have an `OR app_is_platform_admin()` clause
in their RLS policy. Every other tenant table (contacts, messages, conversations, leads,
campaigns, billing, etc.) has isolation-only policies with **no** admin bypass. This
directly implements the brief's requirement that "Admin should not see customer message
content by default" — it's enforced at the database level, not just hidden in the UI.

The bypass exists on those two tables specifically because organization signup creates the
first `organizations` row and the founding `OWNER` membership in the same transaction,
before any `organization_id` exists to scope the session to.

## Auth stack

- Passwords: `bcryptjs`, cost factor 12.
- Sessions: a signed (HS256) JWT in an `httpOnly`, `sameSite=lax`, `secure`-in-production
  cookie, verified with `jose`. No session table yet — acceptable for Phase 1's scope
  (single device sign-in/out); revocable server-side sessions can be added later if needed
  (e.g. for "log out all devices").
- `organizationId` is **never** read from a header, query string, or request body. Every
  server action/route resolves it from the authenticated session and the
  `organization_members` table, via `requireOrgContext()`.

## Messages/webhook_events partitioning

`messages` is partitioned by `created_at` range (with a single `DEFAULT` partition for now;
time-bucketed partitions are a later-phase operational task, not a Phase-1 concern).
`webhook_events` was **not** partitioned, on purpose: its dedup key (`event_hash`) must stay
globally unique, and partitioning by insertion time would let a retried webhook delivery
land in a different partition and defeat that uniqueness constraint. Revisit only if webhook
volume actually requires it, with a proper time-bucketed dedup design at that point.

## Phase 2: RLS gaps found by an actual browser-driven smoke test, not just unit tests

The Phase 1 tenant-isolation tests exercised each table's RLS policy in isolation and all
passed, but they didn't catch two real bugs that only showed up when Phase 2 built a real
signed-in dashboard and it was tested by actually registering and loading pages in a browser
(not just `npm run build` succeeding):

1. **`organization_members` couldn't be looked up by a user who didn't know their
   organization_id yet** (needed for login and "which orgs am I in"). Fixed in
   `migrations/0002_membership_self_lookup.sql` by adding an `app_user_id()` session setting
   and letting a user read their own membership rows by `user_id`, while keeping writes
   restricted to an already-established `organization_id` context (so a user still can't
   grant themselves membership in an arbitrary organization).
2. **The join from `organization_members` to `organizations`** (exactly what
   `getUserOrganizations()` runs) silently dropped every row, because `organizations`' RLS
   policy only allowed `id = app_org_id()` (not yet set, in this lookup) or a platform admin.
   A freshly-registered user's own dashboard redirected them straight back to `/register`, as
   if they belonged to no organization — even though their membership row existed and the
   signup transaction had committed successfully. Fixed in
   `migrations/0003_organizations_member_read.sql` by letting a user `SELECT` any organization
   they have a membership row in, while keeping `INSERT`/`UPDATE`/`DELETE` exactly as
   restrictive as before.

Lesson applied going forward: a new RLS policy isn't trusted until something exercises the
actual multi-table query shape the application code will run, not just single-table reads
against a manually seeded row.

## Phase 3: token model confirmed, and a real network restriction in this build environment

The master brief flagged `META_SYSTEM_USER_ACCESS_TOKEN` as "only if current docs confirm this
applies to our Tech Provider setup — otherwise document why it's unused." Phase 3 research
(see `docs/meta-current-state.md`) found the answer: **a Tech Provider uses per-client
"Business Integration System User" tokens obtained through Embedded Signup, not one shared
system-user token.** That's exactly what `whatsapp_credentials` (one encrypted token per
organization) already implements, so no schema change was needed — `META_SYSTEM_USER_ID` /
`META_SYSTEM_USER_ACCESS_TOKEN` were removed from `.env.example` with an explanation, rather
than left in as unused placeholders.

Also worth being direct about: this build environment's network egress policy blocks
`developers.facebook.com` (and several other domains) outright — every attempt to fetch Meta's
own docs directly failed with `EGRESS_BLOCKED`. Phase 3's research in
`docs/meta-current-state.md` is therefore built from web-search snippets of Meta's docs, not
from reading the primary source directly. That document says so plainly and names exactly which
facts need re-verification (and by when — one of them, the Embedded Signup v4 migration
deadline, is time-sensitive) before Phase 5 depends on them.

## Phase 4: a recurring RLS pattern worth naming explicitly

Four separate times now (organization_members' self-lookup, organizations' member-read,
webhook_events' pre-tenant insert, and now whatsapp_phone_numbers' webhook lookup), a real bug
turned out to be: some operation legitimately needs to run *before* an `organization_id` is
known (signup, login, or Meta calling our server directly with only a `phone_number_id`), and
the table's RLS policy only knew about `app_org_id()` — so the operation silently saw/wrote
nothing rather than erroring loudly.

The pattern going forward: **any new "resolve the organization from an external key" or
"pre-tenant" operation needs its own explicit RLS policy addition, checked against a real test
that exercises that exact query — it does not fall out for free from the generic
`tenant_isolation` policy, and it is not safe to assume by analogy that a similar-looking table
already has it.** `webhooks.md` documents the specific instance for `whatsapp_phone_numbers`.

## Deferred to later phases (not yet built)

- Everything Meta/WhatsApp-specific (Cloud API client, Embedded Signup, webhooks, Compliance
  Guardian) — Phase 1 only lays down the schema for it. Per the project rules, Meta's
  current official docs must be checked before any of that code is written (Graph API
  version, Embedded Signup v4 vs v2 timeline, coexistence requirements, token model for a
  Tech Provider). None of that has been researched yet — do not assume the schema's
  `META_GRAPH_API_VERSION`-style env var placeholders reflect a verified current value.
- Encryption of `whatsapp_credentials.encrypted_token` (AES-256-GCM) — the column and
  `key_version` field exist, but the encrypt/decrypt code isn't written until the phase that
  actually stores a token.
- Redis-backed job queue, AI/Calling provider interfaces, billing/Razorpay integration,
  public API + API keys enforcement, outbound webhooks delivery, audit log writers.
