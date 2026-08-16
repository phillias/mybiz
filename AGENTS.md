# mybiz — Harbor product repo

Agent guide for the mybiz stack: the codebase for **Harbor**, our own AI-native
SEO content workspace SaaS. The full runbook (stack map, gotchas, env contract,
comms state) lives in `.agents/skills/mybiz-stack/SKILL.md` — load it for
operational depth; this file is the short version.

## The constellation

Owned vs consumed — this distinction matters for every decision here:

- **Owned**: this Astro + Convex app (the Harbor product) — this repo (`./`); our
  homelab at `*.phillias.us` (Cloudflare tunnel, host `kali`); `phillias.us` is
  our primary domain and the intended CTIA corporate website.
- **Consumed SaaS — harborseo.ai ("Harbor" the service)**: a THIRD-PARTY AI SEO
  content generator we use, not a property we control. Its domain/mailbox
  (`hamish@harborseo.ai`) must NEVER be claimed as our corporate website or
  business contact. Use it only through its dashboard/API/MCP.
- **Backend services consumed**: Convex (app DB + functions), Clerk (auth),
  Stripe (billing), Resend (email), Cloudflare Pages (hosting), Cloudflare
  Turnstile (bot protection), Telnyx (voice + toll-free SMS), GitHub (CI).

## Portfolio strategy — Harbor content is a tool, not the business

mybiz is not "a content SaaS." The Harbor content/voice stack is the **shared
engine** that powers a larger umbrella of portfolios. When asked to pick a niche,
vertical, or lead, first say which portfolio the decision serves — each has its
own scoring lens:

| Portfolio | What it is | Scoring lens | Durable plan |
|---|---|---|---|
| **Harbor product (SaaS)** | The AI-native SEO content workspace we sell (€24/39/83) to agencies/in-house teams; also serves our own agency client work | Keyword-level: `demandSignal` PROCEED + `nicheScore` PASS gate (U3) decides topic winnability | `~/.omo/plans/2026-07-31-001-harbor-ai-business-stack.md` (7 units) |
| **Local-services (NL Michigan)** | Local SMBs around our area — a bounty of them with severely lacking web presences and no customer-service engagement tech. Content (Core 30/GBP) + **voice SaaS** (Harbor Voice / The Aftercall) is the wedge | **Area-ranked lead selection = JP Middleton's rubric** (proven demand, growing, TAM >10k businesses, high-ticket $500+/transaction or $100+/mo). Upstream of Prospect Radar's per-business scoring | `docs/plans/2026-08-16-001-core-30-gbp-strategy.md` · `-002-vapi-review-outreach.md` · `-004-prospect-radar-leadgen.md` · `docs/evaluations/2026-08-16-jp-middleton-rubric-fit.md` |
| **Federal / govcon** | **Phillias Federal LLC** (LARA 2026-08-15, `philliasfederal.com`) — wins DoD/xTech prize + SBIR/STTR topics with excellent AI skills and AI-assisted manufacturing (AI-CAD → outsourced fab); ranking opportunities from the grant/topic sites | GovCon weighted rubric (AI-native fit ×5 … timeline ×2) in the plan §5; **monthly sweep** of xTech/DSIP/challenge.gov/grants.gov topic releases (first Wednesday) | `docs/plans/2026-08-15-govcon-brand-plan.md` |

Agent guidance:

- **Local-services niche choice** uses JP Middleton's rubric
  (`docs/jp-middleton-niche-research-rubric.md`): score a candidate vertical in a
  geography on the four pillars → ranked leads. This is the **strategic input** to
  Prospect Radar's business-level scoring; it does NOT replace the keyword-level
  `checkNiche` gate (that stays the U3 filter for what Harbor generates).
- **Federal opportunity ranking** uses the govcon plan's rubric; the sweep is
  monthly, xTech white-paper comps are the lowest-barrier entry, and wins become
  the "past performance" story for a Phase I SBIR.
- **Harbor's own pipeline** stays gated by `demandSignal` + `nicheScore` — the
  portfolio lenses sit *upstream* of that gate and decide what an agent should
  generate for, in which portfolio.

## Operating model — one pipeline, every portfolio

End state: every portfolio in the constellation runs the same five-stage flow —
**rank leads → scope & require → approve → implement → verify**. The automated
stages do the work; the two gates are human checkpoints an agent must stop at and
never self-approve.

| Stage | What it does | Machinery (existing → planned) |
|---|---|---|
| **1. Ranked lead generation** | Surface the best opportunities in a portfolio, ranked by that portfolio's scoring lens | demandSignal harvest (`harvest-ideas.mjs`, daily cron) · Prospect Radar (`prospect-score.mjs` per area+category) · govcon monthly topic sweep (xTech/DSIP/challenge.gov/grants.gov) |
| **2. Scoped effort & requirements** | Turn a ranked lead into a reviewable work package: the lead, the why, the effort (credits/time), and the requirement | `checkNiche` gate + Harbor topic research → scoped brief (one-screen reviewable) |
| **3. Approval gate (human)** | The package goes on the table; go/no-go is an explicit user decision | Agent presents the ranked + scoped package and **waits** — no check-ins skipped |
| **4. Automated implementation** | Execute the approved package end-to-end with no mid-flight stops | Harbor generation (article/landing/rework), Core 30 (`generate-core30.mjs`), The Aftercall, Astro render → Pages deploy, CI |
| **5. Verification gate** | Prove the shipped work meets the requirement before it counts as done | CI green (codegen → check → typecheck → test → build), `impeccable detect`, deploy check, review pass |

Rules for agents:

- **A lead is only "ranked" if it passed its portfolio's lens** — Middleton for
  local-services, the govcon rubric for federal, `demandSignal` + `nicheScore`
  for Harbor's own content.
- **Stage 2 must be reviewable at a glance**: the lead, why it ranks, the scoped
  effort, the requirement. No burying the decision in a wall of text.
- **The gates are consent points, not speed bumps** — blocked at a gate means
  return to the failing stage and fix, never skip forward.
- **Where a stage has no machinery yet, build it thin**: a script/action that
  follows repo conventions (dry-run by default, `--apply` to spend credits,
  plain ESM, no new deps unless needed).

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
- **Scheduled**: `.github/workflows/harvest.yml` runs the harvest daily (06:00
  UTC) + on demand (`workflow_dispatch`) via GH Actions (uses `CONVEX_DEPLOY_KEY`).
- **Downstream (U3+)**: nicheScore gate = `npx convex run --prod
  actions/checkNiche:checkNiche '{"keyword":"..."}'` (DataForSEO SERP API;
  `DATAFORSEO_API_KEY` = base64("email:password") set on the Convex prod
  deployment; account must be verified at app.dataforseo.com first) →
  `nicheScore.verdict PASS` && `demandSignal.providerVerdict PROCEED` →
  content generation via `scripts/generate-article.mjs` (Harbor API,
  `HARBOR_API_KEY` in `.env`, site id `nd7amxhtnt94bx5er1ygvm4rbx8c97yz` =
  phillias.us, 1 credit/article, ~3-5 min, output → `content/drafts/`,
  gitignored) → render as Astro pages → Pages deploy. For the harbor MCP in
  opencode, `HARBOR_API_KEY` must be in the opencode process env (export it
  before launch), not just `.env`.
- **Core 30 generation**: `node scripts/generate-core30.mjs --blueprints content/blueprints/core30-sample.json --dry-run` (1 credit/page on `--apply`).
- **Prospect Radar**: `node scripts/prospect-score.mjs --city <city> --category <cat> --dry-run` (DataForSEO on `--apply`; Maps endpoint is a TODO-verify stub).
- **The Aftercall probe**: `node scripts/aftercall-probe.mjs --phone ... --service ... --city ... --dry-run` (places real call on `--apply`).
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

## CTIA toll-free verification

- Status and compliance caveats (including the Aftercall use-case warning) are
  owned by `docs/U2-telnyx-checklist.md` — read that for current state. As of
  2026-08-13 request `e89288f0-ed15-5705-ad1e-f90e34f082d4` is **Verified**.

## Commands

- `npm run dev | build | preview | check | typecheck | test`
- `npx convex dev --once` · `npx convex deploy` · `npx convex env set <K> <V> --prod`
- `./scripts/sync-secrets.sh` · `./scripts/deploy-pages.sh`
- `npx impeccable detect` (design gate) · `npx impeccable live` (browser iteration)
