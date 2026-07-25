#!/usr/bin/env bash
# Container entrypoint: wait for Postgres, apply migrations, then serve.
set -euo pipefail

cd /app

echo "[cart-paper] waiting for database..."
python - <<'PY'
import asyncio
import os
import sys

import asyncpg

url = os.environ.get("DATABASE_URL", "")
dsn = url.replace("postgresql+asyncpg://", "postgresql://")


async def wait() -> None:
    for attempt in range(60):
        try:
            conn = await asyncpg.connect(dsn)
            await conn.close()
            return
        except Exception as exc:  # noqa: BLE001
            if attempt % 5 == 0:
                print(f"[cart-paper]   still waiting ({exc.__class__.__name__})")
            await asyncio.sleep(1)
    print("[cart-paper] database never became reachable", file=sys.stderr)
    raise SystemExit(1)


asyncio.run(wait())
PY

echo "[cart-paper] applying migrations..."
alembic upgrade head

echo "[cart-paper] starting uvicorn $*"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 "$@"
