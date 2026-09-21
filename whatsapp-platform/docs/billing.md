# Billing (Phase 9)

## What's built

- **Plans**: `plans` table, admin CRUD at `/admin/plans` (`src/server/billing.ts`,
  `src/server/actions/admin-plan-actions.ts`). Starter/Business/AI Business/Enterprise are
  seeded (migration `0006_seed_default_plans.sql`) as starting placeholders — an admin edits
  real prices there, and nothing in application code hard-codes a price.
- **Subscriptions**: every new organization gets a Starter subscription at signup
  (`registerOrganization` in `src/server/actions/auth-actions.ts`). See "Subscriptions and
  the pre-tenant RLS pattern" below.
- **Invoices**: `generateInvoiceForOrganization(organizationId, periodStart, periodEnd)`
  (`src/server/billing.ts`) creates one invoice with:
  - a `SUBSCRIPTION` line item priced from the org's current active subscription's plan
  - one line item per `usage_records` kind recorded in that period, priced from
    `pricing_config` — a usage kind with no matching `pricing_config` row is **skipped**,
    never guessed at with a made-up price
  - Dashboard UI at `/dashboard/billing` lets an OWNER/ADMIN (anyone with the
    `manage_billing` permission) generate an invoice for a date range and view past invoices.
- **Payment provider abstraction**: `src/server/payments/provider.ts` defines
  `PaymentProvider` (`createOrder`, `verifyPaymentSignature`) independent of Razorpay's SDK.
  `MockPaymentProvider` (used when `MOCK_PAYMENTS=true`, the default) simulates a
  successful order deterministically. `NotConfiguredPaymentProvider` (used when
  `MOCK_PAYMENTS=false` and no real implementation has been wired in yet) throws rather than
  fabricating a payment result — nothing here has ever called Razorpay's actual API.

## What's NOT built

- No real Razorpay implementation of `PaymentProvider` — only the interface and a mock.
  Wiring up the real SDK, webhook handling for payment confirmation, and updating
  `subscriptions`/`invoices` status from a Razorpay webhook are future work, gated the same
  way Meta's real client is: verify Razorpay's current API against their docs first, don't
  invent endpoint shapes.
- No automatic recurring invoice generation (cron/job queue) — `generateInvoiceForOrganization`
  is only called on demand from the dashboard today.
- Nothing writes to `usage_records` yet (no AI/Calling usage producer exists — see
  `src/server/ai/provider.ts` / `src/server/calling/provider.ts`), so in practice every
  invoice today only has a `SUBSCRIPTION` line item until a usage-tracking phase exists.

## Subscriptions and the pre-tenant RLS pattern

`registerOrganization` creates a new organization's first `subscriptions` row in the same
`withPlatformAdminTransaction` as the org/user/membership inserts — before any
`organization_id` exists to scope `app.org_id` to. `subscriptions` originally had only the
generic `tenant_isolation` policy, so this insert hit the same "pre-tenant" RLS gap as five
earlier tables (see `decisions.md`). Fixed by migration `0007_subscriptions_signup_insert.sql`,
adding the same admin-bypass pattern used for `organizations`, `organization_members`,
`whatsapp_phone_numbers`, and `api_keys`. Regression test:
`tests/registration-subscription-rls.test.ts`.

## `plans` and `pricing_config` have no RLS

Both are global platform tables, not tenant-scoped — every organization reads the same plan
list and pricing config. They're gated by the application's own `requirePlatformAdminUserId()`
check (for writes) rather than a database policy. See `decisions.md`.
