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
- `npx convex deploy` — deploy Convex functions

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
  lib/           shared frontend code
  middleware.ts  Clerk middleware
```

## Deployment

- Convex: `npx convex deploy`
- Cloudflare Pages: `npx wrangler login` (once) → `./scripts/deploy-pages.sh` (creates the project on first run, then deploys `dist/`)
- Or connect the repo in the Cloudflare dashboard → Pages → Create project → GitHub repo `phillias/harbor-seo` → build output `dist/` (CI artifact uploads already configured)
- CI: `.github/workflows/ci.yml` (codegen → check → typecheck → tests → build → Pages artifact)

## Status

U1 + U2 scaffold — env keys not yet wired, Telnyx number pending provisioning (user portal), 10DLC decision deferred (toll-free verification path recommended for solo operator).
