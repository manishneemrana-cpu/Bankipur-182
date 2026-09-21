# API (Phase 8: n8n integration only — full public API is Phase 10)

## n8n integration webhook

`POST /api/integrations/n8n/webhook`

Authenticate with `Authorization: Bearer <api key>` (create a key on the dashboard's API page).
Each key has scopes; a request whose action needs a scope the key doesn't have gets a 403.

Body is JSON with an `action` field:

| Action | Required scope | Body fields |
|---|---|---|
| `contacts.upsert` | `contacts.write` | `phoneE164`, `name?`, `tags?` |
| `leads.create` | `leads.write` | `name`, `phone?`, `source?` |
| `messages.sendTemplate` | `whatsapp.messages.send` | `phoneE164`, `templateId` (must be an APPROVED template) |

Example:

```bash
curl -X POST https://your-domain/api/integrations/n8n/webhook \
  -H "Authorization: Bearer wap_..." \
  -H "Content-Type: application/json" \
  -d '{"action":"contacts.upsert","phoneE164":"+919876543210","name":"Jane","tags":["n8n-lead"]}'
```

API keys are stored as a SHA-256 hash (never the raw value) with a short prefix shown for
identification; the raw key is shown once, at creation, and never again.

## Public REST API (`/api/v1/...`)

Not built yet — that's Phase 10, per the build order. The n8n webhook above is a narrow,
single-endpoint integration, not the full documented public API described in the brief.
