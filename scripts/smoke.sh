#!/usr/bin/env bash
# Minimal smoke checks: containers boot, migrations applied, API answers,
# one authenticated round-trip works. Not a test suite — see docs/ARCHITECTURE.md.
set -uo pipefail

API="${API:-http://localhost:8000}"
WEB="${WEB:-http://localhost:5173}"
fails=0

check() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf '  \033[32mok\033[0m   %s\n' "$name"
  else
    printf '  \033[31mFAIL\033[0m %s\n' "$name"
    fails=$((fails + 1))
  fi
}

echo "cart-paper smoke checks"

check "db container is healthy"        bash -c "docker compose ps db | grep -q healthy"
check "api container is running"       bash -c "docker compose ps api | grep -Eq 'running|Up'"
check "web container is running"       bash -c "docker compose ps web | grep -Eq 'running|Up'"
check "migrations at head"             bash -c "docker compose exec -T api alembic current | grep -q head"
check "GET /health"                    bash -c "curl -fsS $API/health | grep -q '\"status\":\"ok\"'"
check "GET /openapi.json"              bash -c "curl -fsS $API/openapi.json | grep -q 'CART Paper API'"
check "GET /books (public library)"    bash -c "curl -fsS '$API/books?limit=1' | grep -q 'items'"
check "web dev server responds"        bash -c "curl -fsS $WEB | grep -qi 'cart paper'"

# One authenticated round-trip: register -> /auth/me -> create a draft.
jar="$(mktemp)"
email="smoke-$(date +%s)@cartpaper.example"
check "POST /auth/register logs in" bash -c \
  "curl -fsS -c $jar -H 'Content-Type: application/json' \
   -d '{\"email\":\"$email\",\"password\":\"smoke-password-123\",\"display_name\":\"Smoke\"}' \
   $API/auth/register | grep -q '\"email\"'"
check "GET /auth/me with cookie"    bash -c "curl -fsS -b $jar $API/auth/me | grep -q '$email'"
check "POST /books creates a draft" bash -c \
  "curl -fsS -b $jar -H 'Content-Type: application/json' -d '{\"title\":\"Smoke draft\"}' \
   $API/books | grep -q '\"draft\"'"
rm -f "$jar"

echo
if [ "$fails" -eq 0 ]; then
  echo "all smoke checks passed"
else
  echo "$fails check(s) failed"
  exit 1
fi
