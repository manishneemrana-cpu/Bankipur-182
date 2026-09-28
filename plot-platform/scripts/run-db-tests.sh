#!/usr/bin/env bash
# Starts a throwaway local Postgres, applies the schema, runs the DB test
# suite against it, then tears it down. In CI, set TEST_DATABASE_URL to a
# Postgres service container instead and run `vitest run -c vitest.db.config.mts`
# directly (see .github/workflows/plot-platform-ci.yml).
set -euo pipefail
cd "$(dirname "$0")/.."
export TEST_DATABASE_URL="$(scripts/db-local.sh start | tail -1)"
trap 'scripts/db-local.sh stop' EXIT
npx vitest run -c vitest.db.config.mts
