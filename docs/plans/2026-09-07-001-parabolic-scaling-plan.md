# Parabolic Scaling Plan — mybiz Revenue Hockey-Stick

**Status:** proposed · **Date:** 2026-09-07  
**Trigger:** Monthly recurring revenue (MRR) hits $10k or 10+ paying Harbor Local clients  
**Owner:** Harbor product roadmap

---

## The Premise

When Harbor revenue accelerates (hockey-stick), we don't just scale the current stack — we graduate to purpose-built tools designed for this moment. Two key assets:

| Tool | What it does | Why it matters |
|------|--------------|----------------|
| **[supastarter.dev](https://supastarter.dev/)** | Next.js SaaS boilerplate (AGENTS.md + Agent Skills spec) | If Harbor becomes a multi-tenant platform (white-label for agencies) |
| **[Talivia](https://github.com/talivia-group/talivia)** | Revenue-first analytics (MIT, self-hosted) | Attribution: which content/leads → revenue |

---

## Phase 0: Current Stack (Before Hockey-Stick)

| Layer | Tool | Notes |
|-------|------|-------|
| Framework | Astro + Convex | Static-first, serverless backend |
| Hosting | Cloudflare Pages | Edge deployment |
| Auth | Clerk | Already integrated |
| Payments | Stripe | Manual checkout links |
| Analytics | None | Blind spot |
| Attribution | None | Can't measure which content converts |

**Gap:** We don't know which Harbor articles, Prospect Radar leads, or Aftercall campaigns generate revenue.

---

## Phase 1: Revenue Attribution (First $10k MRR)

**Goal:** Know which marketing → revenue.

### 1.1 Deploy Talivia (Self-Hosted)

```bash
# Talivia setup (MIT, self-hosted)
git clone https://github.com/talivia-group/talivia
cd talivia
# Docker compose for local Postgres + app
docker compose up -d
```

**Talivia integrations needed:**
- Stripe (already in use)
- LemonSqueezy (if we switch)
- Polar (for Harbor credits)
- Manual Payment API (cash/check clients)

**Talivia tracks:**
- Web analytics (page views, sessions)
- Session Replay (watch users navigate Harbor site)
- Revenue attribution: referrer → campaign → page → subscription
- Customer journey: first touch → last touch → conversion

### 1.2 Agent Integration

Talivia has `@talivia/agent` for MCP clients (Hermes, Claude Code, Codex):

```bash
npm install @talivia/agent
```

This lets me (the agent) finish analytics setup inside the project — not just paste a tracking snippet.

### 1.3 Revenue Dashboard

After Talivia deploy, we can answer:

- "Which Prospect Radar leads converted?"
- "Which Harbor article drove the May Plumbing signup?"
- "What's the LTV of Aftercall vs. Core 30 clients?"
- "Which GBP posts correlate with revenue?"

---

## Phase 2: SaaS Platform (10+ Clients or $25k MRR)

**Goal:** Harbor becomes a platform, not just a service.

### 2.1 Decision Point

| Option | Trigger | Action |
|--------|---------|--------|
| **Stay service** | <10 clients, custom work | Keep Astro + Convex |
| **Go platform** | 10+ clients, repeatable package | Migrate to supastarter |

### 2.2 Why supastarter?

If Harbor scales to a multi-tenant SaaS:

- **Multi-tenancy built-in:** Organizations, team invites, RBAC
- **AGENTS.md compatible:** I can extend it natively (already using this pattern)
- **Agent Skills spec:** Same pattern I use for Harbor workflows
- **5 payment providers:** Stripe, LemonSqueezy, Polar, Creem, Dodo
- **Self-hostable:** Docker + Postgres, no vendor lock-in
- **i18n, blog, docs, admin UI:** All pre-built

### 2.3 Migration Path

If we hit the trigger:

```bash
# Purchase supastarter Agency license ($1,499 once)
# Clone and configure
npx create-supastarter@latest --framework nextjs

# Port Harbor content model
# - pageBlueprint → supastarter's database schema
# - Harbor API calls → supastarter's API routes
# - Astro pages → Next.js app router

# Deploy to own infra (Fly.io, Railway, or self-host)
```

**Estimated migration effort:** 2-3 weeks with agent assistance.

---

## Phase 3: White-Label Harbor (Agency Pivot)

**Goal:** Other agencies use Harbor under their brand.

### 3.1 Productization

| Package | Price | What it includes |
|---------|-------|------------------|
| **Harbor Starter** | $99/mo | Prospect Radar + Core 30 content generation |
| **Harbor Pro** | $249/mo | + Aftercall + GBP publishing |
| **Harbor Agency** | $499/mo | White-label + 10 client seats |

### 3.2 supastarter White-Label

supastarter Agency license includes:
- White-label rights
- Up to 10 developer seats
- Unlimited client projects

This means we can rebrand supastarter as "Harbor Platform" and sell it to other agencies.

---

## Cost Summary

| Phase | Trigger | One-time | Monthly |
|-------|----------|----------|---------|
| **0. Current** | Now | $0 | $0 |
| **1. Attribution** | $10k MRR | $0 (Talivia MIT) | $0 (self-host) |
| **2. Platform** | $25k MRR | $1,499 (supastarter) | ~$50 (hosting) |
| **3. White-label** | 10 agencies | $0 | ~$200 (infra) |

**Total investment to scale:** <$2k one-time + <$300/mo infra.

---

## Implementation Checklist

### Phase 1 (Revenue Attribution)

- [ ] Deploy Talivia self-hosted (Docker)
- [ ] Configure Stripe webhook for Talivia
- [ ] Add Talivia tracking script to codevex.app
- [ ] Set up revenue attribution dashboards
- [ ] Integrate `@talivia/agent` for agent-driven analytics config

### Phase 2 (Platform Migration)

- [ ] Purchase supastarter Agency license
- [ ] Clone and configure monorepo
- [ ] Port Convex schema → supastarter's ORM
- [ ] Migrate Harbor content pipeline
- [ ] Deploy to production
- [ ] Migrate existing clients

### Phase 3 (White-Label)

- [ ] Design Harbor Platform branding
- [ ] Create onboarding flow for agencies
- [ ] Set up multi-tenant billing
- [ ] Launch partner program

---

## Why This Plan Works

1. **Talivia is revenue-first:** Unlike Plausible/Umami, it tracks subscription revenue, not just page views
2. **supastarter is agent-first:** Built with AGENTS.md, same pattern I use
3. **Both are self-hostable:** No vendor lock-in, own the data
4. **One-time costs:** No SaaS subscription tax at scale
5. **Proven stack:** Both tools trusted by 1k+ founders

**The parabolic curve:** When revenue accelerates, infrastructure is already in place. No frantic replatforming — just graduate to the next tier.
