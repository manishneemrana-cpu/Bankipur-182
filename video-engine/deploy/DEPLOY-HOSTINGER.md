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

## Adding your API keys (real voice + real map)
Keys live on the server, not in the web UI. On the VPS terminal (each command asks for the key, hidden):
```bash
cd /opt/video-engine-src/video-engine/deploy
./set-key.sh ELEVENLABS_API_KEY
./set-key.sh MAPBOX_ACCESS_TOKEN        # must be a PUBLIC token starting with pk.  (never an sk. secret token)
./set-key.sh ELEVENLABS_VOICE_ID abc123 # the voice you want (non-secret, pass it directly)
./set-key.sh TTS_PROVIDER elevenlabs
./set-key.sh MAP_PROVIDER mapbox
./set-key.sh PAID_APIS_ENABLED true     # master switch; false = every paid provider returns mock output
```
Then open the project and press **Regenerate**.

**What is live today:** ElevenLabs voice-over (`eleven_multilingual_v2`) and the **Mapbox** map flyby.
**Still mock:** image-to-video (Luma/Runway/Kling) and Google/Azure TTS, Google/Cesium maps. The cinematic shot keeps using the free
Ken Burns pan/zoom of your uploaded building photo.

Notes on Mapbox:
- The token must have no URL restriction that blocks `http://127.0.0.1` (the server renders the flyby in a local headless browser).
- One rendered video = one Mapbox map load plus tile requests; the map flyby renders frame by frame in a software-GL browser, so it is the
  slowest stage (expect several minutes). The Mapbox logo/attribution stays visible in the video, as Mapbox's terms require.
- If the map stage fails, the project page shows the reason (e.g. invalid token) and only that stage fails.

## Operations
- Logs: `cd /opt/video-engine-src/video-engine/deploy && docker compose -f docker-compose.prod.yml logs --tail=200 api worker`
- Update: re-run the same one-line command (keeps your `.env`, password and data).
- A reel takes several minutes to render; it runs in the background and the UI shows progress.

## Security notes
- The whole site (UI + API + files) is behind the HTTP basic-auth password. Redis and the API are not exposed to the internet; only ports 22, 80, 443 are open.
- There is a single shared account (no per-user login). For multi-user logins, configure Supabase (see `../.env.example`).
