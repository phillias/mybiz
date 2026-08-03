---
name: mybiz-stack
description: >
  Design + operations runbook for the mybiz stack — the production AI-agent-driven
  business stack behind Harbor (harborseo.ai, AI-native SEO content SaaS) and the
  agency services built on it. Covers the full component map (Astro + Convex +
  Clerk + Stripe + Resend + Cloudflare Pages + Turnstile + GitHub + Telnyx
  voice/SMS), the hard-won technical gotchas (Convex HTTP actions, Ed25519 webhook
  verification, Clerk->Convex auth, deploy flows), and the standing plan.
  Load when working on ~/mybiz/harbor, Harbor, the SEO content SaaS, the agency
  stack, or any of its components.
---

# mybiz stack — design & operations runbook

Business: **Harbor** (harborseo.ai) — AI-native SEO content workspace (€24/39/83
tiers, "all API costs included") for agencies/in-house teams, built by Income
Stream Surfers + Kraft Digital Agency. The stack also serves agency client work
(SEO content sites, event marketing).

## Stack map (component → role → real identifiers)

| Layer | Component | Identifiers / notes |
|---|---|---|
| Frontend | **Astro 7** + React islands | `src/pages/`, `@astrojs/cloudflare` adapter |
| Hosting | **Cloudflare Pages** | project `harbor-seo`; deploy via `scripts/deploy-pages.sh` (requires `npx wrangler login` once) |
| Backend | **Convex 1.43** (TS) | PROD `moonlit-spider-468.convex.cloud` · dev `sincere-penguin-244` · project `phillias-phog:harbor-seo` |
| Auth | **Clerk** (`@clerk/astro` v4) → Convex | dev instance `powerful.gibbon-3`; frontend API `powerful.gibbon-3.clerk.accounts.dev`; test user `u1-auth-test@harborseo.ai` |
| Payments | **Stripe** (EUR) | plans Solo €24 / Growth €39 / Powerhouse €83 in `convex/actions/billing.ts` |
| Email | **Resend** | action in `convex/actions/email.ts` (no-op until RESEND_API_KEY set) |
| Bot protection | **Cloudflare Turnstile** | env `TURNSTILE_SECRET`; `data-action="turnstile-spin-v2"`; verify route `/turnstile/verify` |
| Repo/CI | **GitHub** `phillias/harbor-seo` (private) | local `~/mybiz/harbor`; CI: codegen → astro check → typecheck → vitest → build → Pages artifact |
| Voice + SMS | **Telnyx** | toll-free **+1-877-445-5580** (id 3017003223971005577); voice conn `3016892976782640902`; messaging profile `40019fbd-5276-4c72-b4fc-6d6c281010fd` (webhook → `moonlit-spider-468.convex.site/telnyx-webhook`) |
| SEO data (future) | DataForSEO SERP API (MCP), rankexpand | U3 niche pipeline |
| Plan | `.omo/plans/2026-07-31-001-harbor-ai-business-stack.md` | 7 units: U1 foundation · U2 10DLC/comms · U3 niche · U4 site blueprint · U5 Harbor gate · U6 agents · U7 obs/sales |

## Repo layout (`~/mybiz/harbor`)

```
convex/            backend: schema.ts (pageBlueprint/nicheScore/conversations),
                   http.ts (Turnstile + Telnyx + /auth/me), auth.config.ts,
                   seed.ts (19 archetypes), actions/ (email, billing), lib/ (ed25519)
src/               Astro: pages/ (index, app), components/TurnstileWidget, middleware.ts (Clerk)
scripts/           sync-secrets.sh (.env → GH secrets) · deploy-pages.sh (build+env+deploy)
docs/              U2-telnyx-checklist.md · tollfree-verification-draft.md
.env.example       full env contract (real values live in .env — gitignored)
```

## Key commands

```bash
cd ~/mybiz/harbor
npx convex dev --once                    # codegen + typecheck (non-interactive project check)
npx convex deploy                        # push to prod (targets PROD unless CONVEX_DEPLOY_KEY is in .env!)
npx convex env set <KEY> <val> --prod    # prod env var (default targets dev)
npm run check / typecheck / test / build # astro check, tsc+convex, vitest, build
./scripts/sync-secrets.sh                # .env → GitHub secrets/variables
npx wrangler login && ./scripts/deploy-pages.sh   # one-time deploy to Pages
```

## Hard-won gotchas (the golden paths)

1. **Convex HTTP actions serve on `.convex.site`, NOT `.convex.cloud`** — the cloud URL 404s httpRouter routes. `PUBLIC_CONVEX_URL` must be the `.convex.site` URL.
2. **HTTP routes need the `httpAction` builder** from `_generated/server` (`PublicHttpAction` is a branded `{isHttp:true}` type — plain async fns fail TS). Handler ctx = `(ctx, request)`; DB writes via `ctx.runMutation(internal.*)`.
3. **`"use node"` is FORBIDDEN in `convex/http.ts`** (edge runtime) — use Web Crypto (`crypto.subtle`) for HMAC/Ed25519; returns `Uint8Array<ArrayBuffer>` for BufferSource params; pass algorithm as string `"Ed25519"`.
4. **Telnyx webhooks = Ed25519 over `${telnyx-timestamp}|${rawBody}`** — headers `telnyx-signature-ed25519` (Base64) + `telnyx-timestamp` (Unix). Verify against `TELNYX_PUBLIC_KEY` (Mission Control → API Keys → Public Key), fail-closed 401 + 5-min replay window. NOT HMAC, NOT RS256 JWT.
5. **Telnyx toll-free verification API**: POST `/v2/messaging_tollfree/verification/requests`; `phoneNumbers` = `[{"phoneNumber": "..."}]` and `optInWorkflowImageURLs` = `[{"url": "..."}]` (minItems 1, OBJECT arrays — plain strings → 10015 "not well-formed"); list returns `records` not `data` and needs `page=1`; duplicate submit → "10012 Duplicate resource".
6. **`convex dev --once --configure --project <name>`** links a project non-interactively (steps 1–3 only). Convex CLI prompts read the TTY — pipe via `script -qc "cmd" log` or `printf 'Y\n' |`.
7. **`convex env set` defaults to DEV; use `--prod`** for the production deployment. A `CONVEX_DEPLOY_KEY` in `.env` makes `convex deploy` silently target THAT key's deployment — keep the key out of `.env` (CI-only, GH secret).
8. **Clerk → Convex auth uses native `convex/auth.config.ts`** (`domain: CLERK_JWT_ISSUER_DOMAIN, applicationID: "convex"`) + `ctx.auth.getUserIdentity()`. Do NOT use `@convex-dev/auth` for Clerk — it has no Clerk provider. `CLERK_JWT_ISSUER_DOMAIN` must be set on the Convex deployment. The "convex" JWT template must exist in Clerk (dashboard Convex integration or manual API create; `iss`/`sub` are reserved claims — only custom claims like `aud`/`email` allowed).
9. **Positive-path Clerk QA is blocked from this box**: `clerk.accounts.dev` fails TLS egress here (api.clerk.com works). Verify auth via the Pages deployment login, not local dev. Astro dev also binds IPv6-only `[::1]:4321`.
10. **CORS is manual in Convex** — add an `OPTIONS pathPrefix "/"` route + `access-control-*` headers (echo origin + `vary: origin`).
11. **Git identity** for commits: `GIT_AUTHOR_NAME/GIT_COMMITTER_NAME="big-pickle@InspironOne"` (per global AGENTS.md rule `<model>@<hostname>`).

## Comms layer state (Telnyx)

- Toll-free **+1-877-445-5580** purchased + wired (voice connection + mybiz messaging profile).
- **Toll-free verification SUBMITTED** (request `e89288f0-ed15-5705-ad1e-f90e34f082d4`, 2026-08-01) — approval ~1–5 business days, emails to admin@phillias.us. After approval: text the number → `conversations` row in Convex (webhook round-trip QA).
- STIR/SHAKEN verified-number verification requested (method `call`) — code delivery needs an answering voice app (U6) or the code from Mission Control.
- Local number +1-689-225-8286 was cancelled during verification — toll-free means NO 10DLC needed (faster SMS path).

## Auth state (Clerk → Convex)

- Auth chain deployed + negatively verified (no token → 401 on `/auth/me`). Positive proof = first real login via Pages.
- Clerk test user `u1-auth-test@harborseo.ai` (id `user_3HJkkGcuBUm3eGLyMaqcQsLAu6C`) + `convex` JWT template staged for that test.

## Open items (user-gated)

1. Telnyx toll-free approval (~1–5 business days) → webhook round-trip QA
2. Cloudflare `npx wrangler login` → `./scripts/deploy-pages.sh` → first sign-in = auth positive proof
3. Resend + Stripe keys when email/billing flows start
4. Placeholder image URL in the toll-free verification (`harborseo.ai/opt-in-workflow.png`) — replace with a real screenshot if reviewers flag

## Environment / credentials

Real secret VALUES live in `~/mybiz/harbor/.env` and GitHub secrets (via `scripts/sync-secrets.sh`) — never inline them. Key env vars: `PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY` (CI), `PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN`, `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, `TELNYX_NUMBER`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`.
