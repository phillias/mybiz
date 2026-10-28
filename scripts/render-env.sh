#!/usr/bin/env bash
# Render .env and .env.local from the phillias BWS vault (MYBIZ_* secrets).
# Run from repo root:  scripts/render-env.sh
# Vault wins over any existing plaintext (same overlay pattern as
# ~/docker/pirate/setup.sh bws_overlay). Secrets never printed.
#
# Known gap: STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are intentionally
# absent from the vault (empty in the pre-migration .env; bws rejects empty
# values). Add them to the vault when Stripe is wired up.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

BWS_PROJECT_ID="fe9eea09-9eaf-45e6-a72f-b45e0150b29d"
BWS_SECRET_PREFIX="MYBIZ_"
BWS_TOKEN_FILE="${BWS_TOKEN_FILE:-$HOME/.agents/keys/phillias/.bws-token}"
if [ ! -r "$BWS_TOKEN_FILE" ]; then
  BWS_TOKEN_FILE="$HOME/.agents/keys/default/.bws-token"
fi
[ -r "$BWS_TOKEN_FILE" ] || { echo "error: no readable BWS token file" >&2; exit 1; }

tmp_env="$(mktemp)"; tmp_local="$(mktemp)"
trap 'rm -f "$tmp_env" "$tmp_local"' EXIT

fetch_to() {
  local out="$1" filter="$2" k v
  BWS_ACCESS_TOKEN="$(cat "$BWS_TOKEN_FILE")" bws secret list "$BWS_PROJECT_ID" -o json \
    | jq -j --arg pfx "$BWS_SECRET_PREFIX" "$filter" \
    | while IFS= read -r -d '' k && IFS= read -r -d '' v; do
        printf '%s=%s\n' "${k#"$BWS_SECRET_PREFIX"}" "$v" >> "$out"
      done
}

fetch_to "$tmp_env"   '.[] | select((.key | startswith($pfx)) and ((.key | startswith($pfx + "CONVEX_")) | not)) | .key, "\u0000", .value, "\u0000"'
fetch_to "$tmp_local" '.[] | select(.key | startswith($pfx + "CONVEX_")) | .key, "\u0000", .value, "\u0000"'

n_env=$(grep -c '=' "$tmp_env" || true)
n_local=$(grep -c '=' "$tmp_local" || true)
if [ "$n_env" -eq 0 ]; then
  echo "error: 0 secrets fetched from vault — not clobbering existing env" >&2
  exit 1
fi

chmod 600 "$tmp_env" "$tmp_local"
mv -f "$tmp_env" .env
mv -f "$tmp_local" .env.local
echo "rendered .env ($n_env keys) + .env.local ($n_local keys) from vault MYBIZ_*"
