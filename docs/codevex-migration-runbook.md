# codevex.app migration runbook (phillias.us → codevex.app)

**Decision:** captain, 2026-08-24 — **codevex.app becomes the commercial/professional
domain**; phillias.us is NOT used for commercial purposes going forward. Brand
entity is **"Phileas"**; Harbor is a service of the mybiz constellation, not the brand.

**Split of work:** repo-side changes ship in the migration PR (site config,
robots.txt, contact email via `PUBLIC_CONTACT_EMAIL`, canonical/og:url, legal
prose, host-scoped 301 in `src/middleware.ts` + unit test). Everything below is
**dashboard/API-side and cannot be done from this repo** — it is captain-owned.
No DNS or dashboard mutations were made by the agent task that wrote this file.

**Deliberately untouched (domain-independent):** Cloudflare Pages project name
(`mybiz`, `wrangler.toml`), Convex deployment URLs (`moonlit-spider-468.*`),
Telnyx webhook endpoints (`…convex.site/telnyx-webhook`). Source: audit report §4.7.

Both hostnames serve the **same Pages project**, so the legacy redirect lives in
middleware (host-scoped) — never add a host-blind catch-all to `public/_redirects`
(it would infinite-loop codevex.app).

**Audit finding F8 (2026-08-24):** the `/sitemap.xml /sitemap-index.xml 302` rule in
`public/_redirects` is intentionally retained — it is harmless post-cutover because
`/sitemap.xml` does not exist as a standalone file, so the 302 to `/sitemap-index.xml`
is correct fallback behavior.

---

## 1. Cloudflare zone + DNS

1. **Add the zone**: dash.cloudflare.com → **Add a domain** → `codevex.app` →
   Free plan → note the assigned nameserver pair → set those NS at the registrar
   for codevex.app → wait for "Active".
2. **Apex custom domain on Pages**: dash.cloudflare.com → **Workers & Pages** →
   project `mybiz` → **Custom domains** → **Set up a custom domain** →
   `codevex.app`. Apex works via CNAME flattening; CF adds the record.
3. **www + redirect**: same flow for `www.codevex.app`, then a zone-level
   redirect: zone codevex.app → **Rules → Redirect Rules → Create rule**:
   - When: Hostname equals `www.codevex.app`
   - Then: Dynamic redirect, 301, expression
     `concat("https://codevex.app", http.request.uri.path)`
   - **Preserve query string: ON**
   (Middleware passes all `codevex.app` hosts through untouched by design, so
   www serves content until this rule exists — sitemap/canonical point at apex.)
4. **Deploy-time secret (same change window as the deploy)**: Workers & Pages →
   `mybiz` → Settings → **Variables & Secrets** → Production:
   - `PUBLIC_SITE_URL = https://codevex.app`
   - (add when needed) `PUBLIC_CONTACT_EMAIL = admin@codevex.app`
5. **AI Crawl Control on the NEW zone** — ⚠️ **POLICY DECISION PENDING with the
   captain** (audit hold `cf-ai-crawl-policy`, report §6.1). New zones inherit
   nothing; phillias.us's current posture blocks ALL AI crawlers including search
   bots (403s OAI-SearchBot/PerplexityBot/ClaudeBot) — do not silently replicate.
   Zone codevex.app → **AI Crawl Control / Bots**: minimum citation posture per
   audit = allow OAI-SearchBot, PerplexityBot, ClaudeBot; GPTBot/CCBot is the
   captain's call. Verify afterwards with the UA-probe table (curl `-A <bot>`).
6. **Old zone phillias.us**: keep live during transition (legacy redirect traffic
   + mail forwarding depend on it). Do not delete.

## 2. Clerk — highest-risk external dependency

Facts from Clerk docs ("Changing your production domain"):
changing the production domain **regenerates the Publishable key automatically**
(app fails to load until the new key is deployed); social-connection redirect
URLs must be updated; and if the Frontend API domain moves off
`<instance>.clerk.accounts.dev`, the **JWT issuer/JWKS endpoint changes**.

Current state here: keys are test-mode (`pk_test`/`sk_test`) and
`CLERK_JWT_ISSUER_DOMAIN=https://<instance>.clerk.accounts.dev` — i.e. no custom
Clerk domain yet. Two paths:

- **Case A — stay on the accounts.dev Frontend API** (lowest risk):
  dash.clerk.com → instance → check **Production instances → Domains** and home/
  sign-in URL config. Home/sign-in URLs are path-based and survive the hostname
  change. Verify sign-in/sign-up round-trips on codevex.app after deploy.
- **Case B — move to a production custom domain (`clerk.codevex.app`)**:
  1. Dashboard → Domains → Add production domain `codevex.app` → create the
     shown CNAME (`clerk.codevex.app`) in the CF zone → cert issued.
  2. Copy the **new publishable key** → update `PUBLIC_CLERK_PUBLISHABLE_KEY`
     on Pages (step 1.4) + `.env` + GitHub secrets → redeploy. Without this,
     **Clerk fails to load entirely**.
  3. Issuer changes ⇒ update Convex auth: `npx convex env set
     CLERK_JWT_ISSUER_DOMAIN https://clerk.codevex.app --prod` then redeploy
     Convex functions (`convex/auth.config.ts` validates the JWT `iss`). Skipping
     this breaks every authenticated request with 401s.
- Clerk→Convex webhooks are Convex-hosted (svix) — unaffected by the app hostname.

## 3. Turnstile widget hostname allowlist

dash.cloudflare.com → **Turnstile** → widget → Settings → **Hostnames**: add
`codevex.app` and `www.codevex.app`. Keys remain valid; a missing hostname makes
client verification fail silently. Remove old hostnames only after the new ones
pass on `/opt-in`.

## 4. Email: admin@codevex.app mailbox + legacy forwarding

1. **Mailbox/route**: either zone codevex.app → **Email → Email Routing** →
   Enable → Create address `admin@codevex.app` → action: send to an existing
   inbox (free forwarding, not sending), or provision a real mailbox on the mail
   provider of choice.
2. **Forward legacy**: zone phillias.us → Email Routing → route
   `admin@phillias.us` → forward to `admin@codevex.app` so CTIA/approval mail
   keeps flowing during and after transition.

## 5. SPF/DKIM before sending from codevex.app

resend.com → **Domains** → Add domain `codevex.app` → add the shown DKIM TXT,
SPF include, and DMARC records in the CF zone → verify → then flip the Pages
secret/env `RESEND_FROM=no-reply@codevex.app` before the first send. Sending
from an unauthenticated domain lands in spam (audit report §4.7).

## 6. Harbor re-registration (billable input)

Precondition: codevex.app live with reachable sitemap
(`https://codevex.app/sitemap-index.xml`) and `HARBOR_API_KEY` minted
(harborseo.ai → dashboard → Devs).

1. harborseo.ai → Sites → register `https://codevex.app` with sitemap
   `https://codevex.app/sitemap-index.xml` (registration requires a reachable
   sitemap).
2. Copy the NEW site id → set `HARBOR_SITE_ID` in `.env`, GitHub secrets/vars,
   and Pages env.
3. Until then, `scripts/generate-article.mjs` intentionally defaults `SITE_ID`
   to the OLD phillias.us registration (`nd7amxhtnt94bx5er1ygvm4rbx8c97yz`,
   commented as intentional in-script). Do not delete the old Harbor site before
   re-registration lands.

## 7. Post-launch submissions

1. **Google Search Console**: search.google.com/search-console → Add property →
   Domain `codevex.app` → DNS TXT verification on the CF zone → Sitemaps →
   submit `sitemap-index.xml`.
2. **Wayback Save-Page-Now**: web.archive.org/save → submit `https://codevex.app/`,
   `/articles/`, `/privacy`, `/terms`, `/opt-in` (starts corpus history; free;
   audit Phase-4 item 16).

---

## Verification checklist (after dashboard steps + deploy)

- [ ] UA probes vs `https://codevex.app/`: intended bots return 200 (per §1.5 decision)
- [ ] `curl -I 'https://www.phillias.us/foo?bar=1'` → `301` → `https://codevex.app/foo?bar=1`
- [ ] `curl -I 'https://codevex.app/foo'` → 200, **no Location header** (loop check)
- [ ] Sign-up/sign-in round-trip works on codevex.app (Clerk)
- [ ] Turnstile renders/passes on `/opt-in`
- [ ] First outbound email from `@codevex.app` lands in inbox (SPF/DKIM aligned)
- [ ] Sitemap resolves at `https://codevex.app/sitemap-index.xml`; GSC submitted
