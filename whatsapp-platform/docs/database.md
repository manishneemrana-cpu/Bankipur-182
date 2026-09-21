# Database (Phase 1)

Full schema: `migrations/0001_init.sql`. Applied and verified against a real PostgreSQL 16
instance as part of this phase (not just written and hoped to work).

## Tenant model

- Tenant term: `organization_id` everywhere (not `tenant_id`).
- Every tenant-scoped table has `organization_id`, an index on it, and Row-Level Security
  with a `USING`/`WITH CHECK` policy of `organization_id = app_org_id()`.
- `app_org_id()` and `app_is_platform_admin()` are small SQL helper functions that read the
  `app.org_id` / `app.is_platform_admin` session settings the app sets per-transaction (see
  `src/server/db.ts`), normalizing Postgres's `''`-vs-`NULL` behavior on custom GUCs across
  pooled connections (see `docs/decisions.md` for why that matters).

## Tables (grouped)

- **Tenancy**: `organizations`, `users`, `organization_members` (role: OWNER/ADMIN/MANAGER/
  AGENT/VIEWER, plus a `permissions` text[] for granular overrides).
- **WhatsApp/Meta**: `whatsapp_accounts`, `whatsapp_phone_numbers`, `whatsapp_credentials`
  (encrypted token, never selected into any client-facing API), `onboarding_sessions` (state
  machine: STARTED → ... → CONNECTED/FAILED/DISCONNECTED).
- **Messaging/CRM**: `contacts` (with opt-in/opt-out fields for the future Compliance
  Guardian), `conversations`, `conversation_participants`, `message_templates`, `campaigns`,
  `campaign_recipients`, `messages` (partitioned by `created_at`), `message_statuses`,
  `send_jobs`, `leads`, `notes`, `tasks`.
- **Automation**: `automations`, `automation_runs`.
- **Billing**: `plans`, `subscriptions`, `invoices`, `invoice_line_items`, `usage_records`,
  `meta_usage_records` (informational only — Meta bills the client directly), `pricing_config`
  (admin-editable; Meta's per-message prices are never hard-coded in application code).
- **API/webhooks**: `api_keys` (hash + short prefix stored, full key shown once),
  `webhook_events` (deduped by `event_hash`, not partitioned — see `decisions.md`),
  `outbound_webhooks`, `outbound_webhook_deliveries`.
- **Ops**: `audit_logs`, `notifications`, `feature_flags`, `data_export_requests`,
  `deletion_requests`.

## Two database roles — required, not optional

- `MIGRATE_DATABASE_URL`: a superuser-ish role. Used only by `npm run migrate`.
- `DATABASE_URL`: an unprivileged role (`NOSUPERUSER NOBYPASSRLS`), auto-created/updated by
  `npm run migrate` from the credentials in this URL. This is what the app and tests connect
  as. **If both env vars point at the same superuser, Row-Level Security silently does
  nothing** — Postgres superusers bypass RLS unconditionally. This was caught by the Phase 1
  tenant-isolation tests, not assumed to be fine.

## Running migrations

```bash
cp .env.example .env   # fill in real values
npm run migrate
```

Safe to run repeatedly — already-applied migrations are tracked in `schema_migrations` and
skipped.

## Tenant isolation tests

`npm test` runs `tests/tenant-isolation.test.ts` against a real Postgres database (not a
mock), connected as the same unprivileged runtime role the app uses. It proves, for a real
RLS-enabled table:
- an organization can read/write its own rows,
- it cannot read another organization's rows,
- it cannot `UPDATE`/`DELETE` another organization's rows even by primary key,
- it cannot `INSERT` a row tagged with another organization's id,
- a session with no organization context set at all sees nothing,
- a platform-admin session can see across organizations only where that's explicitly
  intended (`organizations`, `organization_members`) — not on tables carrying customer
  message/contact/lead content.
