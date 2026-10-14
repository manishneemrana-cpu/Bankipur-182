#!/usr/bin/env bash
# Add/replace a key in .env without showing it on screen, then restart the backend.
#   ./set-key.sh ELEVENLABS_API_KEY          (asks for the value, hidden)
#   ./set-key.sh PAID_APIS_ENABLED true      (non-secret values can be passed directly)
# After adding a paid key, also set the provider and switch, e.g.:
#   ./set-key.sh TTS_PROVIDER elevenlabs && ./set-key.sh PAID_APIS_ENABLED true
set -euo pipefail
cd "$(dirname "$0")"
KEY="${1:?usage: set-key.sh KEY [VALUE]}"
case "$KEY" in *[!A-Z0-9_]*|"") echo "Invalid key name"; exit 1;; esac
if [ $# -ge 2 ]; then VAL="$2"; else read -rsp "Value for $KEY (hidden): " VAL; echo; fi
[ -n "$VAL" ] || { echo "Empty value"; exit 1; }
case "$VAL" in *\'*|*$'\n'*) echo "Value must not contain quotes or newlines"; exit 1;; esac
if grep -q "^$KEY=" .env; then
  python3 - "$KEY" "$VAL" <<'PY'
import sys,re
k,v=sys.argv[1],sys.argv[2]
s=open('.env').read()
s=re.sub(r'^'+re.escape(k)+r'=.*$', lambda m: f"{k}='{v}'", s, flags=re.M)
open('.env','w').write(s)
PY
else printf "%s='%s'\n" "$KEY" "$VAL" >> .env; fi
chmod 600 .env
docker compose -f docker-compose.prod.yml --env-file .env up -d api worker
echo "$KEY updated; api + worker restarted."
