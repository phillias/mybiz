# JP Middleton — Niche Research Rubric (reconstructed)

> **Provenance & fidelity.** This rubric belongs to JP Middleton (GymMembersNow /
> StartGrowSell.AI, "$25M AI agency" content). He demonstrates it in two public
> breakdowns — the YouTube video *"My Boring AI Business Makes $3.5M/Year"*
> (https://www.youtube.com/watch?v=KUG8ASNCOTI, ~20:00) and the Modern Creator
> episode *"$25M AI Expert Explains: How to Start a 1 Person Business Using Claude
> in 7 Days"* (https://moderncreator.app/2026-05-28-jp-middleton-25m-ai-expert-explains-how-to-start-a-1-person-business-using-claude-in-7-days).
> The actual doc + prompt are distributed by DM/comment (engagement-gated), so the
> full text is NOT public. Everything below is reconstructed from what he shows and
> reads on screen across those sources. The four pillars are stated consistently;
> the 1-10 scoring scale and the prompt text are inferred from his described usage
> and his "rates niches on a scale of 1-10" LinkedIn posts. Treat the exact wording
> as a faithful reconstruction, not a verbatim copy.

## Purpose

Pick **one client vertical for a local-marketing AI agency** — the industry you
will sell AI services to (med spas, dental, chiropractors, gyms, HVAC…). The
rubric is the scoring document; a Claude deep-research prompt is the researcher.
Feed both to Claude, it scours the web and returns ranked industries with the
evidence for each pillar.

## The rubric

Four pillars. A candidate vertical must clear all four. Each pillar is scored
1-10; a vertical is a serious candidate at 30+/40 with no single pillar below 6.

### Pillar 1 — Proven market (proof of concept)

Other agencies are **already making a lot of money** serving this industry.

| Score | Signal |
|---|---|
| 8-10 | Multiple established agencies with many reviews/case studies; products exist for it |
| 5-7 | A few credible agencies; some case studies |
| 1-4 | Nobody visible is selling to them — likely unproven, not an opportunity |

*Rationale: "don't reinvent the wheel" — proven demand plus proven willingness to
pay means product-market fit already exists.*

### Pillar 2 — Growing market

The market is **expanding** — not shrinking, not stagnant.

| Score | Signal |
|---|---|
| 8-10 | Clear multi-year growth trend (industry revenue, location count, consumer spend) |
| 5-7 | Flat-but-stable; growing in segments |
| 1-4 | Declining or structurally shrinking |

*Rationale: a shrinking market fights you the whole way; growth does the selling.*

### Pillar 3 — Total addressable market > 10,000

At least **10,000+ potential customers** (locations/businesses) in the target
country.

| Score | Signal |
|---|---|
| 8-10 | 10,000+ locations, ideally franchiseable (franchise networks multiply referrals) |
| 5-7 | 3,000-10,000 |
| 1-4 | Under 3,000 — too small to build a scalable agency on |

*Rationale: enough surface area for a repeatable, non-saturated book of business.
Franchises matter here because happy franchisees refer each other (non-competing
markets).*

### Pillar 4 — High ticket

Each customer pays a lot — **$500+ per transaction or $100+/month recurring**.
Often paired with *physical, location-based* businesses.

| Score | Signal |
|---|---|
| 8-10 | Services priced $500+ (or $1k+/mo retainers); location-based with a local ad budget |
| 5-7 | $200-500 transactions; moderate monthly spend |
| 1-4 | Low price point, thin margins — ad budgets too small to monetize |

*Rationale: the agency's margin is a function of the client's spend; high-ticket
industries have budget for marketing and can afford you.*

## Reconstructed Claude research prompt

```text
You are a market research specialist for an AI marketing agency. I'm choosing
ONE industry to serve as a specialized local-business agency. Run deep research
on the three industries that best fit my situation below and rank them.

MY SITUATION:
[insert: skills, capital, geography, network, any preference]

For each candidate industry, research and report on the four rubric pillars:

1. PROVEN MARKET — Which agencies already make significant money serving this
   industry? Name them and cite their evidence (reviews, case studies, scale).
2. GROWING MARKET — Is the market growing? Cite industry revenue, location-count,
   or consumer-spend trend data. Flag any shrinking or stagnant signal.
3. TAM — How many locations/businesses exist in this industry in my country?
   Is it above 10,000? Does the industry have franchise networks?
4. HIGH TICKET — What does the average customer charge/earn? What do they spend
   monthly on marketing? Does it clear $500+ per transaction or $100+/month
   recurring?

Use the attached rubric document as your scoring authority. Return:
- A ranked shortlist of 3 industries
- Per industry: a table of the four pillars with a 1-10 score and the cited
  evidence for each
- A one-line verdict for each: PASS or FAIL, and why
- Your #1 recommendation with the reasoning
```

Usage (per his demo): drop in the rubric doc, paste your situation, run as a
Claude deep-research (web-connected) prompt, pick the #1 vertical, then run his
"choose your ship" franchise-research prompt (day 2) to find the franchise
networks inside that vertical.

## What this is NOT

- Not a keyword/SERP tool — it scores industries, not topics.
- Not a pipeline gate — it's a one-time, human-in-the-loop strategy filter run
  by a person choosing what to build a business around.
- Its thresholds (10k locations, $500 ticket, location-based) are calibrated for
  **selling local services to SMBs**, not for content/SaaS opportunity scoring.
