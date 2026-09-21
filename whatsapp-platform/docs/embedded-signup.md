# Embedded Signup (Phase 5)

## What's built

- **Onboarding state machine** (`src/server/onboarding.ts`): the `onboarding_sessions` table's
  state machine from Phase 1 is now enforced in code — a session can only move one legal step
  forward at a time (`STARTED → META_AUTHENTICATING → BUSINESS_SELECTED → WABA_SELECTED →
  PHONE_SELECTED → CONNECTING → VERIFYING → CONNECTED`), and an illegal jump (e.g. straight to
  `CONNECTED`) throws rather than silently succeeding. This is the concrete implementation of
  the project rule "never treat onboarding as successful just because the frontend callback
  fired" — the backend is the only thing that can advance a session's state.
- **Connect WhatsApp wizard** (`/dashboard/whatsapp/connect`): path selection (existing app
  number / new number / migrated a number from another provider) with a plain-language
  explanation of each, per the brief's requirement to explain coexistence before a client
  starts that flow.
- **Token encryption** (`src/server/crypto.ts`): AES-256-GCM, with a `keyVersion` field so a
  future key rotation has somewhere to record which key encrypted which token. This is real,
  tested code — not a placeholder — even though nothing calls it with a real Meta token yet.
- **Mock completion** (`completeMockOnboarding`): in `MOCK_META=true`, walks a session through
  every state to `CONNECTED` and writes real `whatsapp_accounts` / `whatsapp_phone_numbers` /
  `whatsapp_credentials` rows (with an encrypted placeholder token) for the organization. This
  is what makes the WhatsApp status page (`/dashboard/whatsapp`) show genuinely persisted data
  instead of Phase 2's render-time-only mock — an organization that "connects" now has a real
  database row, isolated by the same RLS as everything else.

## What's deliberately NOT built, and why

**Loading Meta's JS SDK and handling the real OAuth-style popup callback, and exchanging the
returned code for a Business Integration System User access token via a server-to-server call,
are not implemented.**

This isn't an oversight — it's a direct consequence of the verification gap recorded in
`docs/meta-current-state.md`: this build environment cannot reach `developers.facebook.com` at
all, so the exact current request shape for that code-exchange call (the endpoint path, required
parameters, and response shape for a Business Integration System User token specifically) could
not be confirmed against Meta's own docs. The project rule is explicit: "Never invent
endpoints, permissions, fields, limits or prices." Building that call from secondhand summaries
would mean guessing at exactly the kind of detail Meta changes without much notice — and this
is also the highest-stakes part of the whole platform to get wrong, since it's real OAuth-style
credential handling for real client businesses.

**Before this gets built:** someone (you, or a future session with working internet access)
needs to open these Meta pages directly and confirm the current shape:
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation
- https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users
  (for the coexistence-specific flow)

Also time-sensitive: `docs/meta-current-state.md` found a reported October 15, 2026 deadline for
an Embedded Signup migration affecting coexistence specifically. That's about three weeks from
today. If real Embedded Signup gets built after that date, it must be built against whatever
Meta's current flow is at that time, not the "v4" this document describes today.

## What independent verification means in practice, once built

Per the project rule, the backend must independently verify the WABA and phone number against
Meta before marking a session `CONNECTED` — not just trust that the frontend popup closed
successfully. Concretely, once the real code-exchange call is built: after exchanging the code
for a token, the `VERIFYING` state should make its own `GET` call to Meta (e.g. fetching the
WABA or phone number resource with the new token) and only transition to `CONNECTED` if that
call succeeds and returns the expected WABA/phone number. `completeMockOnboarding` skips this
by design (there's nothing real to verify against in mock mode) — that skip must not be copied
into the live path.
