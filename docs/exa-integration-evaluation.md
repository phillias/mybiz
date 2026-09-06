# Exa API Integration Evaluation

**Date:** 2026-09-06
**Status:** Evaluation
**Recommendation:** Augment DataForSEO, not replace

## Executive Summary

Exa is a neural search engine (embeddings-based) optimized for AI agents. May augment DataForSEO for AEO-specific retrieval tasks but should NOT replace DataForSEO for SERP/Maps data.

## Pricing Summary

| Endpoint | Base Price | Notes |
|----------|-----------|-------|
| `/search` | $7 / 1k requests | Includes 10 results |
| `/answer` | $5 / 1k requests | Grounded answers |
| `/contents` | $1 / 1k pages | Page extraction |
| `type: "deep"` | $12 / 1k | Multi-step reasoning (4-15s) |
| `type: "deep-reasoning"` | $15 / 1k | Maximum reasoning (12-40s) |
| Agent API (fixed) | $0.012-$1.00 / request | Based on effort level |

**Free tier:** $20 credits/month (~2,800 searches)

## Technical Differentiators

| Feature | Exa | DataForSEO | Verdict |
|---------|-----|------------|---------|
| Neural search (embeddings) | ✓ | ✗ | Exa wins for entity/attribute retrieval |
| SERP data (rankings, snippets) | Limited | ✓ | DataForSEO essential for SEO metrics |
| Maps/Local pack | ✗ | ✓ | DataForSEO essential for local SEO |
| Category-specific indexes | ✓ (company, people, papers) | ✗ | Exa wins for entity research |
| Agent-optimized | ✓ | ✗ | Exa designed for LLM workflows |
| Token-efficient contents | ✓ (highlights 10x smaller) | ✗ | Exa wins for LLM context budget |

## Integration Points

### 1. Harbor Content Research (AEO-focused)

**Current:** Harbor uses its own research pipeline
**Proposed:** Use Exa `/search` with `category: "research paper"` for topic discovery

```javascript
// Example: Find AEO optimization research
const results = await exa.search("answer engine optimization strategies 2025", {
  type: "deep",
  category: "research paper",
  contents: { highlights: true },
  numResults: 10
});
```

**Cost:** ~$0.02 per article research query
**Benefit:** Access to 100M+ research papers not indexed by standard search

### 2. Prospect Radar Enrichment

**Current:** DataForSEO for SERP + Maps data
**Proposed:** Add Exa `/search` with `category: "company"` for entity enrichment

```javascript
// Enrich prospect with company data
const companyData = await exa.search(prospect.name + " " + prospect.city, {
  category: "company",
  contents: { text: { maxCharacters: 2000 } },
  numResults: 5
});
```

**Cost:** ~$0.01 per prospect
**Benefit:** Better entity resolution, parent company detection, tech stack signals

### 3. AEO Citation Measurement

**Current:** Uses OpenRouter/Perplexity APIs directly
**Proposed:** Use Exa `/answer` for grounded citation tracking

```javascript
// Check if site is cited for query
const answer = await exa.answer(prompt, {
  includeDomains: ["codevex.app"],
  useAutoprompt: true
});
```

**Cost:** ~$0.005 per query
**Benefit:** Direct citation extraction, no need to parse LLM output

### 4. Competitor Content Analysis

**Current:** Manual research
**Proposed:** Exa `/search` with `includeDomains` for specific competitor sites

```javascript
// Analyze competitor content on topic
const competitorContent = await exa.search(query, {
  includeDomains: ["competitor.com"],
  contents: { text: true },
  numResults: 20
});
```

**Cost:** ~$0.02 per competitor analysis
**Benefit:** Comprehensive coverage of competitor content

## Recommendations

### DO

1. **Integrate Exa for entity/attribute retrieval** — Use `category: "company"` and `category: "people"` for Prospect Radar enrichment
2. **Use Exa `/answer` for AEO measurement** — More reliable than parsing LLM outputs
3. **Use Exa `highlights` for LLM context** — 10x token reduction vs full text

### DO NOT

1. **Do NOT replace DataForSEO for SERP/Maps** — Exa lacks local pack data, SERP rankings
2. **Do NOT use Exa for keyword research** — DataForSEO's SERP API provides actual search volume, CPC
3. **Do NOT use Exa `deep-reasoning` in production** — 12-40s latency unsuitable for user-facing flows

### AUGMENTATION PATTERN

```
Prospect Radar:
  DataForSEO: SERP rankings, local pack, review counts
  Exa: Company entity data, tech stack, parent company

AEO Measurement:
  Current: OpenRouter (ChatGPT/Gemini) → parse output
  Proposed: Exa `/answer` → direct citations

Harbor Research:
  Current: Harbor internal research
  Proposed: Exa deep search for AEO topics + research papers
```

## Cost Estimate

| Use Case | Monthly Volume | Est. Cost |
|----------|---------------|-----------|
| Prospect enrichment | 500 prospects | $5 |
| AEO measurement | 50 queries × 12 prompts | $3 |
| Competitor analysis | 20 analyses | $0.40 |
| Topic research | 30 articles | $0.60 |
| **Total** | | **~$9/month** |

Free tier ($10/month) covers all use cases.

## Implementation Steps

1. Add `EXA_API_KEY` to `.env`
2. Install `exa-js` SDK: `npm install exa-js`
3. Create `src/lib/exa.ts` wrapper with error handling
4. Integrate into Prospect Radar enrichment (`scripts/prospect-score.mjs`)
5. Integrate into AEO measurement (`scripts/aeo-measure.mjs`)
6. Test with free tier credits before production

## References

- Exa Pricing: https://exa.ai/pricing
- Exa Search API: https://exa.ai/docs/reference/search-api-guide-for-coding-agents
- Exa MCP Setup: https://exa.ai/docs/reference/exa-mcp
