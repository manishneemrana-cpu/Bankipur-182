# Meta / WhatsApp Business Platform — current state (Phase 3 research)

**Read this warning first.** This environment's network policy blocks direct access to
`developers.facebook.com` (and several other domains, e.g. `postman.com`) — every attempt to
fetch Meta's own documentation pages directly (via the WebFetch tool) returned
`EGRESS_BLOCKED`. Everything below comes from web-search result snippets (which quote and
summarize Meta's docs, and often cite the exact developers.facebook.com URL as their source)
rather than from reading the primary source myself. That is a real gap, not a formality:

**Before this platform goes live, someone with a normal internet connection (you, or a future
session with unblocked network access) must open the developers.facebook.com URLs cited below
and confirm each fact still holds.** Old blog posts about Meta's API are notoriously wrong
exactly because Meta changes this often — do not treat this document as more trustworthy than
that, it has the same secondhand-source problem, just gathered more recently (September 2026).

Where a fact affects money, security, or compliance (pricing, permissions, token handling), the
code in this repo does **not** hard-code it — it stays in an env var or admin-editable table,
specifically so a wrong or stale value here doesn't become a wrong value in production. See
`docs/decisions.md`.

## What was found

### Graph API version
Search results surfaced "v21.0" as a version number, but that figure could not be verified
against the primary source (blocked) and Graph API versions increment roughly every few
months — a number found via search is exactly the kind of stale-blog-post risk the project
rules warn about. **Do not trust v21.0 as current.** The codebase never hard-codes a version
number — `META_GRAPH_API_VERSION` is an env var (see `.env.example`), and whoever sets up the
production environment must look up the actual current stable version at
https://developers.facebook.com/docs/graph-api/changelog directly before deploying.

### Cloud API status
As of October 23, 2025, the Cloud API is reportedly the only WhatsApp Business API available —
the older On-Premises API was sunset on that date. This matches the project's plan (Cloud API
only, per `CLAUDE.md` rule 4.1) with no action needed.

### Embedded Signup version (v4)
- v4 documentation was reportedly released October 8, 2025, and consolidates WhatsApp,
  Instagram, and Messenger onboarding into one Facebook-Login-for-Business flow.
- A migration deadline of **October 15, 2026** was reportedly announced (May 14, 2026) for
  three feature types that don't auto-migrate: `only_waba_sharing`, `marketing_messages_lite`,
  and `coex` (coexistence) — these reportedly require manual developer action before that date.
- **This directly affects Phase 5 timing.** October 15, 2026 is about three weeks from today
  (September 21, 2026). If this platform's coexistence onboarding (a Phase 5 deliverable) isn't
  built and tested against v4's coexistence flow specifically before that date, it risks being
  built against an already-deprecated flow. Confirm this date and the exact v4 coexistence
  requirements before starting Phase 5, not after.
- Source cited: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4

### Coexistence specifics
- Reported minimum WhatsApp Business app version: **2.24.17**.
- India was reportedly removed from any unsupported-country list; Indian numbers are reportedly
  now fully supported for coexistence. (Important for this founder's own use case as "Magadh
  Property.")
- Reconnect flow: when a client re-registers their WhatsApp Business app, they reportedly see a
  pre-checked opt-in to reconnect previously-connected Cloud API products, completing
  automatically within a few minutes. The `account_update` webhook's `PARTNER_REMOVED` event
  reportedly now includes a `disconnection_info` object (`reason`, `initiated_by`) when both the
  WhatsApp Business app and Cloud API are in use.
- A dedicated "Reconnect offboarded coexistence clients" guide reportedly exists — read it in
  full before implementing the offboard/reconnect webhook handlers in Phase 5.

### Token model for a Tech Provider
Confirms the assumption already in this codebase's `whatsapp_credentials` table design:
- Two token types exist: system user access tokens (long-lived, represent the business itself)
  and **Business Integration System User access tokens** ("business tokens"), which are scoped
  per onboarded customer.
- **"If you are a Tech Provider, you will use business tokens exclusively"** — i.e. one token
  per client WABA obtained through Embedded Signup, not one shared system-user token across all
  clients. This confirms the per-organization `whatsapp_credentials` row design is correct and
  a single shared token would be the wrong architecture.
- Flow: Embedded Signup returns an exchangeable code as a JS SDK message event → exchange it for
  a business token via a server-to-server call. This matches the design already documented in
  `docs/decisions.md` ("Never trust a WABA ID or phone number ID supplied directly by the
  browser").

### App Review permissions
- `whatsapp_business_management` — access to a client's WABA settings and message templates.
- `whatsapp_business_messaging` — access to a client's phone number settings, and sending/
  receiving messages on their behalf.
- Both reportedly require App Review (Advanced Access) for a Solution Provider / Tech Provider,
  unlike an internal/direct developer app. Demo requirements reportedly include sending an
  actual WhatsApp message from the app (for `whatsapp_business_messaging`) and creating a real
  template (for `whatsapp_business_management`) as part of the reviewer recording — relevant for
  `docs/app-review.md` in a later phase.

### Webhooks
- Payload shape: top-level `object: "whatsapp_business_account"`, an `entry` array (WABA ID),
  each with a `changes` array whose `value` carries `messaging_product`, `metadata`
  (`display_phone_number`, `phone_number_id`), and the specific event fields.
- Status webhooks carry message id, status, timestamp, recipient id, and an `errors` array with
  codes/titles when applicable.
- Reported payload size limit: up to 3 MB.
- None of this changes the webhook handler design already planned in the master brief
  (verify `X-Hub-Signature-256`, respond fast, dedupe by hash, process async) — it confirms the
  shape assumed there.

### Messaging limits, quality rating, pricing (the Compliance Guardian's actual data)
Several reported 2026 changes matter for the Compliance Guardian module (Phase 7), not just for
copy on a pricing page:
- **Messaging limits became portfolio-wide, not per-phone-number, as of October 7, 2025** — a
  business's limit is reportedly evaluated across its whole WABA/portfolio rather than one
  number in isolation. This changes what "the remaining daily limit" means for the pre-flight
  campaign check — it's a portfolio quantity, not a per-number one. **Verify this before
  building that check in Phase 7; if the schema's `messaging_limit_tier` column being on
  `whatsapp_phone_numbers` rather than `whatsapp_accounts` turns out to be the wrong grain,
  that's a migration to make then, not now.**
- Meta reportedly reviews limit-advancement eligibility every 6 hours now (versus a slower
  historical cadence), so a business can reportedly scale up multiple times a week if quality +
  usage criteria are met.
- The "Flagged" status and automatic messaging-limit downgrade on a quality-rating drop were
  reportedly removed in 2026 — a red quality rating reportedly blocks *advancing* to the next
  tier but no longer *automatically demotes* an existing tier (absent policy violations). This
  changes the "auto-pause and alert" logic specified in the brief's Compliance Guardian section:
  the trigger condition for concern is different from what an older tutorial would describe.
- **Pricing**: category-based per-message billing (Marketing / Utility / Authentication), with
  Service (replies inside the 24-hour customer-service window) free. Reported example rates
  (US ~$0.025 marketing, ~$0.004 utility; India reportedly as low as ~$0.010–0.0014 for some
  categories) are **illustrative only, not to be encoded anywhere** — the `pricing_config` table
  already in `migrations/0001_init.sql` exists exactly so real rates are admin-entered and
  dated, never hard-coded. Utility/Authentication reportedly get monthly volume-tier discounts
  per market; Marketing reportedly does not, at any volume.
- Billing shifted from conversation-based to per-template-message billing around July 2025,
  per multiple sources — consistent with the per-message `pricing_category` column already on
  the `messages` table.

## What this means for Phase 3 scope

Given the verification gap above, Phase 3 (per the build order: "Meta configuration layer +
Cloud API client + a working test connection") is built so that:
- No Graph API version, endpoint path, or price is hard-coded anywhere in application code —
  all of it is env-driven or admin-editable, per the table above and `docs/decisions.md`.
- The Cloud API client and "test connection" feature run in `MOCK_META=true` mode only for now.
  A real, live call to Meta only happens once `MOCK_META=false` *and* real `META_APP_ID` /
  `META_APP_SECRET` / `META_GRAPH_API_VERSION` values are present — and even then, this phase
  does not yet implement Embedded Signup (that's Phase 5), so there is no way for a live call to
  happen accidentally from today's UI.
- Before Phase 5 (Embedded Signup + Coexistence) starts, the version-4 migration deadline
  (reportedly October 15, 2026) and the coexistence-specific requirements above must be
  re-verified against the primary docs, given how close that date is.
