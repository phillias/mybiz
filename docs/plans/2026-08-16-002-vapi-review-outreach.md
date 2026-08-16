# Harbor Voice — "The Aftercall" (VAPI/Telnyx review outreach)

Status: proposed · Date: 2026-08-16 · Owner: Harbor product
Feeds: `convex/conversations` schema · Telnyx messaging profile → `moonlit-spider-468.convex.site/telnyx-webhook` · toll-free +1-877-445-5580
Goal: a branded, compliant voice-AI outreach layer that captures **attributes and moments** in customer reviews and rotates the review link across platforms — the T5 gap in the AI-citation playbook.

---

## 1. Brand

**Product line: Harbor Voice** — voice + SMS outreach that turns post-service moments into citable reviews.

**Flagship program: "The Aftercall"** — the 30-second call after the job that captures the story before it cools.

- Positioning: *Every job has a story. We capture it where the review lives.*
- Tagline: "The outcome, in their words — on the platforms AI reads."
- Voice: warm, outcome-focused, zero hype (matches Harbor's house instructions: honest, conversational, specific).
- Alternatives considered: MomentLine, OutcomePoint, PingBack, AfterGlow — Aftercall chosen for the literal job-to-call moment it names.

## 2. Strategy

Core mechanic (from Caleb Ulku's framing): ask generally, capture specificity.
"Would you mind talking about what happened and what the outcome was?" → attributes get written naturally; **rotating review links** so Gemini (and the AI citation layer) reads reviews across Google, Yelp, Angi — not GBP alone.

1. **Trigger**: service job closed (CRM/webhook/field-service event) → Convex schedules an Aftercall within 24-48h (review recency window).
2. **Voice call** (Telnyx AI Assistant on our toll-free number): warm-up → confirm the experience → Caleb framing ("what happened, what was the outcome") → capture objection handling (no pressure) → get consent to send the review link.
3. **SMS delivery**: agent fires the link via Telnyx's native `send_message` tool (voice-agent SMS, no glue) — a **direct review link**, rotating across GBP → Yelp → Angi per a rotation policy (spread attributes across surfaces; respect per-platform ask limits).
4. **Follow-up**: one polite SMS nudge if no review in 48h (respects STOP/opt-out via `conversations.optedOut`).
5. **Capture**: review text + call transcript → Convex → attribute mining (service entities, outcome language, locality) → feeds the Core 30 strategy (`docs/plans/2026-08-16-001-core-30-gbp-strategy.md`) and AI-citation tracking.

## 3. Architecture (stack-native, two options)

| | **Option A: Telnyx-native (v1 — RECOMMENDED)** | Option B: Vapi + Telnyx number |
|---|---|---|
| Voice agent | Telnyx AI Assistants (already in stack; `send_message` tool ships SMS natively; one-click Vapi import if we change later) | Vapi assistant on our Telnyx number (better voice/SSML polish, outbound campaign batching) |
| Telephony | Owned toll-free +1-877-445-5580 + messaging profile → Convex webhook (already wired) | Same Telnyx number via Vapi provider |
| Glue | None for SMS (native tool); Convex trigger + webhook | Convex trigger → Vapi API → webhook back |
| Cost | Telnyx voice minutes + SMS (we already pay Telnyx) | Vapi per-minute + SMS via Telnyx |
| Why | Zero new vendor, uses what we own, fastest to a v1 | Upgrade path if voice quality/scale demands it |

Decision: **v1 = Option A**. Keep the agent prompt + rotation policy portable so a Vapi migration is a config swap.

## 4. Compliance guardrails (design-in, not after)

1. **TCPA/CTIA consent** — review solicitation is marketing-grade messaging: prior express consent required. The toll-free verification (request `e89288f0-ed15-5705-ad1e-f90e34f082d4`) was **approved 2026-08-13** with use case "Conversational / Alerts" (transactional). Confirm this covers review solicitation or **re-file/add the review-solicitation use case** before any campaign. STOP handling already enforced in `conversations.optedOut`.
2. **Google review policy** — no incentives, no gating to happy customers, no request for specific services/reviewers. Keep the general framing; never coach content.
3. **Voice is a prompt, not an author** — the customer types the review. Never transcribe-and-post; the agent only frames the narrative and sends the link.
4. **Per-platform ask limits** — rotate links to avoid platform-level solicitation fatigue (e.g. not every job → Yelp).

## 5. Economics vs the market

| | Podium | Birdeye | NiceJob | **Harbor Voice (build)** |
|---|---|---|---|---|
| Entry | $399+/mo + $500 setup | $299+/loc/mo, annual | $75/mo | Telnyx minutes + SMS (already owned infra) |
| Voice AI | No (SMS/webchat) | No | No | Yes (the differentiator) |
| Review-link rotation | No | No | Limited | Yes (GBP/Yelp/Angi) |
| Attribute capture | No | No | No | Yes (outcome framing + mining) |

The market's voice-less, per-location SaaS is exactly what a built feature undercuts. SMS-only review requests convert ~15-25%; a conversational warm-up is expected to lift both completion and attribute-richness (to be measured).

## 6. Milestones

- [ ] Re-file toll-free verification use case (or confirm current one covers review solicitation)
- [x] Design agent prompt: warm-up → Caleb framing → consent → link rotation; store prompt set in repo (`convex/` + Telnyx portal) — `AFTERCALL_PROMPT` in `convex/aftercall.ts`, paste into Telnyx AI Assistant config
- [x] Convex trigger action: job-closed event → schedule Aftercall (respect window + opt-outs) — `scheduleAftercall` (mutation, opted-out guard + rotation slot) → `startOutboundCall` (action, POST `/v2/calls`, dry-run safe)
- [x] Wire `send_message` SMS delivery with rotating direct-review link — `REVIEW_LINK_TEMPLATES` (google/yelp/angi builders) + rotation scaffolding; portal-side `send_message` tool config still to do
- [x] Review-text ingestion + attribute-mining query on `conversations` — `captureReviewEvent` (internal mutation) + `attributeMine` (regex v0 extractor; LLM scoring TODO)
- [ ] Pilot on a real client (consent-checked list of recent customers), measure: completion rate, review velocity, attribute hit-rate, per-platform spread

## 7. Metrics (post-pilot)
Completion rate · review velocity (recency) · attribute hit-rate (service entities + outcome language in review text) · platform spread (GBP/Yelp/Angi share) · opt-out rate · AI-citation lift (via Otterly/Ahrefs tracking) · map-pack movement (Local Falcon/BrightLocal)
