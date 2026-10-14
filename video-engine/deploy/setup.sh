#!/usr/bin/env bash
# One-command installer for a fresh Ubuntu 22.04/24.04 VPS (run as root).
#   curl -fsSL https://raw.githubusercontent.com/manishneemrana-cpu/Bankipur-182/claude/sharp-cori-socm3c/video-engine/deploy/setup.sh | sudo bash
# Optional env: DOMAIN=studio.example.com (must already point at this server)  BRANCH=...  APP_PASSWORD=...
set -euo pipefail

REPO="https://github.com/manishneemrana-cpu/Bankipur-182.git"
BRANCH="${BRANCH:-claude/sharp-cori-socm3c}"
DIR="${DIR:-/opt/video-engine-src}"
say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)."; exit 1; }

say "Installing prerequisites"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null
apt-get install -y ca-certificates curl git ufw openssl >/dev/null
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi
docker compose version >/dev/null

say "Firewall (only SSH, 80, 443 open)"
ufw allow OpenSSH >/dev/null && ufw allow 80 >/dev/null && ufw allow 443 >/dev/null && ufw --force enable >/dev/null

# Renders spike memory; add swap on small servers.
if [ "$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)" -lt 7000 ] && [ ! -f /swapfile ]; then
  say "Adding 4 GB swap (server has < 8 GB RAM)"
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

say "Fetching code ($BRANCH)"
if [ -d "$DIR/.git" ]; then git -C "$DIR" fetch -q origin "$BRANCH" && git -C "$DIR" checkout -q -B "$BRANCH" "origin/$BRANCH"
else git clone -q --depth 1 -b "$BRANCH" "$REPO" "$DIR"; fi
cd "$DIR/video-engine/deploy"

if [ ! -f .env ]; then
  say "Creating configuration"
  IP="$(curl -fsS4 https://ifconfig.me || curl -fsS4 https://api.ipify.org)"
  HOST="${DOMAIN:-$(echo "$IP" | tr . -).sslip.io}"       # sslip.io gives a free HTTPS-capable hostname for any IP
  PASS="${APP_PASSWORD:-$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)}"
  HASH="$(docker run --rm caddy:2-alpine caddy hash-password --plaintext "$PASS")"
  cp env.production.example .env
  sed -i "s|^API_DOMAIN=.*|API_DOMAIN=$HOST|; s|^BASIC_HASH=.*|BASIC_HASH='$HASH'|" .env
  chmod 600 .env
  umask 077
  printf 'URL: https://%s\nUser: admin\nPassword: %s\n' "$HOST" "$PASS" > /root/video-engine-credentials.txt
fi

say "Building and starting (first run takes 10-20 minutes)"
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

HOST="$(grep '^API_DOMAIN=' .env | cut -d= -f2)"
say "Waiting for the server to come up"
for i in $(seq 1 60); do
  if curl -fsS -m 5 "https://$HOST/health" -u "admin:$(grep '^Password:' /root/video-engine-credentials.txt | cut -d' ' -f2)" >/dev/null 2>&1; then OK=1; break; fi
  sleep 5
done

echo
if [ "${OK:-0}" = 1 ]; then echo "READY"; else echo "Started, but HTTPS is not answering yet (DNS / certificate can take a minute). Check: docker compose -f $DIR/video-engine/deploy/docker-compose.prod.yml logs --tail=100"; fi
echo "------------------------------------------------------------"
cat /root/video-engine-credentials.txt
echo "------------------------------------------------------------"
echo "Saved in /root/video-engine-credentials.txt. Add API keys later with:  $DIR/video-engine/deploy/set-key.sh ELEVENLABS_API_KEY"
