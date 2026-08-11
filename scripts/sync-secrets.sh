#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-phillias/mybiz}"
ENV_FILE="${2:-.env}"
[ -f "$ENV_FILE" ] || { echo "no $ENV_FILE — copy .env.example and fill in real keys first"; exit 1; }

SECRET_KEYS=(CLERK_SECRET_KEY CLERK_JWT_ISSUER_DOMAIN PUBLIC_CLERK_PUBLISHABLE_KEY TURNSTILE_SECRET \
  PUBLIC_TURNSTILE_SITE_KEY RESEND_API_KEY RESEND_FROM STRIPE_SECRET_KEY \
  STRIPE_WEBHOOK_SECRET TELNYX_API_KEY TELNYX_PUBLIC_KEY TELNYX_NUMBER \
  CLOUDFLARE_API_TOKEN)
VARIABLE_KEYS=(PUBLIC_SITE_URL CLOUDFLARE_ACCOUNT_ID)

set -a; source "$ENV_FILE"; set +a

missing=()
for key in "${SECRET_KEYS[@]}"; do
  if [ -n "${!key:-}" ]; then
    printf '%s' "${!key}" | gh secret set "$key" -R "$REPO" >/dev/null
    echo "secret  $key"
  else
    missing+=("$key")
  fi
done

for key in "${VARIABLE_KEYS[@]}"; do
  if [ -n "${!key:-}" ]; then
    gh variable set "$key" -R "$REPO" -b "${!key}" >/dev/null
    echo "variable $key"
  else
    missing+=("$key")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo ""
  echo "still missing in $ENV_FILE: ${missing[*]}"
else
  echo ""
  echo "all keys synced to $REPO"
fi
