# Webhooks (Phase 4)

## Endpoint

`GET|POST /api/webhooks/meta/whatsapp`

## Verification handshake (`GET`)

When this URL is registered in Meta's app dashboard as a webhook, Meta calls it once with
`hub.mode=subscribe`, `hub.verify_token`, and `hub.challenge` query params. The route checks
`hub.verify_token` against `META_WEBHOOK_VERIFY_TOKEN` and, if it matches, echoes back
`hub.challenge` as plain text with a 200. If `META_WEBHOOK_VERIFY_TOKEN` isn't set at all, the
route returns 503 rather than accepting an unconfigured handshake.

## Receiving deliveries (`POST`)

1. Read the **raw** request body (not a parsed/re-serialized object — signature verification
   needs the exact bytes Meta sent).
2. Verify `X-Hub-Signature-256` against the raw body using `META_WEBHOOK_APP_SECRET`, with a
   constant-time comparison (`src/server/webhooks/verify-signature.ts`). No app secret
   configured → 503. Signature present but wrong → 403. This check is never skipped, in mock
   mode or otherwise — per the project's security checklist, signature verification is not a
   "convenience" to disable.
3. Compute a SHA-256 hash of the raw body as the dedup key and insert into `webhook_events`
   with `ON CONFLICT (event_hash) DO NOTHING`. A duplicate delivery (Meta's own retries, or a
   webhook subscribed to more than once) is recognized and not reprocessed.
4. Respond `200` to Meta quickly.
5. Process the payload (`src/server/webhooks/process.ts`) — inline, not via a queue (there isn't
   one yet; see `docs/decisions.md`'s "don't add infrastructure before it's needed" principle).
   Success sets `processed = true`; a thrown error is caught and written to
   `processing_error` on the same row rather than crashing the response.

## What Phase 4 processes

- **Inbound text messages**: upserts the contact (by phone), finds or creates an `OPEN`
  conversation for that contact + phone number pair, inserts a `messages` row.
- **Status updates** (`sent`/`delivered`/`read`/`failed`): updates the matching `messages` row
  (found by `meta_message_id`) and appends a `message_statuses` row with the raw payload.

Deferred to a later phase: template status-change events, phone quality/limit-change events,
account update events (including coexistence offboard/reconnect — Phase 5), triggering
automations (Phase 8), and a real-time push to the dashboard (needs infrastructure not yet
built). An unprocessable/unrecognized webhook is not an error — it's stored and simply not
acted on, which keeps the endpoint forward-compatible with event types this phase doesn't
handle yet.

## A phone_number_id that doesn't match any onboarded number

If `metadata.phone_number_id` doesn't match a row in `whatsapp_phone_numbers`, the whole change
is skipped — there is nothing in our system yet to attach it to. This is the normal case in
mock mode today, since no organization has completed Embedded Signup (Phase 5) yet.

## An RLS gap this phase found and fixed

`whatsapp_phone_numbers` originally had only the generic per-tenant RLS policy
(`organization_id = app_org_id()`), with no platform-admin bypass. Webhook processing has to
look up which organization owns a `phone_number_id` before any `organization_id` is known — the
same kind of pre-tenant lookup that organization signup and login already needed special
policies for (migrations 0002, 0003). Fixed in `migrations/0004_phone_number_webhook_lookup.sql`.
See `docs/decisions.md` for the pattern this keeps recurring against: any new
system-level/pre-tenant lookup needs its own explicit RLS policy, it doesn't fall out for free
from an existing one.
