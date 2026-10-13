# Deploy the backend on a Hostinger VPS

**What runs where:** web UI → Vercel (already deployed). API + render worker + Redis + HTTPS proxy → this VPS (Docker).

## 0. Prerequisites
- Hostinger VPS (KVM 2 or larger recommended: ≥ 2 vCPU, ≥ 8 GB RAM — video renders use Chromium + ffmpeg), Ubuntu 22.04/24.04 or Hostinger's "Docker" template.
- A hostname pointing at the VPS: an `A` record (e.g. `api.yourdomain.com` → VPS IP), or use `<ip-with-dashes>.sslip.io`.
- A Supabase project with `video-engine/supabase` schema applied and a storage bucket (public API needs real auth — see `.env`).

## 1. Prepare the server (once)
```bash
ssh root@YOUR_VPS_IP
apt-get update && apt-get install -y ca-certificates curl git ufw
curl -fsSL https://get.docker.com | sh          # skip if the Docker template is installed
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable   # Redis/API ports are NOT exposed
```
Also create a swap file if the VPS has < 8 GB RAM (renders can spike).

## 2. Get the code and configure
```bash
git clone -b claude/sharp-cori-socm3c https://github.com/manishneemrana-cpu/Bankipur-182.git
cd Bankipur-182/video-engine/deploy
cp .env.production.example .env && chmod 600 .env && nano .env
```

## 3. Start
```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml logs -f api worker     # Ctrl-C to leave
curl https://$API_DOMAIN/health        # expect {"ok":true,"storage":"supabase",...}
```
First start is slow (builds the image, downloads Remotion's browser).

## 4. Point the web UI at it (Vercel → ugc-video-engine → Settings → Environment Variables)
```
NEXT_PUBLIC_API_URL=https://<API_DOMAIN>/api
NEXT_PUBLIC_SUPABASE_URL=...        # same project as the API
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # anon key only; never the service key
```
Redeploy the web app afterwards (NEXT_PUBLIC_* values are baked in at build time).

## Operations
- Update: `git pull && docker compose -f docker-compose.prod.yml --env-file .env up -d --build`
- Logs: `docker compose -f docker-compose.prod.yml logs --tail=200 api worker`
- Back up the `local-data` volume if you run without Supabase storage.
