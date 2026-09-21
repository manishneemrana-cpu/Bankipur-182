# Security hardening & data lifecycle (Phase 11)

## Audit logging

`src/server/audit.ts` — `recordAuditLog()` writes one immutable row per security-relevant
action. `audit_logs` has SELECT/INSERT policies only (migration `0008_audit_logs_admin_read.sql`)
— nothing in the app updates or deletes a row once written, and RLS itself blocks it.

Currently wired into:

- `team.member_added`, `team.role_changed`, `team.member_removed`
- `api_key.created`, `api_key.revoked`
- `outbound_webhook.created`, `outbound_webhook.deleted`
- `contact.deleted`, `organization.deletion_requested`

A platform admin views every organization's trail at `/admin/audit-logs`
(`listAuditLogsForAdmin()`); an organization only ever sees its own
(`listAuditLogsForOrganization()`, not yet surfaced in the dashboard UI — the admin view was
built first since it's the immediate compliance need).

**Not yet wired**: template CRUD, campaign launch, message sends, billing/plan changes,
onboarding/WhatsApp connection events. Adding a call is one line per action
(`await recordAuditLog(organizationId, userId, "action.name", { targetType, targetId, metadata })`)
— the four above were picked as the highest-value security-relevant actions for this phase, not
an exhaustive list.

## Data export (`data_export_requests`)

`exportOrganizationData()` (`src/server/data-lifecycle.ts`) builds the export **synchronously**
from live tables (contacts, leads, conversations, messages, templates) and returns it directly —
no file storage integration exists, so there's nothing to upload it to. The request is recorded
as `READY` immediately rather than `PENDING`/`PROCESSING`, since there's no async step. Download
via the dashboard's Settings page (`GET /api/dashboard/export?organizationId=...`,
session-authenticated, requires `manage_billing` permission).

**This does not scale to a large tenant** — a big organization's full message history built
synchronously in one request would time out or use excessive memory. Moving this to a background
job (writing to object storage, emailing a download link) is future work once tenant sizes
warrant it.

## Deletion requests (`deletion_requests`)

Two scopes, two very different levels of automation:

- **CONTACT** — `deleteContactData()` runs immediately and synchronously: deletes the contact
  (cascading to its conversations/messages/campaign_recipients via existing FK `ON DELETE
  CASCADE`), detaches it from any `leads` row (`contact_id` set to `NULL` — the lead record
  itself isn't deleted, since a sales pipeline entry isn't "the contact's data" in the same
  sense) and any `send_jobs` row (deleted outright — nothing consumes that table yet). The
  `deletion_requests` row is recorded as `DONE`, not `PENDING`, since it already happened. This
  fixed a real latent bug: the dashboard's existing "Delete" button on the Contacts page
  (`deleteContact` in `contact-actions.ts`) previously ran a bare `DELETE FROM contacts`, which
  would have failed with a foreign-key violation the first time it hit a contact linked to a
  lead (`leads.contact_id` has no `ON DELETE` behavior) — never caught before because no test
  or manual click had exercised that combination.
- **ORGANIZATION** — `requestOrganizationDeletion()` only ever inserts a `PENDING` row. Deleting
  an entire tenant's data is never a self-service, instant action — the dashboard's Settings
  page requires an explicit two-step confirmation and then just flags the request; a platform
  admin must review and action it manually. There is currently no admin UI to action a pending
  organization deletion request (only to see the org exists) — that's the next piece of this
  workflow, not yet built.

## What's NOT built in this phase

- Rate limiting on `/api/v1/...`, the n8n webhook, or auth endpoints (login/register) — no
  infrastructure (Redis) is wired up for it yet.
- CSRF protection beyond Next.js's own defaults for Server Actions (same-origin enforcement).
- An admin UI to action a pending `ORGANIZATION`-scope deletion request (see above).
- Automatic data retention (e.g. auto-deleting suppressed contacts after N days) — nothing
  in the brief specified a retention period, and inventing one would be a compliance risk in
  either direction (too short or too long for the jurisdiction actually in effect).
