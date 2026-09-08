# Backlog

Captured from the firstmate home backlog (`tasks-axi`, `repo: mybiz`) to travel with the
repo for cross-server handoff. Firstmate mirrors this file on `chezmoi apply`; when items
change on the dashboard, a sibling update re-renders this file.

| id | state | kind | priority | created | title |
|---|---|---|---|---|---|
| aeo-seo-eval | done | scout | - | 2026-09-03 | Evaluate discoveredlabs/awesome-aeo-seo for value to integrate into mybiz |
| aeo-llms-txt | done | feature | high | 2026-09-05 | Add llms.txt to codevex.app root for AI crawler guidance |
| aeo-answer-blocks | done | feature | high | 2026-09-05 | Implement 40-60 word answer blocks on Core 30 service pages |
| aeo-schema-enhance | done | feature | medium | 2026-09-05 | Add FAQPage + HowTo schema to Harbor-generated content |
| aeo-measurement | done | feature | medium | 2026-09-05 | Set up weekly AEO citation tracking (ChatGPT/Gemini/Perplexity/Exa) |
| aeo-exa-integrate | done | research | medium | 2026-09-05 | Evaluate Exa API integration to augment DataForSEO for AEO retrieval |
| prospect-radar | done | feature | high | 2026-08-16 | Lead-gen automation: rank local businesses by SEO opportunity score |
| core-30-gbp | in_dev | strategy | high | 2026-08-16 | Turn Caleb Ulku's Core 30 method into Harbor-ingestible content strategy |
| aftercall | in_dev | feature | high | 2026-08-16 | Harbor Voice — VAPI + Telnyx review outreach layer |
| research-signal-companion | in_dev | feature | medium | 2026-09-05 | Mine media consumption + AI sessions for publishable content (mybiz vs mybrain partition) |

---

## aeo-seo-eval — queued, scout (2026-09-03)

Evaluate https://github.com/discoveredlabs/awesome-aeo-seo for integration value into
mybiz's SEO surface. Assess what the AEO/SEO toolkit actually contains, overlap with
existing mybiz SEO surfaces, and integration fit vs. maintenance cost.

### 2026-09-05 Update

Evaluated. High value. Key findings:
- Protocol-level analysis of ChatGPT (RRF), Gemini (BatchExecute), AI Overviews (5-phase pipeline)
- Citation drivers: prompt-content alignment β=+0.37 dominant, domain authority SHAP 0.38 vs 0.06 page-level
- Open source tools: `geollm-eval`, `spider-py` directly usable
- `llms.txt` + markdown twin pattern — new to Harbor surface

---

## aeo-llms-txt — queued, feature (2026-09-05)

Add `llms.txt` file to codevex.app domain root. Plain-text table of contents for AI crawlers
pointing to best content. 10-min implementation, zero downside risk.

**Deliverables:**
- `public/llms.txt` with site description + links to key pages
- Include service pages, about, contact, key articles

---

## aeo-answer-blocks — queued, feature (2026-09-05)

Implement 40-60 word direct answer blocks on all Core 30 service pages. Place after H2,
before any context. Matches Caleb Ulku framing + Discovered Labs findings.

**Deliverables:**
- Update Harbor instructions/site settings to require answer blocks
- Retro-fit existing Core 30 pages
- Template for future pages

---

## aeo-schema-enhance — queued, feature (2026-09-05)

Add FAQPage and HowTo schema to Harbor-generated content. Pages with structured data
see up to 40% higher citation rates per Discovered Labs research.

**Deliverables:**
- Schema templates in Harbor content pipeline
- FAQPage on all service pages
- HowTo on procedural content

---

## aeo-measurement — queued, feature (2026-09-05)

Set up weekly AEO citation tracking. Define 10-15 target prompts, probe ChatGPT/Gemini/Perplexity
weekly, track citation rate and share of voice.

**Deliverables:**
- Prompt set definition (commercial intent for Harbor services)
- Weekly probe script or tool integration (consider LoudPixel, Otterly, or custom)
- Dashboard/report for citation trending

---

## aeo-exa-integrate — queued, research (2026-09-05)

Evaluate Exa API for integration with mybiz. Exa is neural search (embeddings) optimized
for AI agents. May augment DataForSEO for AEO-specific retrieval tasks.

**Scope:**
- API evaluation (latency, coverage, pricing)
- Integration points: Harbor content research, Prospect Radar enrichment, AEO measurement
- Augment DataForSEO, not replace — keep for SERP/Maps data

---

## prospect-radar — in development, feature (2026-08-16)

Lead-gen automation: rank local businesses by SEO opportunity score.

See `docs/plans/2026-08-16-004-prospect-radar-leadgen.md` for full spec.

---

## core-30-gbp — proposed, strategy (2026-08-16)

Core 30 method → Harbor-ingestible content strategy.

See `docs/plans/2026-08-16-001-core-30-gbp-strategy.md` for full spec.

---

## aftercall — proposed, feature (2026-08-16)

Harbor Voice — VAPI/Telnyx review outreach layer.

See `docs/plans/2026-08-16-002-vapi-review-outreach.md` for full spec.

---

## research-signal-companion — queued, feature (2026-09-05)

Mine media consumption and AI agent sessions for publishable content. Reuses the existing
Research Signal Companion browser extension from the mybrain profile
(`~/.local/share/last30days/library.db`) — do NOT rebuild it.

**Data sources:**
- Research Signal Companion: `~/.local/share/last30days/library.db` (1 doc, needs sync)
- Hermes sessions: `~/.hermes/profiles/*/state.db` (540 sessions, 2,171 msgs in mybrain alone)
- OpenCode sessions: `~/.local/share/opencode/opencode.db` (914 sessions, 39,526 msgs)
- mybrain brain.db: `~/mybrain/data/brain.db` (1,290 tasks, 26 domains)
- Pi agent: TBD (not found on this server)

**Partitioning:**
- mybiz (commercial): SEO, lead-gen, Harbor features, client work → codevex.app blog, LinkedIn
- mybrain (professional): AI tools, dev workflows, homelab, security → personal blog, Twitter/X
- private: family, health, finance → journal only

**Deliverables:**
- Extractor scripts (Hermes, OpenCode, Companion, mybrain)
- LLM classifier for domain + sensitivity
- Partition router (mybiz vs mybrain vs private)
- Content generator (transforms extracts into draft posts/articles)
