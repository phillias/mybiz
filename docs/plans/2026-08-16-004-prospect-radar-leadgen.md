# Lead-Gen Automation — "Prospect Radar" (SEO-opportunity scoring)

Status: in development · Date: 2026-08-16 · Owner: Harbor product / agency acquisition
Reference: tool.rankexpand.com = "Niche Validator" (niche+city → 0-100 score from live Google data). We build the prospect-side analogue: **rank local businesses by SEO opportunity**, not niches.
Feeds: `DATAFORSEO_API_KEY` (already on Convex prod) · `convex/nicheScoreWrite.ts` signals · repo scripts conventions (`harvest-ideas.mjs`)

## 1. Goal

A repeatable pipeline that takes (category, city, radius) and returns a **ranked prospect list** — businesses with the highest SEO opportunity score — ready for outreach (voice/SMS via Telnyx, or email). No off-the-shelf SaaS does this with live data; nearest are lead-capture widgets (Local Falcon) or list tools (Apollo/Clay) without scoring.

## 2. Scoring model

`opportunity = f(weakness, demand, competition)` — a business is a strong prospect when it *wants* local customers but is *losing* them:

| Signal | Data source | Direction |
|---|---|---|
| No website / thin site | Website crawl (page count, word count, title/meta) | No site = highest intent; thin = strong |
| Page speed | PageSpeed Insights API (free) | Slow = opportunity |
| Review deficit | DataForSEO Maps/Business data (review count, rating, recency) | Few/recent-starved = opportunity |
| Map-pack presence for money keyword | DataForSEO live SERP (reuse `nicheScore` gate signals: sponsoredCount, mapPack, top10AuthorityMedian, longTailClusters) | Not in pack for their own keyword = opportunity |
| Authority gap | referring domains proxy (optional; skip if API cost outweighs) | Low authority = opportunity |

Weighted 0-100. "No website" and "not in map pack for own money term" dominate.

## 3. Pipeline stages

1. **Discovery** — DataForSEO Google Business Data (Maps) API: pull businesses by category+city, capture name, address, phone, website, review count, rating, business_status.
2. **Feature extraction** — for each prospect: crawl website (meta, page count, word count), PageSpeed Insights scores, review recency.
3. **SERP gate** — for the business's money keyword (top service + city): reuse the existing `checkNiche` pattern (sponsoredCount, mapPack, top10AuthorityMedian) via DataForSEO.
4. **Score + rank** — weighted opportunity score; cluster by category.
5. **Export** — TSV/JSON ranked list with enrichment hooks (phone for Telnyx voice/SMS; email placeholder for Apollo/Clay enrichment).

## 4. Deliverables (dev scope)

- `scripts/prospect-score.mjs` — CLI:
  - `--city <city> --category <category> --limit N` → discovery + scoring
  - `--apply` to spend DataForSEO credits (default dry-run, mirrors `harvest-ideas.mjs`/`generate-core30.mjs`)
  - outputs `content/prospects/<city>-<category>.tsv` + `.json`
- Reuse `nicheScoreWrite.ts` gate logic where possible (extract shared scoring into `scripts/lib/scoring.mjs` if clean)
- Config in `.env`: `DATAFORSEO_API_KEY` (base64 `email:password`), optional `PROSPECT_OUT_DIR`
- Conventions: plain ESM, `node:` imports, minimal deps (no new packages unless necessary), usage header comment, dry-run by default

## 5. Guardrails
- Default dry-run; credits only on `--apply`
- Respect DataForSEO rate limits; batch politely
- No PII writes to git — prospects live under `content/prospects/` (add to `.gitignore` if sensitive)
- No outreach automation in this scope (that's The Aftercall / later)

## 6. Success criteria
- `--dry-run` on a real city+category prints a scored, ranked prospect list with no API spend
- `--apply` on 1 category returns ≥20 scored prospects
- Scores separate "no website" businesses from "already winning" ones clearly
