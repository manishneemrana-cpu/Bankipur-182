#!/usr/bin/env bash
# Installs Digital Twin (API + admin + viewer) on the VPS that already runs ReelEngine behind Traefik.
#   curl -fsSL https://raw.githubusercontent.com/manishneemrana-cpu/Bankipur-182/claude/nice-noether-kx8pqa/digital-twin/deploy/setup.sh | sudo bash
# Reuses the Traefik network / cert resolver that the ReelEngine setup already detected. Touches nothing else.
set -euo pipefail
REPO="https://github.com/manishneemrana-cpu/Bankipur-182.git"
BRANCH="${BRANCH:-claude/nice-noether-kx8pqa}"
DIR="${DIR:-/opt/digital-twin-src}"
VE_ENV="${VE_ENV:-/opt/video-engine-src/video-engine/deploy/.env}"
say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)."; exit 1; }
command -v docker >/dev/null || { echo "Docker missing - run the ReelEngine setup first."; exit 1; }
apt-get install -y git openssl >/dev/null 2>&1 || true

say "Fetching code ($BRANCH)"
if [ -d "$DIR/.git" ]; then git -C "$DIR" fetch -q origin "$BRANCH" && git -C "$DIR" checkout -q -B "$BRANCH" "origin/$BRANCH"
else git clone -q --depth 1 -b "$BRANCH" "$REPO" "$DIR"; fi
cd "$DIR/digital-twin/deploy"

if [ ! -f .env ]; then
  say "Creating configuration"
  [ -f "$VE_ENV" ] || { echo "Cannot find $VE_ENV (ReelEngine setup). Aborting."; exit 1; }
  ve() { grep "^$1=" "$VE_ENV" | head -1 | cut -d= -f2- | sed "s/^'//; s/'$//"; }
  IPDASH="$(ve API_DOMAIN | sed 's/\.sslip\.io$//')"            # e.g. 200-141-8-86
  [ -n "$IPDASH" ] || { echo "Could not read API_DOMAIN from $VE_ENV"; exit 1; }
  umask 077
  TOKEN="$(openssl rand -hex 24)"
  cat > .env <<ENV
API_DOMAIN=twin-api-$IPDASH.sslip.io
ADMIN_DOMAIN=twin-admin-$IPDASH.sslip.io
VIEWER_DOMAIN=twin-$IPDASH.sslip.io
ADMIN_API_TOKEN=$TOKEN
TRAEFIK_NETWORK='$(ve TRAEFIK_NETWORK)'
TRAEFIK_RESOLVER='$(ve TRAEFIK_RESOLVER)'
TRAEFIK_ENTRYPOINT='$(ve TRAEFIK_ENTRYPOINT)'
ENV
  printf 'Admin: https://twin-admin-%s.sslip.io\nViewer: https://twin-%s.sslip.io\nAdmin token (paste it on the admin login): %s\n' "$IPDASH" "$IPDASH" "$TOKEN" > /root/digital-twin-credentials.txt
fi

say "Building and starting (first run takes 5-10 minutes)"
docker compose -f docker-compose.traefik.yml --env-file .env up -d --build

API="$(grep '^API_DOMAIN=' .env | cut -d= -f2)"
say "Waiting for the API"
for i in $(seq 1 60); do curl -fsS -m 5 "https://$API/healthz" >/dev/null 2>&1 && OK=1 && break; sleep 5; done
echo
if [ "${OK:-0}" = 1 ]; then echo "READY"; else echo "Started, but HTTPS is not answering yet (certificate can take a minute). Logs: docker compose -f $DIR/digital-twin/deploy/docker-compose.traefik.yml logs --tail=100"; fi
echo "------------------------------------------------------------"
cat /root/digital-twin-credentials.txt
echo "------------------------------------------------------------"
