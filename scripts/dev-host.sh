#!/usr/bin/env bash
# Run the API against a Postgres that is already listening on the host.
#
# The supported path is `npm run dev` (docker compose). This exists for the case
# where the Docker daemon is not reachable but Postgres is — it wires the same
# environment the compose file would, pointing at localhost instead of `db`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="${CART_VENV:?set CART_VENV to a python env with apps/api/requirements.txt installed}"

export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://cart:cart@localhost:5432/cartpaper}"
export UPLOAD_DIR="${UPLOAD_DIR:-$ROOT/data/uploads}"
export SECRET_KEY="${SECRET_KEY:-dev-only-secret-change-me}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173}"
export PUBLIC_API_URL="${PUBLIC_API_URL:-http://localhost:8000}"
export PUBLIC_WEB_URL="${PUBLIC_WEB_URL:-http://localhost:5173}"
export PYTHONPATH="$ROOT/apps/api"

mkdir -p "$UPLOAD_DIR"
cd "$ROOT/apps/api"

"$VENV/bin/alembic" upgrade head
exec "$VENV/bin/uvicorn" app.main:app --host 0.0.0.0 --port "${API_PORT:-8000}" "$@"
