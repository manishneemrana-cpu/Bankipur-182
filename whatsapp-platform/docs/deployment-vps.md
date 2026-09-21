# Deploying to a Hostinger VPS (Phase 1 scope: get the app + database running)

This covers getting this Phase-1 scaffold live on your VPS at `www.manishpandey.in`. It does
not yet cover Meta/WhatsApp setup (that's Phase 3+) or Razorpay billing (later phase).

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
- Leave `MOCK_META=true` — do not touch any `META_*` variable yet.

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

## Not yet covered here

- Backups (`pg_dump` on a cron job, or a managed backup snapshot from Hostinger).
- Zero-downtime deploys (current setup is a simple `docker compose up -d --build`, which has
  a brief restart gap).
- The Meta webhook URL, Embedded Signup redirect URLs, and everything else Meta-specific —
  see `docs/meta-setup.md` (not written yet — Phase 3).
