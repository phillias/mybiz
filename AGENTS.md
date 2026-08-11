# mybiz — Harbor product repo

Agent guide for the mybiz stack: the codebase for **Harbor**, our own AI-native
SEO content workspace SaaS. The full runbook (stack map, gotchas, env contract,
comms state) lives in `.agents/skills/mybiz-stack/SKILL.md` — load it for
operational depth; this file is the short version.

## The constellation

Owned vs consumed — this distinction matters for every decision here:

- **Owned**: this Astro + Convex app (the Harbor product) at `~/mybiz`; our
  homelab at `*.phillias.us` (Cloudflare tunnel, host `kali`); `phillias.us` is
  our primary domain and the intended CTIA corporate website.
- **Consumed SaaS — harborseo.ai ("Harbor" the service)**: a THIRD-PARTY AI SEO
  content generator we use, not a property we control. Its domain/mailbox
  (`hamish@harborseo.ai`) must NEVER be claimed as our corporate website or
  business contact. Use it only through its dashboard/API/MCP.
- **Backend services consumed**: Convex (app DB + functions), Clerk (auth),
  Stripe (billing), Resend (email), Cloudflare Pages (hosting), Cloudflare
  Turnstile (bot protection), Telnyx (voice + toll-free SMS), GitHub (CI).

## MCPs (project-scoped, in `.opencode/opencode.json`)

| MCP | Type | What it does | Auth |
|---|---|---|---|
| `harbor` | remote | Research topics / generate SEO articles & landing pages / reworks via harborseo.ai (consumes article credits) | `HARBOR_API_KEY` env — mint at harborseo.ai → dashboard → Devs; not yet set |
| `convex` | local | Inspect + manage the app's Convex deployment (schema, data, functions) | existing `convex login` |

How they fit together: the Astro app surfaces the product; the **convex** MCP is
how an agent inspects/drives the app's own backend; the **harbor** MCP is how an
agent drives external SEO content generation (a billable input, not a property).

## Idea generation (demand signals)

Free idea sources feed `demandSignal` (schema: `monetscope` | `trendstr` | `manual`,
verdict PROCEED/PIVOT/PAUSE) via `convex/actions/importDemandSignal.ts`:

- **MonetScope** (monetscope.com) — free, no-account catalog of validated
  opportunities (Reddit/HN/X signals scored on pain/WTP/market/validation/confidence).
  Harvest with `node scripts/harvest-ideas.mjs` (dry-run emits JSON; `--apply`
  imports via `npx convex run importDemandSignal`). Prod flow: `npx convex deploy --yes`
  FIRST (convex run won't `--push` to prod), then `--apply --prod`. Sources:
  `thisweek` (default, fresh) or `sitemap` (full ~1900-page catalog, capped at 100
  unless `--limit`; index pages like /types and /tags are filtered out).
- **Trendstr** (trendstr.io) — free to browse, 5-factor validated ideas from
  Reddit/HN/ProductHunt/GitHub/IndieHackers; client-rendered (bot shell) so not
  scriptable yet — harvest manually into `source: "trendstr"` payloads.
- Do NOT use harborseo.ai's MCP as an idea source until it's available; it's a
  billable content-generation input, not free discovery.

## Publishing target & design (evolving)

- **Publishing target = our own Astro → Cloudflare Pages stack**, not a
  one-click CMS. Harbor-the-service's WordPress/Shopify/Webflow targets are
  rejected because Impeccable needs a real codebase; our stack is the only
  target where both tools fit (Harbor API/raw-HTML out, Impeccable gate in).
- **Content flow**: harborseo.ai API (or MCP) generates raw-HTML articles →
  ingest into Convex → render via Astro → deploy to Pages. Site registration
  requires a reachable `sitemap.xml` (`sitemap_url` is a required field) — so
  add `@astrojs/sitemap` (`site: https://phillias.us`) + `robots.txt` BEFORE
  registering phillias.us with Harbor.
- **Design**: Impeccable (`npx impeccable`) — `init` writes `PRODUCT.md` +
  `DESIGN.md` into the repo; `npx impeccable detect` (60 deterministic rules,
  CI-friendly JSON) is the design quality gate in `.github/workflows/ci.yml`;
  `npx impeccable live` iterates in-browser during dev.
- **CI cost**: GitHub Actions is free on private repos (2,000 min/month + 500 MB
  storage) — no paid GitHub subscription needed.

## Golden paths (quick)

- Convex HTTP actions serve on `.convex.site`, NOT `.convex.cloud` — `PUBLIC_CONVEX_URL` must be the `.convex.site` URL.
- Telnyx webhooks = Ed25519 over `${telnyx-timestamp}|${rawBody}`, fail-closed 401, 5-min replay window.
- Clerk → Convex auth via native `convex/auth.config.ts` (`domain: CLERK_JWT_ISSUER_DOMAIN`, `applicationID: "convex"`); no `@convex-dev/auth`.
- Deploy: `./scripts/deploy-pages.sh` → Cloudflare Pages project `mybiz` (apex custom domain `phillias.us`). Headless: `CLOUDFLARE_API_TOKEN`+`CLOUDFLARE_ACCOUNT_ID` in `.env`, run with `NODE_OPTIONS=--dns-result-order=ipv6first` (token is IPv6-restricted). Adapter@14 is Workers-targeted — the script wraps `dist/_worker.js` + copies client assets to the deploy root to make `wrangler pages deploy` work. CI deploys will need the same handling + an IP-unrestricted token.
- Secrets: `./scripts/sync-secrets.sh` pushes `.env` → GitHub secrets/variables. Real values live in `.env` (gitignored); never write secret VALUES into code, skills, or memory — record locations only.

## CTIA toll-free verification (resubmitted)

- Request `e89288f0-ed15-5705-ad1e-f90e34f082d4` was rejected 2026-08-04
  (claimed `corporateWebsite: https://harborseo.ai`, which we don't control) and
  **resubmitted 2026-08-10 — status "Waiting For Telnyx"**. Corrected:
  corporateWebsite `https://phillias.us` (live), businessName **Phileas Fogg**,
  contact `admin@phillias.us`, on-domain `/opt-in` (branded, blank checkbox,
  phone field, disclosures, STOP/HELP), `/privacy`, `/terms`, and a real
  `/opt-in-workflow.png`. Approval emails to admin@phillias.us.

## Commands

- `npm run dev | build | preview | check | typecheck | test`
- `npx convex dev --once` · `npx convex deploy` · `npx convex env set <K> <V> --prod`
- `./scripts/sync-secrets.sh` · `./scripts/deploy-pages.sh`
- `npx impeccable detect` (design gate) · `npx impeccable live` (browser iteration)
