# Fit evaluation — JP Middleton's Niche Research Rubric for mybiz

Date: 2026-08-16 · Rubric artifact: `docs/jp-middleton-niche-research-rubric.md`

## TL;DR

**Not suitable as a drop-in gate for mybiz's U3 pipeline — different decision,
different unit of analysis. But 2 of its 4 criteria (growing market, monetization)
are genuinely missing or weak in our existing scoring, and its 1-10 scoring shape
would improve one strategic use case (client-vertical selection).** Verdict:
harvest the two missing dimensions; do not bolt the rubric itself into the
pipeline.

## What mybiz currently evaluates (the U3 gate)

mybiz's niche decision is the **SEO content topic gate**: pick a demand signal →
check the SERP → decide whether to spend a Harbor credit generating content. The
machinery, per `convex/schema.ts` and `convex/actions/checkNiche.ts`:

| Layer | Table | Fields | What it measures |
|---|---|---|---|
| Demand side | `demandSignal` | `buyerIntent`, `pain`, `urgency` (0-100), `providerVerdict` PROCEED/PIVOT/PAUSE | social proof of demand from MonetScope/Trendstr/manual |
| Competition side | `nicheScore` | `sponsoredCount`, `mapPack`, `longTailClusters`, `top10AuthorityMedian`, verdict PASS/FAIL/PENDING | deterministic SERP gate via DataForSEO |

Commit rule: `nicheScore.verdict === "PASS" && demandSignal.providerVerdict === "PROCEED"`.

## Why the fit is poor at the gate level

**1. Different unit of analysis.** Middleton scores *industries/verticals* (med
spa, dental, chiropractic) — a strategic "what will I build an agency around"
choice. mybiz scores *keyword niches* — an operational "is this topic winnable"
choice made hundreds of times per catalog. His criteria assume a one-time,
human-in-the-loop decision over a handful of candidates; ours runs continuously
over ~1,900 MonetScope entries with a cheap deterministic gate. A qualitative
LLM rubric at ingest volume would add cost and non-determinism to every run.

**2. Wrong gate shape.** His rubric is 4 pass/fail pillars with 1-10 scores and
no numeric composite decision (it produces ranked industries for a human to pick).
mybiz needs a binary, auditable, resumable verdict. `checkNiche` already returns
exactly that; his rubric would degrade it.

**3. Three of four thresholds are calibrated for a local-service agency, not a
content SaaS.** "TAM > 10,000 locations", "high-ticket $500+/transaction",
"physical, location-based" — these select for SMB verticals with ad budgets you
can sell into. mybiz (Harbor) is an AI SEO content workspace selling to agencies
and in-house teams; its content targets have no "locations" and no client-side
ticket. Inapplicable at face value.

## Criterion-by-criterion map

| Middleton pillar | mybiz equivalent | Coverage | Gap |
|---|---|---|---|
| Proven market (other agencies monetizing) | `demandSignal` social signals (Reddit/HN/X activity) | Weak | Social buzz ≠ "someone is profitably selling to this". No competitive-commercial signal in the gate. |
| Growing market | — | **None** | No trend/growth dimension anywhere. `urgency` measures timeliness of pain, not market direction. **Biggest gap.** |
| TAM > 10,000 | `longTailClusters >= 3` (keyword-breadth proxy) | Weak proxy | Breadth of related searches ≈ topic size, but no absolute demand scale (search volume, market size). |
| High ticket / monetization | `buyerIntent` (0-100) | Weak | Intent score is a demand proxy, not a monetization signal (no CPC / commercial-SERP ratio / affiliate potential). |
| Location-based | only relevant to mybiz's local brand work (cabins, prospect radar, GBP) | N/A | Not part of the core Harbor content path. |

## What it IS genuinely good for in mybiz

1. **Client-vertical selection for agency work.** The stack explicitly "also
   serves agency client work (SEO content sites, event marketing)" and Harbor is
   sold to agencies. If we ever pick a single productized vertical (e.g. "we sell
   Harbor-generated SEO to med-spa agencies"), Middleton's rubric is the correct
   one-time strategic filter — run it as-is (Claude deep-research, human picks),
   with his franchise twist (franchise networks → referral flywheel) for the
   sales motion.
2. **Two missing dimensions worth adopting into the pipeline** (this is the
   harvestable value):
   - **Growth/trend direction** → add e.g. `trendScore`/`growthDirection` to
     `demandSignal` (Google Trends slope, MonetScope trend fields, or SERP
     seasonality). This closes the clearest blind spot: nothing currently
     penalizes a shrinking topic.
   - **Explicit monetization** → add e.g. `commercialScore` to `nicheScore`
     (sponsored/ad presence is currently treated as a FAIL — but paid competition
     is also the strongest signal that a topic monetizes; the gate conflates
     "competitive" with "not monetizable").
3. **The 1-10 scoring shape** fits his brand but adds little to a pipeline that
   already has a binary gate; ignore unless we move to weighted scoring.

## Recommendation

- **Do not** add the rubric as a U3 gate or fold its criteria into `checkNiche`.
- **Do** harvest the two missing dimensions: a trend/growth signal on
  `demandSignal` and a monetization signal on `nicheScore` (decoupled from the
  sponsored-count fail rule).
- **Do** keep `docs/jp-middleton-niche-research-rubric.md` as a reference tool for
  the client-vertical use case (strategic, human-gated), not as pipeline logic.
