# Deploy ReelEngine (website + backend + video renderer) on one Hostinger VPS

Result: **one HTTPS link + one password**. Open it, create a reel, get real 9:16 and 16:9 MP4 files.

## What you need
- A Hostinger **VPS, KVM 2 or bigger** (2 vCPU, 8 GB RAM), OS **Ubuntu 24.04** (or the "Ubuntu with Docker" template).
- Nothing else. No Supabase, no domain (a free `<ip>.sslip.io` HTTPS address is created for you).

## Steps
1. Buy the VPS in Hostinger and open **hPanel → VPS → Browser terminal** (or `ssh root@YOUR_VPS_IP`).
2. Paste this single command and press Enter:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/manishneemrana-cpu/Bankipur-182/claude/sharp-cori-socm3c/video-engine/deploy/setup.sh | sudo bash
   ```
   The first run takes 10–20 minutes (it builds everything). It ends by printing your **link, user and password**
   (also saved in `/root/video-engine-credentials.txt`).
3. Open the link, log in with the printed user/password, create a project.

## Adding your API keys
Keys live on the server, not in the web UI. On the VPS terminal:
```bash
cd /opt/video-engine-src/video-engine/deploy
./set-key.sh ELEVENLABS_API_KEY        # asks for the key, hidden
./set-key.sh TTS_PROVIDER elevenlabs
./set-key.sh PAID_APIS_ENABLED true    # the master switch; false = every paid provider returns mock output
```
**Current limits of the code:** only **ElevenLabs** voice-over is implemented live. The map (Mapbox/Google/Cesium) and
image-to-video (Luma/Runway/Kling) providers are still `TODO` stubs and return mock output even with keys set.
Until then those stages produce placeholder/mock footage, but the full pipeline still renders a real reel.

## Operations
- Logs: `cd /opt/video-engine-src/video-engine/deploy && docker compose -f docker-compose.prod.yml logs --tail=200 api worker`
- Update: re-run the same one-line command (keeps your `.env`, password and data).
- A reel takes several minutes to render; it runs in the background and the UI shows progress.

## Security notes
- The whole site (UI + API + files) is behind the HTTP basic-auth password. Redis and the API are not exposed to the internet; only ports 22, 80, 443 are open.
- There is a single shared account (no per-user login). For multi-user logins, configure Supabase (see `../.env.example`).
