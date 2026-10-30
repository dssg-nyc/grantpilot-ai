#!/usr/bin/env bash
# Mints the self-hosted Supabase secrets into deploy/.env (created from
# .env.example if missing):
#   JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY (HS256 JWTs signed with JWT_SECRET),
#   POSTGRES_PASSWORD, DASHBOARD_PASSWORD, PG_META_CRYPTO_KEY, CRON_SECRET.
#
# Existing non-placeholder values are kept, so it is safe to re-run. Pass
# --force to regenerate everything (this invalidates every session and, for
# POSTGRES_PASSWORD, only works before the db volume is first initialised).
#
# Requires: openssl. Print-only mode: ./generate-keys.sh --print
set -euo pipefail

cd "$(dirname "$0")"
ENV_FILE=.env
FORCE=0; PRINT=0
for a in "$@"; do
  case "$a" in
    --force) FORCE=1 ;;
    --print) PRINT=1 ;;
    *) echo "usage: $0 [--force] [--print]" >&2; exit 2 ;;
  esac
done

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

# sign_jwt <role> <secret>: 10-year HS256 token with Supabase's claim shape.
sign_jwt() {
  local role="$1" secret="$2" now exp header payload sig
  now=$(date +%s); exp=$((now + 10 * 365 * 24 * 3600))
  header=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%d,"exp":%d}' "$role" "$now" "$exp" | b64url)
  sig=$(printf '%s.%s' "$header" "$payload" | openssl dgst -sha256 -hmac "$secret" -binary | b64url)
  printf '%s.%s.%s' "$header" "$payload" "$sig"
}

rand_hex() { openssl rand -hex "$1"; }

if [[ $PRINT -eq 1 ]]; then
  secret=$(rand_hex 32)
  echo "JWT_SECRET=$secret"
  echo "ANON_KEY=$(sign_jwt anon "$secret")"
  echo "SERVICE_ROLE_KEY=$(sign_jwt service_role "$secret")"
  exit 0
fi

[[ -f $ENV_FILE ]] || cp .env.example "$ENV_FILE"
chmod 600 "$ENV_FILE"

current() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true; }
is_placeholder() { [[ -z "$1" || "$1" == change-me* || "$1" == your-* ]]; }

set_var() {
  local key="$1" value="$2" tmp
  tmp=$(mktemp)
  if grep -qE "^$key=" "$ENV_FILE"; then
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k {print k "=" v; next} {print}' "$ENV_FILE" > "$tmp"
  else
    cp "$ENV_FILE" "$tmp"; printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi
  cat "$tmp" > "$ENV_FILE"; rm -f "$tmp"
}

ensure() { # ensure <key> <generator...>
  local key="$1"; shift
  if [[ $FORCE -eq 1 ]] || is_placeholder "$(current "$key")"; then
    set_var "$key" "$("$@")"; echo "generated $key"
  else
    echo "kept      $key"
  fi
}

ensure POSTGRES_PASSWORD rand_hex 24
ensure DASHBOARD_PASSWORD rand_hex 16
ensure PG_META_CRYPTO_KEY rand_hex 16
ensure CRON_SECRET rand_hex 32

jwt_changed=0
if [[ $FORCE -eq 1 ]] || is_placeholder "$(current JWT_SECRET)"; then
  set_var JWT_SECRET "$(rand_hex 32)"; echo "generated JWT_SECRET"; jwt_changed=1
else
  echo "kept      JWT_SECRET"
fi
secret=$(current JWT_SECRET)
for pair in ANON_KEY:anon SERVICE_ROLE_KEY:service_role; do
  key=${pair%%:*}; role=${pair#*:}
  if [[ $jwt_changed -eq 1 ]] || is_placeholder "$(current "$key")"; then
    set_var "$key" "$(sign_jwt "$role" "$secret")"; echo "generated $key"
  else
    echo "kept      $key"
  fi
done

echo
echo "Secrets written to deploy/$ENV_FILE (mode 600). Fill in the remaining values"
echo "(APP_DOMAIN, SITE_URL, SMTP_*, ANTHROPIC_API_KEY, RESEND_API_KEY, Stripe…)."
