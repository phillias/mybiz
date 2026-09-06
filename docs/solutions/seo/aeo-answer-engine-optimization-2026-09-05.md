---
title: AEO/Answer Engine Optimization — Key Findings 2026
date: 2026-09-05
problem_type: knowledge
category: seo
tags: [aeo, geo, answer-engine, seo, chatgpt, gemini, perplexity]
module: mybiz/seo
scope: codevex.app
last_updated: 2026-09-05
---

# AEO/Answer Engine Optimization — Key Findings 2026

## Context

Evaluated [awesome-aeo-seo](https://github.com/discoveredlabs/awesome-aeo-seo) for integration into the mybiz SEO surface. Answer Engine Optimization (AEO) is the practice of optimizing content for AI answer engines (ChatGPT, Gemini, Perplexity, AI Overviews) rather than just traditional search.

## Key Findings

### 1. Protocol-Level Understanding

| Engine | Retrieval Pattern | Key Signal |
|--------|-------------------|------------|
| **ChatGPT** | Reciprocal Rank Fusion (RRF) | Prompt-content alignment β=+0.37 |
| **Gemini** | BatchExecute RPC (227 calls/session) | Entity consistency |
| **AI Overviews** | 5-phase pipeline | Passage-level scoring, independent of organic rank |

The dominant citation driver is **prompt-content alignment** (β=+0.37), not traditional domain authority (SHAP 0.38 vs 0.06 for page-level features).

### 2. Content Engineering Patterns

| Pattern | Description | Impact |
|---------|-------------|--------|
| **Answer blocks** | 40-60 word direct answers after H2s | Matches RRF retrieval windows |
| **FAQ schema** | Verbatim question headings | Higher citation rate |
| **HowTo schema** | Explicit step entries | 40% higher citation per Discovered Labs |
| **Entity consistency** | Same name across all mentions | Prevents disambiguation failures |
| **llms.txt** | Machine-readable ToC at domain root | Zero downside, 10-min implementation |

### 3. Open Source Tools

- `geollm-eval` — Citation rate measurement
- `spider-py` — Web crawler for AEO content
- `site-one crawler` — Alternative crawler

### 4. Exa Search Engine

Exa is a neural search engine (embeddings) optimized for AI agents:
- May 2026: Integrated with Google Gemini as agent-first search provider
- $85M Series B, $700M valuation
- Key differentiator: indexes entities/attributes, not keywords
- **Augment DataForSEO, not replace** — DataForSEO for SERP/Maps, Exa for AEO retrieval

## Applied to mybiz

| Item | Status | Notes |
|------|--------|-------|
| `llms.txt` | Already exists at `/public/llms.txt` | Updated with AEO guidance |
| Answer blocks | Documented in llms.txt | Harbor integration pending |
| HowTo schema | Added to `schema.ts` | `howToSchema()` function ready |
| FAQPage schema | Already in place | Articles carry FAQ JSON-LD |
| Entity consistency | Documented | "Phileas" + "Phileas Fogg" consistently |
| Exa integration | Queued | Backlog item `aeo-exa-integrate` |

## Prevention Rules

1. **Never optimize for traditional SEO at the expense of answer-engine clarity** — keyword stuffing that harms prompt-content alignment will reduce citations.
2. **Always include 40-60 word answer blocks** after H2s in service/landing pages — this matches the retrieval window for RRF systems.
3. **Always use HowTo schema for procedural content** — 40% citation boost is non-trivial.
4. **Never use alternate entity names** — stick to "Phileas" or "Phileas Fogg" consistently.
5. **Always measure AEO citations weekly** — fixed prompts, trending share of voice.

## References

- [awesome-aeo-seo](https://github.com/discoveredlabs/awesome-aeo-seo)
- Discovered Labs 2M prompt dataset analysis
- Stripe "Head of AEO & SEO" job posting (Sep 2026)
