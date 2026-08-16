# SPIV Encodings for Otterly — Deferred Task

Status: **PREP DONE, PURCHASE DEFERRED** · Date: 2026-08-16
Owner: Harbor measurement
Reference: SPIV = Structured Persona-Intent Variables — https://neilpatel.com/blog/how-to-monitor-ai-search-visibility/ (Adam Balestone, 2026-06-19)
Task: not buying Otterly yet. When approved: create account → trial → Lite ($29/mo) → Standard ($189/mo, API+MCP) and paste these prompts. See strategy doc open item.

## 1. SPIV in one paragraph

Instead of generic category prompts ("plumber"), each tracking prompt is built from **4 structured variables** that give the model persona + intent context it would otherwise miss — turning stateless prompts into pseudo-stateful ones. The result is prompts you can actually act on, with **primary metrics** (visibility %, share of voice, mention frequency) and **secondary metrics** (Shannon entropy = field fragmentation, Gini = concentration/winner-takes-most, KL divergence = how far one platform's rankings drift from the group consensus, run length = stability over time).

## 2. The four variables (per prompt)

1. **Persona** — who is asking (occupation, urgency, budget).
2. **Scenario** — the situation/story that leads to the search (the "moment").
3. **Intent stage** — want-to-know / want-to-do / want-to-go / want-to-buy.
4. **Constraints** — must-haves (local, open now, specific attribute, price range).

## 3. Ready-to-paste prompts (Harbor/local-SEO angle)

P1 — local, want-to-go:
> Persona: a homeowner in [CITY] whose [SERVICE, e.g. water heater] failed. Scenario: cold shower at 6am, needs it fixed today. Intent: want-to-go. Constraints: local, responds fast, upfront pricing. Which [SERVICE] providers in [CITY] should they call, and why?

P2 — attribute-matching (the Caleb test):
> Persona: a homeowner comparing options for [SERVICE with attribute, e.g. "lead main drain line replacement"]. Scenario: buying a house and the inspector flagged it. Intent: want-to-buy. Constraints: certified, offers [attribute], honest about repair-vs-replace. Who in [CITY] handles [attribute] well?

P3 — trust/doubt moment:
> Persona: a customer burned by a bad previous contractor. Scenario: worried about being overcharged for [SERVICE]. Intent: want-to-know. Constraints: transparent pricing, not a hard sell, reviews mention [outcome]. What should they expect to pay in [CITY], and which providers are considered trustworthy?

## 4. Metrics to watch when wired
- **Visibility % + SoV** per prompt (P1-P3), per platform (ChatGPT, AIO, Gemini, Perplexity; AI Mode/Claude/Grok optional add-ons)
- **Secondary**: entropy (is the field fragmented?) + Gini (is one player dominant?) + KL divergence (does Gemini pick a different set than ChatGPT? — the "attribute" signal)
- **Run length / stability**: prompts tracked weekly, not once
- Cross-check against `scripts/prospect-score.mjs` reasons and The Aftercall review attributes

## 5. When approved
- [ ] Create Otterly account, trial → Lite → Standard (API + MCP for Convex/agent wiring)
- [ ] Add P1-P3 (spread 3-5 prompts × weekly runs)
- [ ] Wire results into the Core 30 strategy doc §2 review partition (citation presence per surface)
