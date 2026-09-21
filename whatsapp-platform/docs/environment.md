# Environment variables

Copy `.env.example` to `.env` and fill in real values. **Never commit `.env`.**

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | app | Public URL, e.g. `https://www.manishpandey.in` |
| `PLATFORM_BRAND_NAME` | app | Default tenant brand name shown when a tenant hasn't set its own |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `db` container | Bootstrap superuser for the Postgres container |
| `MIGRATE_DATABASE_URL` | `npm run migrate` only | Superuser connection. Never used by the running app. |
| `APP_DB_USER` / `APP_DB_PASSWORD` | `npm run migrate` | Credentials for the unprivileged runtime role it creates |
| `DATABASE_URL` | app, tests | The unprivileged role above. This is what actually enforces tenant isolation. |
| `REDIS_URL` | (unused in Phase 1) | Provisioned for the future job queue |
| `SESSION_SECRET` | app | 32+ random bytes, base64. Generate: `openssl rand -base64 32` |
| `ENCRYPTION_KEY` / `ENCRYPTION_KEY_VERSION` | (unused until Meta phase) | Will encrypt `whatsapp_credentials.encrypted_token` (AES-256-GCM) |
| `MOCK_META` | app | Must stay `true` until Phase 5 (Embedded Signup) exists and real Meta credentials are ready |
| `META_APP_ID` / `META_APP_SECRET` / `META_WEBHOOK_VERIFY_TOKEN` / `META_WEBHOOK_APP_SECRET` / `META_GRAPH_API_VERSION` | Meta client, required when `MOCK_META=false` | Read `docs/meta-current-state.md` first — do not fill in `META_GRAPH_API_VERSION` from a blog post; look up the current version yourself |
| `META_BUSINESS_ID` / `META_EMBEDDED_SIGNUP_CONFIG_ID` | Phase 5 (Embedded Signup) | Not used by anything yet |
| `RAZORPAY_*` | (unused until billing phase) | |
| `SENTRY_DSN` / `NEXT_PUBLIC_POSTHOG_KEY` | (not wired up yet) | |

No server-side secret is ever prefixed `NEXT_PUBLIC_`. If you see one that is, that's a bug —
it would be shipped to every visitor's browser.
