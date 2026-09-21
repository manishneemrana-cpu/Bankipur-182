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
| `MOCK_META` | (unused until Meta phase) | Must be `true` until real Meta credentials exist |
| `META_*` | (unused until Meta phase) | Placeholders only — do not fill in without first reading `docs/meta-current-state.md` (not yet written; Phase 3) |
| `RAZORPAY_*` | (unused until billing phase) | |
| `SENTRY_DSN` / `NEXT_PUBLIC_POSTHOG_KEY` | (not wired up yet) | |

No server-side secret is ever prefixed `NEXT_PUBLIC_`. If you see one that is, that's a bug —
it would be shipped to every visitor's browser.
