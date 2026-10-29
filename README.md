# Harbor

AI-native SEO content workspace — production stack scaffold (U1 foundation + U2 comms layer per `~/.omo/plans/2026-07-31-001-harbor-ai-business-stack.md`).

## Stack

| Layer | Component |
|---|---|
| Frontend | Astro 7 (content-first, islands) |
| Hosting | Cloudflare Pages (via `@astrojs/cloudflare`) |
| Backend | Convex (reactive TS backend) |
| Auth | Clerk (`@clerk/astro`) |
| Payments | Stripe (EUR plans, test mode) |
| Email | Resend |
| Bot protection | Cloudflare Turnstile |
| Voice + SMS | Telnyx (number provisioned in U2) |

## Getting started

```bash
npm install
cp .env.example .env        # fill in real keys from the accounts
npx convex dev              # start local Convex backend (or `npx convex deploy`)
npm run dev                 # Astro dev server
```

## Scripts

- `npm run dev` — Astro dev server
- `npm run build` — production build (Cloudflare Pages output to `dist/`)
- `npm run check` — Astro type/check
- `npm run typecheck` — `tsc --noEmit` + `convex typecheck`
- `npm test` — run the Vitest unit-test suite (network calls mocked)
- `npx convex deploy` — deploy Convex functions
- `node scripts/generate-core30.mjs` — Core 30 article generation (dry-run default)
- `node scripts/prospect-score.mjs` — local-business SEO-opportunity scoring (dry-run default)
- `node scripts/aftercall-probe.mjs` — Aftercall voice-payload probe (dry-run default)

## Structure

```
convex/          backend functions (schema, http routes, actions)
  schema.ts      pageBlueprint / nicheScore / conversations tables
  seed.ts        archetype seed data
  http.ts        Turnstile verify + Telnyx webhook HTTP routes
  actions/       email (Resend), billing (Stripe) stubs
src/
  pages/         Astro routes
  components/    Turnstile widget
  layouts/       BaseLayout — shared <head> (canonical, OG/Twitter, JSON-LD)
  lib/           shared frontend code (schema.ts JSON-LD builders)
  config/        site identity single source of truth (site.ts)
  middleware.ts  Clerk middleware
```

## Deployment

- Convex: `npx convex deploy`
- Cloudflare Pages: `npx wrangler login` (once) → `./scripts/deploy-pages.sh` (creates the project on first run, then deploys `dist/`)
- Or connect the repo in the Cloudflare dashboard → Pages → Create project → GitHub repo `phillias/mybiz` → build output `dist/` (CI artifact uploads already configured)
- CI: `.github/workflows/ci.yml` (codegen → check → typecheck → tests → build → Pages artifact)

## Status

U1–U2 scaffold live. Telnyx toll-free +1-877-445-5580 verified 2026-08-13. New modules in this branch: Core 30 GBP strategy (`scripts/generate-core30.mjs`), Prospect Radar lead-gen (`scripts/prospect-score.mjs`), and The Aftercall voice/SMS review layer (`convex/aftercall.ts`). AEO/GEO readiness: `public/llms.txt`, favicon + OG image, sitemap hygiene (excludes `/app` and `/sign-in`, per-article `lastmod`), `public/_headers` cache rules, `/sign-in` page, shared `BaseLayout` with JSON-LD (`src/lib/schema.ts`), and `render-article.mjs` pipeline upgrades (meta description, `BlogPosting`/`FAQPage` schema, image localization).
