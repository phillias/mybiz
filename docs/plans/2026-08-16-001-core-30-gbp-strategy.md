# Core 30 GBP Strategy — Harbor-Ingestible

Status: in_dev · Date: 2026-08-16 · Source: Caleb Ulku (Core 30 method, themarketingshow.com/seo/core-30-local-seo-method) + AI-citation reaction video (WZrSlgdm5GQ)
Owner: Harbor product + agency client work
Consumes: `convex/pageBlueprint` schema · Harbor API (`POST /v1/articles`) · `scripts/generate-article.mjs`
Goal: turn the Core 30 method into a repeatable content generation strategy that Harbor can ingest and that partitions by review surface.

---

## 1. Method recap (what we're encoding)

Caleb Ulku's Core 30 for local service businesses (plumbers, roofers, med-spas — the "I want to go" moment):

1. **GBP-first mindset** — the website exists to make the Google Business Profile rank; ~60-70% of local clicks go to the map pack.
2. **Profile completeness** — every GBP box filled (750-char description, services with descriptions, Q&A seeded, attributes checked, special hours).
3. **Categories/services mirror** — 3-5 GBP categories (of 10 allowed), 20-30 services with descriptions; the website mirrors them exactly.
4. **~30-page content hierarchy** — homepage → category pages (50-70 words per category + link) → service pages (1,000+ words). Target format `[service] + [city]` per service page, `[category] + [city]` per category page.
5. **Activity signals** — ≥1 geo-tagged GBP post/week; 20-30 photos; review responses in 24-48h.
6. **Attribute matching (the AI layer)** — content + reviews must carry the exact attributes AI queries use ("lead main drain line replacement", not just "drain line replacement"). Answer-first writing, verbatim question headings, real FAQ sections.
7. **Review recency > volume** — direct-link requests, rotating platforms.

## 2. Review-surface partition (required: strategy is partitioned per review site)

Every surface gets its own content asset, attribute targets, and KPI. Generated content is drafted once, then adapted per surface.

| Review surface | Why it matters for AI | Content/asset to generate | Attribute targets | KPI |
|---|---|---|---|---|
| **Google / GBP** | Entity heart; Ask Maps (Gemini) attribute matching; map pack + AI Overviews | Services w/ descriptions, Q&A seeding, weekly posts, response cadence, page content mirroring categories | Service names, "what happened/outcome", locality | Map-pack rank, GBP review velocity, SoLV |
| **Yelp** | Gemini reads off-GBP reviews; rotating solicitation target | Review-request framing; business description matching NAP + services | Outcome language, service entities | Review velocity (rotated), attribute hit-rate |
| **Angi (Angie's)** | Home-services reviews; Gemini sources it | Same as Yelp, service-line specific | Job type + outcome, service area | Review velocity, mentions of services |
| **Bing Places** | ChatGPT sources Bing for Business; mirror GBP | Full GBP copy mirrored to Bing (one-time sync) | NAP consistency, categories | Presence + rating parity |
| **Apple Maps / Business Connect** | Apple Maps ranking + ratings (Local Falcon tracks it) | Business Connect profile, photo set | NAP, categories | Rating + photo counts |
| **Facebook** | Social proof, minor AI citation | Post cadence, review link | Brand terms | Review count, response rate |
| **Trustpilot / G2 / Capterra** | B2B/SaaS citation layer; AI leans on them for software/tooling | Profile completion, review-request flow for B2B customers | Category terms, use-case language | Citation presence in AI answers |
| **Reddit** | Persistent AI source (declining but real); mention monitoring | Genuine participation only — no astroturf; monitor via Ahrefs Brand Radar | Natural mention of service + place | Mention share in AI answers |
| **Roundups / digital PR** | The AI "source layer" (Foglift benchmark: vendor sites, roundups, reviewer blogs) | List placements, "best [service] in [city]" roundups | Named comparison terms | Citation count in AI answers |

Rule: **one strategy, per-surface assets.** A single Core 30 content build feeds: site service pages (Harbor), GBP services/Q&A/posts, and review-request framing per platform.

## 3. Harbor ingestion mapping

### 3a. Harbor site settings (per client site)
- `instructions` (Harbor site field) — carry the Core 30 brief verbatim: "Mirror the client's GBP categories and services. Lead with the answer. Use the exact service entity + city in the first paragraph. Include attribute-specific language (e.g. 'tankless water heater', 'lead main drain line'). Write plain-language questions as headings. End with one concrete next step."
- `tone_of_voice: "copy"`, `content_type: "Best for articles"`, `words_to_avoid` per client.
- `keywords`: the full category + service entity list from the GBP (drives research + stat cards).

### 3b. `pageBlueprint` rows (Convex — the site-structure ingest)
Every Core 30 page becomes a row; generation reads blueprints, not ad-hoc keywords:

| archetype | template | intent | schemaType | internalLinks (hub-and-spoke) |
|---|---|---|---|---|
| `core` (homepage) | core | local | `LocalBusiness` | → all category pages |
| `service` (per GBP service) | service | transactional/local | `Service` | → sibling services + category |
| `location` (per city served) | location | local | `LocalBusiness` + `GeoCoordinates` | → core + services |
| `supporting` (trust content) | supporting | informational | `FAQPage`/`Article` | → service pages |

Required fields: `keywordCluster` = `[service] + [city]`, `locationData.city/region/serviceArea` (drives templating), `slug` (`[service]-[city]`).

### 3c. Generation runbook (Harbor API per page)
1. Read `pageBlueprint` rows for the client (Convex query).
2. Per service page: `POST /v1/articles` with `site_id` + `keywords: "[service] [city]"`, `content_mode: "freeform"`, `instructions` = Core 30 brief + answer-first + FAQ requirement. → raw HTML → Convex → render via Astro (existing pipeline).
3. Per supporting page: question-cluster briefs (from AnswerThePublic/AlsoAsked/QuestionDB pulls — see §5) targeting 3 moments (want-to-know, want-to-do, trust).
4. GBP-native assets (posts, Q&A, service descriptions, review replies) are NOT Harbor outputs — see §4.

## 4. Is Harbor suited for GBP content creation?

**Partial — and the split matters:**

- ✅ **The website side (the actual Core 30)**: Harbor is well suited. It generates full SEO service pages/articles in `freeform` mode with answer-first + attribute instructions, and `pageBlueprint` already models the hub-and-spoke hierarchy. This is the 80% of the method.
- ⚠️ **GBP-in-profile content**: Harbor returns web HTML, not GBP-native fields. GBP posts are short image+text (~1,500 chars), service listings are one-liners, Q&A is conversational, review replies are compliance-sensitive. Harbor can *draft* these (freeform), but they must be adapted + published via the **GBP API** (first-party; Caleb's own recommendation) or an agent flow — no native GBP write in the Harbor MCP.
- ❌ **Review-request framing**: out of scope for Harbor entirely — that's the T5 voice/SMS layer (see `docs/plans/2026-08-16-002-vapi-review-outreach.md`).

**Verdict:** Harbor = the Core 30 *site* engine. Add a thin Convex "GBP adapter" action (GBP API) to carry drafted content into the profile and the stack covers the whole method.

## 5. Free-tool quiver (moment research feeding the runbook)

Local Falcon is deliberately **not** used (dumped after pricing/capability review; GMB Radar covers free rank-map checks). Every tool below runs on its free tier inside this strategy; the paid tier is the uplift when volume demands it. Prices are approximate (Aug 2026), validate before buying.

| Tool | Free tier (kept) | Paid uplift — what you unlock | Uplift price (approx) |
|---|---|---|---|
| AnswerThePublic | 3 searches/day | Unlimited searches, CSV export, +90 keywords/search | Individual ~$9/mo · Pro ~$99/mo |
| AlsoAsked | 3 searches/day | Unlimited searches, download/export, white-label | Individual ~$11/mo · Pro ~$88/mo |
| QuestionDB | Unlimited, no signup | Open source / donation — no paid tier | $0 |
| keywordtool.io | 750+ suggestions/search (volume locked) | Search volume, competition, CPC, Google autocomplete data | Pro ~$89/mo |
| UberSuggest | ~3 keyword lookups/day + free SEO/AI analyzer + AI-visibility glance | Full keyword DB, daily rank tracking, AI Search Visibility prompt caps raise | Individual ~$12-29/mo |
| GMB Radar | 300 credits/mo, white-label included | Credit packs for more scans (rank-map spot checks) | Small credit packs |

Free tier does the job for strategy; upgrade only when a client cadence exceeds the caps. The one near-term paid buy is Otterly (AI-citation tracking) — see Open items (§6).

## 6. Open items
- [x] Build `pageBlueprint` → Harbor generation script — **DONE** `scripts/generate-core30.mjs` (+ `content/blueprints/core30-sample.json`); dry-run by default, `--apply` spends credits
- [ ] Decide Harbor site-per-client provisioning (one Harbor site per client vs shared site + per-page instructions) — **the remaining structural decision; pageBlueprint schema has no client/site field yet**
- [x] Add `pageBlueprints:list` Convex query — **DONE** `convex/pageBlueprints.ts` (`list`/`bySlug`/`stats`, indexes `by_slug`+`by_archetype`); deployed to the local dev backend, table seeded via `npx convex run seed` (19 rows: 8 core / 2 service / 9 supporting); `generate-core30.mjs --convex --dry-run` verified end-to-end
- [x] Evaluate GBP API adapter for posts/services/Q&A/review-reply publishing — **DONE** `src/lib/gbp.ts` (posts, reviews+replies, Q&A, services read, insights, OAuth helpers) + `scripts/publish-core30-gbp.mjs` wrapper (`--dry-run` default, `--from-blueprint` file or `--convex` via `pageBlueprints:list`). Finding: **services cannot be created via the GBP API v4** (dashboard/bulk-upload only — noted in `gbp.ts`); posts/Q&A/review-replies are API-writable. Remaining operational step: real GBP OAuth token (`GBP_ACCESS_TOKEN` with `business.manage` scope) + one live verified run — untested against a real account.
- [ ] **Otterly (deferred task)**: prep SPIV prompt encoding now (see `docs/plans/2026-08-16-003-spiv-otterly-prep.md`); purchase + wire Lite→Standard (API/MCP) when approved
- [ ] Rank maps: Local Falcon dumped → use **GMB Radar** free tier now; revisit BrightLocal only if a client cadence demands grid-rank reporting
- [ ] The Aftercall (review-request layer) per `docs/plans/2026-08-16-002-vapi-review-outreach.md`
