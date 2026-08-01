#!/usr/bin/env bash
# Deploy the Astro build to Cloudflare Pages.
# Requires Cloudflare auth first: `npx wrangler login` (browser) or
# CLOUDFLARE_API_TOKEN exported (token needs Account.Cloudflare Pages:Edit).
set -euo pipefail

PROJECT="${CLOUDFLARE_PAGES_PROJECT:-harbor-seo}"
BRANCH="${CLOUDFLARE_PAGES_BRANCH:-main}"

npm run build

if ! npx wrangler pages project list 2>/dev/null | grep -q "$PROJECT"; then
  npx wrangler pages project create "$PROJECT" --production-branch "$BRANCH"
fi

npx wrangler pages deploy dist --project-name "$PROJECT" --branch "$BRANCH"
