#!/usr/bin/env bash
set -euo pipefail

echo "[demo] Running DB migrations..."
node ./node_modules/typeorm/cli.js -d dist/src/config/database/data-source.js migration:run

echo "[demo] Seeding demo data..."
node dist/src/database/seeders/seed-dev-data.js

echo "[demo] Starting backend (NestJS)..."
node dist/src/main.js &
BACKEND_PID="$!"

echo "[demo] Starting frontend static server..."
node scripts/serve-frontend.mjs &
FRONTEND_PID="$!"

cleanup() {
  echo "[demo] Shutting down..."
  kill -TERM "$BACKEND_PID" 2>/dev/null || true
  kill -TERM "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
  wait "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup INT TERM

# If either process exits, stop the container.
wait -n "$BACKEND_PID" "$FRONTEND_PID"
cleanup

