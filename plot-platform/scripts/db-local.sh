#!/usr/bin/env bash
# Throwaway local Postgres for DB tests (no Docker needed).
#   scripts/db-local.sh start   -> prints a DATABASE URL, applies shim + migrations + seed
#   scripts/db-local.sh stop
# In CI a Postgres service container is used instead (TEST_DATABASE_URL).
set -euo pipefail
cd "$(dirname "$0")/.."
DIR="${PGTEST_DIR:-/tmp/plot-platform-pg}"
PORT="${PGTEST_PORT:-54329}"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
AS=""
if [ "$(id -u)" = "0" ]; then AS="runuser -u postgres --"; fi

case "${1:-start}" in
  start)
    if [ -f "$DIR/postmaster.pid" ]; then $AS "$BIN/pg_ctl" -D "$DIR" stop -m immediate >/dev/null || true; fi
    rm -rf "$DIR"; mkdir -p "$DIR"; [ -n "$AS" ] && chown postgres "$DIR"
    $AS "$BIN/initdb" -D "$DIR" -U postgres --auth=trust >/dev/null
    $AS "$BIN/pg_ctl" -D "$DIR" -o "-p $PORT -k /tmp" -l "$DIR/log" start -w >/dev/null
    URL="postgresql://postgres@localhost:$PORT/postgres"
    node scripts/db-apply.mjs "$URL"
    echo "$URL"
    ;;
  stop)
    $AS "$BIN/pg_ctl" -D "$DIR" stop -m fast >/dev/null || true
    ;;
esac
