# API (Phase 10)

Two ways in, both authenticated the same way (`Authorization: Bearer <api key>`, a key created
on the dashboard's API page, scoped per-key), and one way out (outbound webhooks).

## Authentication

Every request needs `Authorization: Bearer wap_...`. A key's scopes gate which actions it can
take — a request needing a scope the key doesn't have gets `403`. Keys are stored as a SHA-256
hash (never the raw value); the raw key is shown once, at creation, and never again.

Scopes: `contacts.read`, `contacts.write`, `leads.read`, `leads.write`, `whatsapp.messages.send`.

## Public REST API — `/api/v1/...`

### `GET /api/v1/contacts`

Scope: `contacts.read`. Query params: `limit` (default 50, max 200).

```json
{ "data": [{ "id": "...", "phone_e164": "+91...", "name": "...", "tags": [], "suppressed": false, "created_at": "..." }] }
```

### `POST /api/v1/contacts`

Scope: `contacts.write`. Upserts by phone number (create if new, merge name/tags if it already
exists). Fires a `contact.created` outbound webhook event when the contact is new.

```bash
curl -X POST https://your-domain/api/v1/contacts \
  -H "Authorization: Bearer wap_..." -H "Content-Type: application/json" \
  -d '{"phoneE164":"+919876543210","name":"Jane","tags":["website"]}'
```

### `GET /api/v1/leads`

Scope: `leads.read`. Query params: `limit` (default 50, max 200).

### `POST /api/v1/leads`

Scope: `leads.write`. Creates a lead and fires a `lead.created` outbound webhook event.

```bash
curl -X POST https://your-domain/api/v1/leads \
  -H "Authorization: Bearer wap_..." -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","phone":"+919876543210","property":"2BHK Bankipur","budget":5000000}'
```

### `POST /api/v1/messages/send-template`

Scope: `whatsapp.messages.send`. Sends an approved WhatsApp template to a phone number
(creates the contact if it doesn't exist yet). Same rules as the dashboard's send flow: the
template must be `APPROVED`, and the usual suppression/compliance checks apply.

```bash
curl -X POST https://your-domain/api/v1/messages/send-template \
  -H "Authorization: Bearer wap_..." -H "Content-Type: application/json" \
  -d '{"phoneE164":"+919876543210","templateId":"..."}'
```

Errors: `400` invalid body, `401` missing/invalid key, `403` missing scope, `422` a
`MessagingError` (e.g. template not approved, contact suppressed) with `{ "error": "...", "code": "..." }`.

## n8n integration webhook (narrower, action-dispatch style)

`POST /api/integrations/n8n/webhook` — same Bearer auth. A single endpoint dispatching by an
`action` field (`contacts.upsert`, `leads.create`, `messages.sendTemplate`), predating the
`/api/v1/...` REST surface above and kept for existing n8n workflows built against it. New
integrations should prefer `/api/v1/...`.

## Outbound webhooks

Configured per-organization on the dashboard's Integrations page. Each webhook subscribes to
one or more event types and gets an HMAC-SHA256 signing secret (shown once, at creation).

Event types: `lead.created`, `contact.created`, `message.received` (an inbound WhatsApp
message from a contact).

Delivery: `POST` to the webhook's URL with:

```json
{ "eventType": "lead.created", "organizationId": "...", "payload": { "...": "..." }, "sentAt": "2025-01-01T00:00:00.000Z" }
```

and header `X-Webhook-Signature: <hex>` — HMAC-SHA256 of the raw JSON body, keyed by the
webhook's secret. Verify it before trusting the payload:

```js
const crypto = require("crypto");
const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
// compare with the X-Webhook-Signature header using a constant-time comparison
```

**Delivery is a single synchronous attempt, not a retrying job queue.** A delivery row
(`outbound_webhook_deliveries`) is recorded either way — `status_code` is the endpoint's HTTP
status on success, or `null` if it was unreachable/timed out (5s timeout). A failing customer
webhook never throws back into the action that triggered it (creating a lead, an inbound
message arriving) — it's recorded and otherwise ignored. A retry worker for failed deliveries
is future work.

## What's NOT built

- No retry/backoff for outbound webhook deliveries (see above).
- No `campaign.completed` or other campaign-lifecycle outbound events yet — only
  `lead.created`, `contact.created`, `message.received`.
- No rate limiting on `/api/v1/...` or the n8n endpoint.
- No OpenAPI/Swagger spec file — this document is the reference.
