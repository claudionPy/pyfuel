#!/usr/bin/env bash
set -euo pipefail

# 1) (Optional) If you bundle a .env into the image for local dev, load it:
[ -f .env ] && export $(grep -v '^#' .env | xargs) || true

# 2) Run Alembic migrations so the database schema is up to date:
echo "Running Alembic migrations..."
alembic upgrade head
echo "Migrations complete."

# 3) Start the Uvicorn server. Use 'exec' so it gets PID 1 and handles signals correctly.
echo "Launching Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

