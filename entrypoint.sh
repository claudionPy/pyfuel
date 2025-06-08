#!/usr/bin/env bash
set -euo pipefail

[ -f .env ] && export $(grep -v '^#' .env | xargs) || true

echo "Running Alembic migrations..."
alembic upgrade head
echo "Migrations complete."

echo "Launching Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

