# GovCon Brand — Plan for a Government Contracting Venture in the mybiz Constellation

Created: 2026-08-15

## 1. Problem frame

A new brand within the mybiz constellation that pursues U.S. government contracting — starting with the
low-barrier **xTech prize competitions** and maturing into **SBIR/STTR Phase I/II** awards — by exploiting
the constellation's existing **AI-native muscle** (the Harbor/agent stack) plus a cheap **AI-CAD → outsourced
manufacturing** pipeline. Goal: land the first non-dilutive federal dollars within ~12 months, with a
reusable manufacturing prototype infrastructure that also has standalone commercial value.

Decisions locked in (user-gated, 2026-08-15):

| Question | Decision |
|---|---|
| Entity posture | **New standalone LLC** (must be set up — guidance below) |
| Entry strategy | **Low-barrier first: xTech + prize competitions**, then SBIR/STTR Phase I |
| Manufacturing geography | **US-first for security**, cheap offshore for non-critical prototypes |
| AI CAD budget posture | Free/low-cost first (Zoo free tier + OpenSCAD/LLM + CADAgent) |

## 2. The brand

- **New LLC** with its own EIN + business bank account, dedicated to govcon. Protects the Harbor/phillias.us
  constellation from federal contracting exposure (CMMC, FAR reps & certs, export-control obligations).
- **Positioning**: "AI-native rapid capability delivery for the DoD" — win on speed and software/design
  automation, not on manufacturing capacity (which is outsourced).
- **Domain/brand identity — decision point (options)**:
  1. Own subdomain of `phillias.us` (e.g. `gov.phillias.us` or a named subdomain) — cheap, reuses the Astro→Pages stack, no new cert burden.
  2. A new dedicated `.com` for the govcon brand — cleaner separation, more brand credibility with DoD evaluators; ~$10/yr + another Cloudflare Pages project.
  - Recommendation: **option 2** — a dedicated brand name + domain. xTech/SBIR evaluators read the
    company site; a distinct brand reads as a real company, and the "2/3 of work performed by the SBC"
    rule means the govcon entity must stand on its own. Ship a minimal Astro site (reuse this repo's
    stack + design tokens, Impeccable-gated) with: capabilities statement, team, past performance,
    contact. `sitemap.xml` + `robots.txt` required before registering the site anywhere (same rule as
    the Harbor registration gotcha).
- **Reuse the constellation**: Harbor content pipeline can generate SEO credibility content for the
  brand site; Telnyx voice/SMS + Clerk/Convex can back a simple contact/lead flow if ever needed.

## 3. Scour the websites (the landscape from the transcript)

The transcript names these venues. Current state + what each is for:

| Site | What it is | Value to this brand | Priority |
|---|---|---|---|
| **xtech.army.mil** | Army prize competitions (white paper + video, cash + follow-on contracts) | **Primary entry point.** Open now: **G-TEAD USARPAC ACE 27-01: Autonomous Sustainment**; coming fall: **xTech|Search 10** (flagship open-topic, 10th iteration); active: Kinetic Reach, Adaptive Strike, Apex Intercept | 🔴 Now |
| **sbir.gov** | SBIR/STTR program hub + **SBA Company Registry** (issues the **SBC Control ID**) | Required registration; topic browsing + funding planner calendar | 🔴 Week 2-6 |
| **defensesbirsttr.mil (DSIP)** | DoD SBIR/STTR Innovation Portal — proposal submission, topics, **TPOC contact during pre-release** | Where DoD proposals actually go. FY26 Release 5 topics open **Aug 26** (Navy wearable MR C2 topic due **Sep 23**) | 🔴 Register + browse |
| **afwerx.com** | Air Force SBIR/STTR + SBT (Strategic Breakthrough, up to $30M w/ 1:1 match) | Follow-on lane after Army xTech wins; Dual-use | 🟡 Later |
| **SOFWERX** (USSOCOM) | SOF innovation hub; Tech Tuesdays 3-min pitches | Low-effort relationship + visibility | 🟡 Later |
| **VULCAN** | DoD platform for networked discovery/assessment of industry capabilities | Creates a discoverable capability profile for contracting officers to find you | 🟡 Later |
| **diu.mil (DIU)** | Defense Innovation Unit — commercial tech to warfighter | Fast-path prototype contracting for mature commercial tech | 🟡 Later (after a prototype exists) |
| **grants.gov** | Federal-wide grant portal | Non-DoD SBIR (NSF/NIH) and other grants | 🟢 Optional (DoD lane first) |
| **Consortia (e.g., NSTXL-style OTAs)** | OTA consortia memberships (NSTXL, DEFENSEWERX, etc.) | Access to Other Transaction awards without full bid process | 🟢 Optional, after first win |
| **challenge.gov** | All federal prize competitions | Cross-agency discovery of additional prize comps | 🟡 Watch |
| **armysbir.army.mil** | Army SBIR|STTR program | FY26 Army topic releases | 🟡 Watch |

**Standing intake ritual**: every month, when DoD releases topics (first Wednesday), scan DSIP topics +
xTech competitions + challenge.gov. The SBIR.gov funding planner shows open/pre-release windows per agency.
Sweep for topics where an **AI-native small team** (software + design automation, outsourced build) is a
natural fit — the ranking rubric in §5.

## 4. Registration process (the 6–12 week cold start)

The transcript's "system for award management registration, SBA company registry, foreign risk evaluation,
CMMC" is the real chain. **SAM.gov is the critical path** (CAGE queue at DLA). Start immediately — do not
wait for a proposal deadline. Order matters; each step consumes the last one's credentials. Keep **every
name/email/phone/address identical across all systems** — mismatches are the #1 cause of delays.

### 4.1 Set up the LLC (you don't have one yet) — Week 1–2
1. **Choose the state.** Filing in the state you live/work in is simplest and cheapest for a single-member
   LLC with no other footprint (Delaware/Wyoming add cost + registered agent fees with no benefit at this stage).
2. **File the Articles of Organization** — DIY via the secretary of state's site (~$50–$200). Do NOT use a
   filing-service upsell; the state forms are short. Get an EIN simultaneously via **irs.gov → EIN Assistant**
   (free, instant, issued as PDF). An EIN is mandatory for SAM.gov.
3. **Open a business bank account** in the LLC's exact legal name (SAM.gov validates banking for payments).
   Also register for any state/local business licenses required for your address.
4. **Confirm US ownership/control** — SBIR requires a US-owned and operated SBC with **no foreign influence**
   (FAR 52.204-29). If any founder is not a US citizen/entity, stop and reassess; this is a hard gate.

### 4.2 Federal registrations — Week 2–6 (parallel-track what you can)
1. **Login.gov** account with government-grade MFA (authenticator app or hardware key; identity verification
   needs photo ID + selfie). Used by SAM.gov and DSIP.
2. **SAM.gov** → Register Entity. Core data: legal name (must match IRS exactly), EIN, physical address,
   primary NAICS (pick the codes matching your software/manufacturing work — e.g. 541512 Computer Systems
   Design, 332710 Machine Shops, 541511 Custom Computer Programming), banking, FAR reps & certs (read each;
   do not click through).
   - **UEI** assigned immediately on core-data validation.
   - **CAGE code** assigned by DLA after IRS + DLA validation — **3–30 days queue. This is the long pole.**
   - Status must be **"Active"** (not submitted/processing) before downstream portals accept you.
   - **Renew every 365 days** (reminders at 60/30/10 days).
3. **SBIR.gov → SBA Company Registry** → **SBC Control ID** (1–3 weeks after SAM active). Required for all
   SBIR/STTR and for DSIP registration.
4. **DSIP** (defensesbirsttr.mil) → register firm profile linked to UEI + CAGE + SBC Control ID; designate
   Firm Administrator + Corporate Official (who certifies/submits). Register **now**, before any proposal —
   the system gets slow near deadlines.
5. **Grants.gov** (optional now, ~1 business day, needs EBiz POC from SAM) — only if pursuing NSF/NIH later.

### 4.3 Compliance posture (start, don't finish)
- **CMMC Level 2**: the transcript notes projected CMMC L2 for human-machine interface / cyber-adjacent
  topics. Do the **CMMC Level 2 self-assessment** (free) and build the required security practices into the
  company (isolate the govcon LLC's data handling, controlled-access laptop, asset inventory). Actual
  certification/3PAO is only needed once a contract demands it — but topics that require CMMC L2 at award
  will gate out firms with no posture.
- **Export control**: if pursuing ITAR/classified-adjacent topics, foreign suppliers are out and the
  US-first manufacturing rule hard-applies. See §6.
- **Fraud, waste & abuse training** + **foreign affiliation disclosure** are proposal volumes, not setup.

### 4.4 Quick assets to build during the queue
- One-page **capabilities statement** (who, what, past performance, NAICS, contact).
- 5-minute company **video** (xTech requires it) — script, screen recordings, no production budget needed.
- Kaggle/GitHub/capability proof links (the transcript's own advice: this is what an acquisitions officer
  looks for).

## 5. Ranking opportunities — AI-native capabilities first

**Rubric** — score every candidate topic on these dimensions (weight in parentheses):

| Criterion | Why |
|---|---|
| **AI-native fit (×5)** | Does this play to software + LLM/data-fusion + design automation strength? Software-first topics need no lab, no floor, no headcount. |
| **Build-via-outsourcing feasibility (×4)** | Can the Phase I/prize deliverable be produced from CAD files + outsourced fab? |
| **Entry barrier (×4)** | White paper/video (xTech) ≫ 10-page Phase I with 7 volumes (SBIR). Lower barrier = earlier revenue. |
| **Competition intensity (×3)** | Fewer incumbents in novel AI/hardware hybrids; established primes rarely chase prize comps. |
| **Security/ITAR posture (×3)** | Can we execute with US-first suppliers and no classified handling? |
| **Dual-use spillover (×2)** | Commercial resale value after the contract (the manufacturing infra itself qualifies). |
| **Timeline fit (×2)** | Open window vs. our registration queue. |

**Current ranked targets (Aug 2026):**

1. 🔴 **G-TEAD USARPAC ACE 27-01: Autonomous Sustainment (xTech, OPEN now)** — the transcript's
   "automated ground delivery for logistics/resupply" capability, now live in the Pacific theater context.
   **AI-native angle**: autonomous logistics orchestration software (route/re-supply planning, last-mile
   handoff, data fusion for contested environments) — software-led, vehicle hardware outsourced. White
   paper + video, cash prizes + follow-on. **Enter this first** — it matches the capability lane the video
   highlighted and is open today.
2. 🔴 **xTech|Search 10 (fall, open-topic flagship)** — apply the same white-paper approach with the
   strongest AI-native capability story: an AI-native design/manufacturing pipeline (see §6) or an
   AI/ML situational-awareness software play. Iteration 10 = high visibility, $25k–$150k prizes.
3. 🟡 **Navy wearable MR command-and-control (FY26 DoD SBIR Release 5, opens Aug 26, due Sep 23)** —
   the video's "Iron Man glasses" topic. Hardware-heavy (MR hardware + maritime environmental quals +
   CMMC L2) — likely **not** a Phase I for us yet. But the **software core** (multi-source intel fusion →
   operator interface) is the AI-native surface. Track it; if the pre-release TPOC Q&A reveals a
   software-licensable angle, consider it after the xTech wins.
4. 🟡 **xTech|Kinetic Reach / Adaptive Strike (active)** — watch for next-phase submission windows.
5. 🟢 **AFWERX / SOFWERX / DIU** — after one prototype exists; DIU especially wants commercial tech
   already built.

**Strategy note**: win an xTech prize first → that becomes the "past performance" + traction story for a
Phase I SBIR (Phase I feasibility is a smaller lift than Phase II), and follow-on contracts frequently come
from xTech winners. STTR (partner with a university/nonprofit) is a separate lane with better odds when a
topic pairs with an academic partner — pursue only if a real partnership emerges.

## 6. Outsourcing manufacturing infrastructure (cheap AI CAD → fab)

The moat: a small team turns a topic's requirement into **manufacturable geometry + fab orders in days, not
quarters**, using AI-assisted CAD and instant-quote manufacturing — no machine shop, no inventory.

### 6.1 AI CAD drafting stack (2026 state, honest)

| Tool | Cost | Output | Role |
|---|---|---|---|
| **Zoo.dev (Zookeeper / Design Studio)** | Free tier (~20 min reasoning/mo), API ~$0.0083/s | Real **B-Rep STEP**, glTF, OBJ, STL; Python SDK | Best standalone text-to-CAD; first drafts of prismatic parts (brackets, enclosures, mounting plates); **API = automatable** |
| **OpenSCAD + an LLM** | $0 (code-based) | Parametric scripts → STL (git-versionable) | Cheap parametric parts, patterns, jigs — LLMs write good OpenSCAD |
| **CADAgent** (open-source Fusion 360 add-in) | Free + Anthropic API key (+ Fusion license) | Native Fusion geometry with **real feature history** | Best output when you need to edit/iterate after generation |
| **AdamCAD** | ~$10–30/mo | STL + parametric sliders | Fast quick-iteration for 3D-print prototypes |
| **Autodesk Fusion** (free personal tier / subscription) | Free–~$60/mo | Full CAD/CAM/CAE | The manual-verification/cleanup seat + generative design later |

**Reality check (from 2026 tool testing)**: text-to-CAD is *not* production-ready. It reliably produces
first-draft geometry for simple-to-moderate parts; **cleanup, DFM review, tolerance spec, and assembly
integration are manual**. The winning workflow is: LLM generates a first draft (Zoo STEP or OpenSCAD
script or CADAgent inside Fusion) → human verifies/fixes in Fusion → export STEP. Budget the human-in-the-
loop time; the tool saves the first 10–20 min per part, which compounds across every topic.

### 6.2 Fab partners (US-first security, cheap offshore prototypes)

| Partner | US? | Services | Strengths |
|---|---|---|---|
| **Xometry** | US (+ global) | CNC, 3D print, sheet metal, injection molding; instant quote + DFM; **AS9100D, ITAR-registered** | Security-adjacent parts; instant DFM feedback |
| **SendCutSend** | US | CNC machining, laser cutting; instant quote; free US shipping | Cheap fast US CNC/laser for metal brackets; 2–7 day turnaround |
| **JLCPCB** | CN | PCB fab ($2–5, 24h quick-turn) + **SMT assembly** (BOM+CPL) | Cheapest PCB + assembly; KiCad plugin flow |
| **PCBWay** | CN + US | PCB, **CNC, sheet metal, 3D print, injection molding** | One-stop cheap prototyping incl. machined parts |
| **Fictiv** | US + network | CNC, molding, 3D print; instant quote + DFM | Parts in as fast as 1 day |
| **OSHPark** | US | PCB | Premium US boards, native KiCad upload |

**File contracts**: STEP/STP for machining & sheet metal (SendCutSend/PCBWay); STL for 3D print; Gerber RS-274X
(X2 *off* for PCBWay) + Excellon drill + BOM + CPL for PCB assembly (KiCad → JLCPCB/PCBWay plugins automate this).

### 6.3 The pipeline (a reusable company capability)

1. Requirement → prompt (topic text → part/assembly spec).
2. AI CAD draft (Zoo / OpenSCAD+LLM / CADAgent) → human verification & DFM pass in Fusion.
3. Export STEP/STL/Gerber → upload to fab partner → **instant quote + automated DFM check** → order.
4. Receive, test, photograph → evidence for proposals/past-performance.

This pipeline is itself **dual-use IP**: it can become a paid service (rapid-prototype studio) or a selling
point on proposals ("AI-native design-to-fab in days"). Track it in this repo (`docs/plans/` sibling
runbooks, `content/` case studies) as the brand matures.

### 6.4 Compliance guardrails
- **Foreign (CN) suppliers are fine for non-critical prototypes only.** Any topic with ITAR/export-control
  or CMMC L2 implications = **US-only** (Xometry/SendCutSend/OSHPark + Fictiv-US).
- SBIR's **2/3-of-work rule** means the SBC must perform most work itself — design, integration, test stay
  in-house; fab is legitimate subcontracting, but the *proposal, design, and management* must be ours.
- Track **country of origin** of every part file for the compliance record.

## 7. Other lanes the transcript surfaced (pick deliberately)

- **Consulting / training services** (the video's "become a paid govcon consultant" path): attractive
  because the process knowledge is exactly what we're learning — but it competes with winning contracts.
  **Defer** until the first wins exist; it can become a second revenue line later (fits the constellation's
  services DNA).
- **Proposal writing / account-exec career**: an employment lane, not a brand lane — ignore.
- **SBIR Phase I/II** is the long arc; the registrations in §4 make us ready when a topic fits.

## 8. Sequencing & timeline

| Phase | Window | Deliverables | Depends on |
|---|---|---|---|
| **0. Brand + entity** | Week 1–2 | LLC formed, EIN, bank account; brand name + domain chosen; minimal Astro capability site live (sitemap + robots) | — |
| **1. Registrations** | Week 2–6 (parallel) | Login.gov → SAM.gov (UEI + CAGE + active) → SBIR.gov SBC Control ID → DSIP profile; CMMC L2 self-assessment | 0 (EIN) |
| **2. Assets** | Week 2–4 (parallel) | Capabilities statement, 5-min video, GitHub/portfolio proof | 0 |
| **3. xTech entry** | Week 3–8 | G-TEAD USARPAC ACE 27-01 white paper + video (open now); xTech|Search 10 (fall) | 0, 2 |
| **4. Manufacturing scaffold** | Week 3–8 (parallel) | AI-CAD stack proven on 2–3 real parts; fab partners vetted; first prototype delivered | 0 (bank acct for PO/CC) |
| **5. SBIR Phase I** | Month 2–4 | Pick 1–2 AI-native topics from FY26 releases; contact TPOC in pre-release; 10-page tech volume (human-written) + cost volume; submit via DSIP | 1 (DSIP ready), 2, 3 (traction) |
| **6. Follow-on** | Month 4–12 | Phase II / Direct-to-Phase-II; AFWERX SBT; DIU; dual-use commercial service off the fab pipeline | 5 |

**Critical path**: LLC → SAM.gov → CAGE (queue) → SBC Control ID → DSIP. Everything else runs in parallel.
Start the LLC **today**; the federal calendar (Release 5 opens Aug 26) is already in motion.

## 9. Budget (rough)

| Item | Cost |
|---|---|
| LLC formation (state filing) | $50–$200 one-time |
| EIN / SAM.gov / SBIR.gov / DSIP / CMMC self-assessment | Free |
| Domain | ~$10–15/yr |
| Astro→Pages site | Free (existing stack) |
| AI CAD (Zoo free + OpenSCAD + CADAgent BYO-key) | ~$0–40/mo |
| Prototypes (first 2–3 parts) | ~$100–500 total |
| Brand identity (if outsourced) | optional |

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| CAGE queue delays (3–30 days) push past deadlines | Start registrations now; target white-paper comps (xTech needs no CAGE) as the buffer — this is exactly why xTech-first is the right order |
| US-ownership gate fails (foreign founder) | Hard stop at §4.1 step 4 — resolve before spending money |
| Text-to-CAD not production-ready | Human-in-the-loop Fusion cleanup; DFM checks at fab partners; never ship unverified geometry |
| CMMC L2 requirement on a target topic | Only chase topics we can posture for; keep the self-assessment current; defer cert until a contract requires it |
| Foreign supplier on security-adjacent part | §6.4 guardrail: US-only list enforced per part file |
| "Do not use AI to write the proposal" (transcript) | AI assists *research and intake* (topic decode, acronym lookup, outline); the proposal text is human-authored |
| Proposal volume burden (SBIR 7 volumes) | xTech-first builds momentum and process familiarity before the heavy lift |

## 11. Open questions (non-blocking assumptions)

1. **Brand name** — needed for domain + site (assumed: dedicated brand, decided in Phase 0).
2. **Home state for the LLC** — assumed: founder's residence state.
3. **US-ownership confirmation** — all founders US citizens/entities (hard gate, §4.1).
4. **Do we take the commercial "rapid prototype studio" spin-off?** — optional revenue line, later.
5. **STTR university partner** — only if a natural partnership appears.

## 12. Origin & sources

- Transcript: `/tmp/transcript.txt` — govclos-style video on SBIR/STTR + xTech (TPOC tips, volume structure,
  2/3 rule, CMMC L2, registration chain, websites list).
- xtech.army.mil (live, fetched 2026-08-15): G-TEAD USARPAC ACE 27-01 open, xTech|Search 10 fall, phases
  (white paper → pitch → PoC), prizes + follow-on contracts.
- defensesbirsttr.mil / sbir.gov / SBIR.org: DSIP registration, SBC Control ID, FY26 schedule, Release 5.
- SAM.gov / Precision Federal SBIR-Ready checklist (2026): registration chain, timelines, renewal.
- TexoCAD AI-CAD 2026 roundups: Zoo/CADAgent/AdamCAD/OpenSCAD state, STEP-vs-STL, human-in-the-loop reality.
- Xometry / SendCutSend / Fictiv / JLCPCB / PCBWay / OSHPark: services, pricing signals, DFM flows.
