#!/usr/bin/env bash
# Deploy the Astro build to Cloudflare Pages + wire runtime env vars from .env.
# Requires Cloudflare auth first: `npx wrangler login` (browser) or
# CLOUDFLARE_API_TOKEN exported (token needs Account.Cloudflare Pages:Edit).
set -euo pipefail

PROJECT="${CLOUDFLARE_PAGES_PROJECT:-harbor-seo}"
BRANCH="${CLOUDFLARE_PAGES_BRANCH:-main}"
ENV_FILE="${1:-.env}"
[ -f "$ENV_FILE" ] || { echo "no $ENV_FILE — copy .env.example and fill real keys first"; exit 1; }

npm run build

if ! npx wrangler pages project list 2>/dev/null | grep -q "$PROJECT"; then
  npx wrangler pages project create "$PROJECT" --production-branch "$BRANCH"
fi

# Runtime env vars for the Pages project (secrets work for public values too).
set -a; source "$ENV_FILE"; set +a
for key in PUBLIC_SITE_URL PUBLIC_CONVEX_URL PUBLIC_CLERK_PUBLISHABLE_KEY \
  CLERK_SECRET_KEY PUBLIC_TURNSTILE_SITE_KEY TURNSTILE_SECRET; do
  if [ -n "${!key:-}" ]; then
    printf '%s' "${!key}" | npx wrangler pages secret put "$key" --project-name "$PROJECT" >/dev/null
    echo "pages env: $key"
  else
    echo "pages env: $key (missing in $ENV_FILE — skipped)"
  fi
done

npx wrangler pages deploy dist --project-name "$PROJECT" --branch "$BRANCH"
