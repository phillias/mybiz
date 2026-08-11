#!/usr/bin/env bash
# Deploy the Astro build to Cloudflare Pages + wire runtime env vars from .env.
# Headless auth: CLOUDFLARE_API_TOKEN (+ CLOUDFLARE_ACCOUNT_ID) in .env or the
# shell env (token needs Account.Cloudflare Pages:Edit; Zone DNS:Edit for the
# custom domain). Interactive alternative: `npx wrangler login`.
set -euo pipefail

PROJECT="${CLOUDFLARE_PAGES_PROJECT:-mybiz}"
BRANCH="${CLOUDFLARE_PAGES_BRANCH:-main}"
ENV_FILE="${1:-.env}"
[ -f "$ENV_FILE" ] || { echo "no $ENV_FILE — copy .env.example and fill real keys first"; exit 1; }

# Source early so CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID in .env cover every
# wrangler call below (project list/create need auth too).
set -a; source "$ENV_FILE"; set +a

npm run build

# The @astrojs/cloudflare v14 adapter emits a Workers-style dist/server/wrangler.json
# that `wrangler pages deploy` rejects (reserved ASSETS binding + main/rules/images
# keys). Pages injects the ASSETS binding at runtime, so deploy in single-file
# Pages mode: wrap the server entry in dist/_worker.js and drop the worker config.
rm -f dist/server/wrangler.json
printf 'export { default } from "./server/entry.mjs";\n' > dist/_worker.js
rm -rf .wrangler/deploy   # clear stale redirected-config state

# dist/ is the Pages deploy root, so client assets must sit at root too —
# otherwise /_astro/*, /sitemap-index.xml and /robots.txt land under /client/*.
cp -a dist/client/. dist/

if ! npx wrangler pages project list 2>/dev/null | grep -q "$PROJECT"; then
  npx wrangler pages project create "$PROJECT" --production-branch "$BRANCH"
fi

# Runtime env vars for the Pages project (secrets work for public values too).
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
