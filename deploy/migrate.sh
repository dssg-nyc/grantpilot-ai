#!/usr/bin/env bash
# Applies supabase/migrations/*.sql in filename order, each exactly once.
# Applied versions are tracked in _grantpilot.schema_migrations, so re-running is
# a no-op. Each file runs in its own transaction; the first failure aborts.
#
# Runs as the compose "migrate" one-shot service, or by hand from the repo root:
#   DATABASE_URL=postgres://postgres:...@127.0.0.1:5432/postgres deploy/migrate.sh
#
# --baseline   mark every migration as applied WITHOUT running it (use after
#              restoring a pg_dump of an already-migrated database).
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$(cd "$(dirname "$0")/.." && pwd)/supabase/migrations}"
BASELINE=0
[[ "${1:-}" == "--baseline" ]] && BASELINE=1

psql_q() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -q "$@"; }

psql_q <<'SQL'
CREATE SCHEMA IF NOT EXISTS _grantpilot;
CREATE TABLE IF NOT EXISTS _grantpilot.schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "migrate: no .sql files in $MIGRATIONS_DIR" >&2
  exit 1
fi

applied=0
for f in "${files[@]}"; do
  version="$(basename "$f" .sql)"
  exists="$(psql_q -tA -c "SELECT 1 FROM _grantpilot.schema_migrations WHERE version = '$version'")"
  [[ "$exists" == "1" ]] && continue

  if [[ $BASELINE -eq 1 ]]; then
    echo "migrate: baseline $version"
  else
    echo "migrate: applying $version"
    psql_q --single-transaction -f "$f"
  fi
  psql_q -c "INSERT INTO _grantpilot.schema_migrations (version) VALUES ('$version')"
  applied=$((applied + 1))
done

# PostgREST caches the schema; tell it to reload after DDL.
psql_q -c "NOTIFY pgrst, 'reload schema'"
echo "migrate: done ($applied new, ${#files[@]} total)"
