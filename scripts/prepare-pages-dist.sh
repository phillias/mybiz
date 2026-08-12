#!/usr/bin/env bash
# Post-process the Astro build output into a Pages-deployable dist/.
#
# @astrojs/cloudflare@14 is Workers-targeted: it emits a Workers-style
# dist/server/wrangler.json that `wrangler pages deploy` rejects (reserved
# ASSETS binding + main/rules/images keys). Pages injects the ASSETS binding
# at runtime, so we deploy in single-file Pages mode: wrap the server entry in
# dist/_worker.js, drop the worker config, and copy the client assets to the
# deploy root (otherwise /_astro, /sitemap, /robots land under /client/* and
# the page renders unstyled).
set -euo pipefail

rm -f dist/server/wrangler.json
printf 'export { default } from "./server/entry.mjs";\n' > dist/_worker.js
rm -rf .wrangler/deploy   # clear stale redirected-config state
cp -a dist/client/. dist/
echo "pages dist prepared: _worker.js + client assets at dist root"
