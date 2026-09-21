# Compliance Guardian (Phase 7)

Plain-language version of what this platform does automatically before a campaign sends, and
what's not built yet.

## What's built

- **Pre-flight check** (`src/server/compliance.ts`, shown on every campaign's page before
  launch): checks whether the chosen template is actually Meta-approved, counts how many
  recipients are suppressed/opted out, and — for Marketing-category templates only — how many
  don't have a recorded opt-in. It hard-blocks launch only when the template isn't approved or
  there's no one eligible to send to; suppressed/non-opted-in contacts are reported and
  automatically skipped, not treated as a reason to refuse the whole campaign.
- **Consent registry**: every contact has `opt_in_status`, `opt_in_at`, and `opt_in_source` —
  adding a contact manually today always records an explicit opt-in with a timestamp and source.
- **Suppression**: a suppressed contact is skipped by every send path (direct reply, campaign)
  — enforced in the messaging service itself, not just the UI.
- **Per-recipient tracking**: a campaign records queued/sent/failed/skipped for every recipient
  individually, with a reason, so a partial send is never a mystery.

## What's NOT built yet

- **STOP/UNSUBSCRIBE keyword handling** — recognizing an inbound "STOP" and automatically
  suppressing that contact. Right now suppression is manual only (a toggle on the Contacts
  page). This is a real gap for a live marketing campaign and should be built before this
  platform sends real marketing messages to real people.
- **Live quality & messaging-limit monitor** — the schema has `quality_rating` and
  `messaging_limit_tier` columns, and Phase 5's mock connection fills them with fake values, but
  nothing currently reads them from a live Meta connection (there isn't one yet) or uses them to
  auto-pause a campaign or block launching one larger than the remaining daily limit. Per
  `docs/meta-current-state.md`, messaging limits reportedly became portfolio-wide (not
  per-number) as of October 2025 — build this against that model, not a per-number one, once a
  real connection exists to read it from.
- **CSV import with a consent declaration**, and audience filters beyond a single tag.
- **Business Verification helper** and the plain-language "how to grow your tier" onboarding
  explainer described in the brief.
- **Smart pacing / staggered sending** and the `error 131049` (marketing-frequency cap) handling
  described in the brief — today's campaign send loop sends to every eligible recipient
  back-to-back with no rate limiting, which is fine at mock-mode/demo scale but would need this
  before sending real volume.

None of the above is invented or guessed at — see `docs/meta-current-state.md` for what's
actually confirmed about messaging limits and quality ratings versus what still needs
verification against Meta's current docs.
