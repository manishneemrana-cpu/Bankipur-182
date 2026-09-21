# Deploying to a Hostinger VPS

This covers getting the app + self-hosted database running on your VPS at
`www.manishpandey.in`. It does not cover configuring a real Meta/WhatsApp connection (see
`docs/meta-current-state.md` and `docs/embedded-signup.md` — verify Meta's current docs before
touching any `META_*` variable) or a real Razorpay account (see `docs/billing.md` — only the
mock payment provider exists today; leave `MOCK_PAYMENTS=true`).

## 1. On the VPS: install Docker

SSH into your Hostinger VPS, then:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in for the group change to apply
```

## 2. Get the code onto the VPS

```bash
git clone <your repo URL>
cd Bankipur-182/whatsapp-platform
```

## 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
- Set `NEXT_PUBLIC_APP_URL=https://www.manishpandey.in`.
- Generate strong passwords for `POSTGRES_PASSWORD` and `APP_DB_PASSWORD` (these must be
  **different** values — see `docs/decisions.md` on why the app must not use the superuser).
- Generate `SESSION_SECRET`: `openssl rand -base64 32`.
- Generate `ENCRYPTION_KEY` (used for `whatsapp_credentials.encrypted_token` — see
  `src/server/crypto.ts`).
- Leave `MOCK_META=true` and `MOCK_PAYMENTS=true` — do not touch any `META_*` or `RAZORPAY_*`
  variable until you actually have real credentials for them.

## 4. Start the database, run migrations, start the app

```bash
docker compose up -d db redis
# wait a few seconds for Postgres to become healthy, then:
docker compose run --rm app npm run migrate
docker compose up -d --build app
```

`npm run migrate` both applies the schema and creates the unprivileged `APP_DB_USER` role
that the app actually connects as — this step is not optional.

## 5. Put the app behind your domain with HTTPS

The `app` container listens only on `127.0.0.1:3000` (see `docker-compose.yml`) — it is not
reachable from the internet directly, on purpose. Put a reverse proxy in front of it that
terminates TLS for `www.manishpandey.in`. The simplest option on a fresh VPS is Caddy, which
gets you free automatic HTTPS with no manual certificate steps:

```bash
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
www.manishpandey.in {
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo systemctl reload caddy
```

Point `www.manishpandey.in`'s DNS A record at your VPS's IP address before this step, or
Caddy's automatic HTTPS certificate request will fail.

## 6. Verify

```bash
curl https://www.manishpandey.in/api/health
```

Should return `{"status":"ok","database":"ok","mockMeta":true,...}`.

## Moving to a different domain/VPS later

Nothing here is hard-coded to `manishpandey.in` beyond the `NEXT_PUBLIC_APP_URL` env var and
the Caddyfile — switching domains or hosts later is: point DNS, update those two, redeploy.

## Applying new migrations after a deploy

Every deploy that includes new files under `migrations/` needs the same command re-run —
`npm run migrate` is idempotent (it skips already-applied migrations, see the "skip"/"apply"
output), so it's safe to run on every deploy, not just the first one:

```bash
docker compose run --rm app npm run migrate
docker compose up -d --build app
```

## Verifying after a deploy

`GET /api/health` (see `docs/security-and-data-lifecycle.md` for what it and the admin
System Health page check) reports database connectivity and mock-mode flags. It is not a full
diagnostic — check the admin dashboard's System Health page for organization/user counts and
recent webhook activity too.

## Not yet covered here

- Backups (`pg_dump` on a cron job, or a managed backup snapshot from Hostinger).
- Zero-downtime deploys (current setup is a simple `docker compose up -d --build`, which has
  a brief restart gap).
- The Meta webhook URL, Embedded Signup redirect URLs, and everything else Meta-specific —
  see `docs/meta-current-state.md` and `docs/embedded-signup.md` for what's built and what
  still needs verifying against Meta's current docs before going live.
