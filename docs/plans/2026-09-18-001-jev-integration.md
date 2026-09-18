# Jev Integration Plan — TypeSafe's System One Model via OpenRouter

Status: proposed · Date: 2026-09-18 · Scope: mybiz + mybrain

## Executive Summary

Jev is TypeSafe's "System One" model that outputs **only structured decisions** (no prose) via a dedicated Decisions API. It's ~100x faster and ~400x cheaper than LLMs for classification, routing, and scoring tasks. This plan covers integration across both profiles via OpenRouter, which you already have configured in Hermes.

**Key numbers** (OpenRouter pricing):
- Cost: $0.042/M input tokens, output free
- Latency: 70-500ms (typical ~100ms)
- Context: 32,000 tokens
- Endpoint: `https://openrouter.ai/api/alpha/decisions` (NOT the chat endpoint)

**Why OpenRouter**: Already configured in Hermes config, unified billing, no new account needed.

---

## 1. Shared Infrastructure

### 1.1 Jev Client Library

Create a shared client that both mybiz and mybrain can use. Lives in mybiz but exported for mybrain scripts.

```
mybiz/src/lib/jev.ts        — TypeScript client for Astro/Convex
mybiz/scripts/lib/jev.mjs   — ESM client for CLI scripts
```

**API Design**:

```typescript
// Single call, multiple parallel questions
const result = await jev.evaluate({
  state: "Customer email: 'My payouts have been failing for 3 days!'",
  questions: {
    is_urgent: { type: "noul", instructions: "Does this convey urgency?" },
    department: {
      type: "choice",
      instructions: "Which team handles this?",
      options: { billing: "Payments, invoices", technical: "Bugs, outages", sales: "Pricing, upgrades" }
    },
    frustration: {
      type: "score",
      instructions: "How frustrated is the customer?",
      criteria: ["Calm", "Frustrated", "Very angry"]
    }
  }
});
// Returns: { is_urgent: { noul: 0.95 }, department: { choice: "billing", confidence: 0.8, probabilities: {...} }, ... }
```

**Request format** (OpenRouter Decisions API):

```json
{
  "model": "~typesafe/jev-latest",
  "state": "<string | object | array>",
  "questions": {
    "<id>": {
      "type": "noul" | "choice" | "score",
      "instructions": "string",
      "true"?: "label", "false"?: "label",      // noul only
      "options"?: { [key]: "description" },     // choice only
      "criteria"?: ["level0", "level1", ...]    // score only
    }
  }
}
```

**Response format**:

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "<id>": {
      "type": "noul",
      "noul": 0.95
    } | {
      "type": "choice",
      "choice": "billing",
      "confidence": 0.8,
      "probabilities": { "billing": 0.87, "technical": 0.13, "sales": 0 }
    } | {
      "type": "score",
      "score": 1.04,
      "confidence": 0.94,
      "legend": { "0": "Calm", "1": "Frustrated", "2": "Very angry" },
      "probabilities": { "0": 0, "1": 0.96, "2": 0.04 }
    }
  }
}
```

### 1.2 Environment Setup

Add to `.env`:

```bash
OPENROUTER_API_KEY=sk-...  # already exists in Hermes systemd-env
JEV_DEFAULT_MODEL=~typesafe/jev-latest  # optional, defaults to this
```

The same key works for both chat models and Jev — OpenRouter handles routing by endpoint.

---

## 2. mybiz Use Cases

### 2.1 Prospect Radar Scoring Enhancement

**Current state**: Point-based scoring in `scripts/lib/scoring.mjs` with hardcoded weights and formulas. Works but doesn't learn from outcomes.

**Jev integration**: Replace OR augment with calibrated probability scoring.

**Questions schema**:

```javascript
{
  digital_presence_quality: {
    type: "score",
    instructions: "How complete is this business's digital presence?",
    criteria: ["Absent", "Minimal", "Basic", "Good", "Excellent"]
  },
  growth_potential: {
    type: "score",
    instructions: "How much growth potential exists for this business?",
    criteria: ["Saturated", "Stable", "Growing", "High-growth", "Explosive"]
  },
  high_ticket_fit: {
    type: "noul",
    instructions: "Is this business a high-ticket service provider ($500+ per transaction)?"
  },
  review_sentiment: {
    type: "score",
    instructions: "What's the sentiment in recent reviews?",
    criteria: ["Very negative", "Negative", "Neutral", "Positive", "Very positive"]
  },
  should_outreach: {
    type: "noul",
    instructions: "Is this business worth immediate outreach?"
  }
}
```

**State input** (from Prospect Radar data):

```javascript
{
  name: "May Plumbing & Heating Inc",
  website: null,
  reviewCount: 23,
  rating: 4.2,
  reviewRecency: "6 months",
  category: "plumber",
  city: "Houghton, MI",
  pages: null,
  pagespeed: null,
  serp: { inPack: false, sponsoredCount: 3, longTailClusters: 8 }
}
```

**Benefits over current scoring**:
1. Calibrated probabilities (90% confidence ≈ 90% correct)
2. No hardcoded weights — learned from training
3. Easy to A/B test different question phrasings
4. Confidence scores tell you when to escalate

**Implementation path**:
1. Keep existing scoring as baseline
2. Run Jev in parallel, compare predictions vs actual conversion
3. Once calibrated, replace point system

**Cost estimate**: ~500 tokens/prospect → $0.00002 each → $0.02 for 1,000 prospects

---

### 2.2 AEO Content Quality Gate

**Current state**: `scripts/aeo-measure.mjs` probes ChatGPT/Gemini/Perplexity for citations. No pre-publication quality check.

**Jev integration**: Pre-flight quality check before publishing.

**Questions schema**:

```javascript
{
  is_citation_worthy: {
    type: "noul",
    instructions: "Would an AI assistant cite this content as an authoritative source?"
  },
  answer_block_fit: {
    type: "score",
    instructions: "How well does this content fit the 40-60 word answer block pattern?",
    criteria: ["Poor fit", "Weak fit", "Moderate fit", "Good fit", "Perfect fit"]
  },
  content_tier: {
    type: "choice",
    instructions: "What quality tier is this content?",
    options: {
      low: "Thin, unhelpful, not worth publishing",
      medium: "Adequate, meets minimum standards",
      high: "Strong, valuable, likely to rank",
      authoritative: "Definitive, citation-worthy, cornerstone"
    }
  },
  has_factual_errors: {
    type: "noul",
    instructions: "Does this content contain apparent factual errors or hallucinations?"
  }
}
```

**State input**: Full article HTML or extracted text.

**Pipeline**:
```
Harbor API generates → Jev quality gate → 
  (confidence > 0.8, tier ≥ high) → publish
  (confidence < 0.5, tier < medium) → flag for review
  (has_factual_errors) → reject
```

**Integration point**: Convex action after Harbor generation, before Astro render.

---

### 2.3 Review Triage (Aftercall)

**Current state**: Aftercall ingests reviews but doesn't triage response priority.

**Jev integration**: Real-time review classification in webhook handler.

**Questions schema**:

```javascript
{
  sentiment: {
    type: "score",
    instructions: "What's the customer's sentiment?",
    criteria: ["Very negative", "Negative", "Neutral", "Positive", "Very positive"]
  },
  urgency: {
    type: "noul",
    instructions: "Does this review require immediate response?"
  },
  action: {
    type: "choice",
    instructions: "What action should be taken?",
    options: {
      respond: "Standard response appropriate",
      escalate: "Manager/owner attention needed",
      thank: "Just thank, no follow-up needed",
      ignore: "Not worth responding"
    }
  },
  category: {
    type: "choice",
    instructions: "What's the primary issue?",
    options: {
      service: "Work quality, service delivery",
      billing: "Pricing, charges, refunds",
      scheduling: "Appointments, timing, availability",
      communication: "Calls, texts, response time",
      other: "General, doesn't fit above"
    }
  },
  is_fake: {
    type: "noul",
    instructions: "Does this review appear fake or suspicious?"
  }
}
```

**State input**: Review text + metadata (rating, date, reviewer history if available).

**Latency budget**: 100ms Jev call fits in webhook timeout.

---

### 2.4 Content Partition Routing

**Current state**: Manual decision on mybiz vs mybrain for content.

**Jev integration**: Automatic partition classifier.

**Questions schema**:

```javascript
{
  partition: {
    type: "choice",
    instructions: "Which publication should this content go to?",
    options: {
      mybiz: "Commercial: Harbor product, agency services, client work",
      mybrain: "Professional: tutorials, personal brand, trading, homelab",
      neither: "Not publishable"
    }
  },
  publishable: {
    type: "noul",
    instructions: "Is this content suitable for public publication?"
  },
  content_type: {
    type: "choice",
    instructions: "What type of content is this?",
    options: {
      tutorial: "How-to guide, educational",
      case_study: "Real project walkthrough",
      opinion: "Thought piece, analysis",
      announcement: "Product/service news",
      documentation: "Technical reference"
    }
  }
}
```

**Integration points**:
- Research Signal Companion extraction pipeline
- Hermes session mining (`research-signal-companion` backlog item)
- Manual content drafts

---

## 3. mybrain Use Cases

### 3.1 Task Classification

**Current state**: Tasks table has 26 columns including `domain`, `subdomain`, `sentiment`, `priority`, `lifecycle`, but most are `pending_classification`.

**Jev integration**: Automatic task classification.

**Questions schema**:

```javascript
{
  domain: {
    type: "choice",
    instructions: "What domain does this task belong to?",
    options: {
      health: "Medical, fitness, mental health",
      finance: "Money, banking, investments, taxes",
      career: "Work, professional development",
      home: "House, maintenance, family",
      social: "Relationships, community, events"
    }
  },
  priority: {
    type: "score",
    instructions: "How urgent is this task?",
    criteria: ["Whenever", "Low", "Medium", "High", "Critical"]
  },
  effort: {
    type: "score",
    instructions: "How much effort will this take?",
    criteria: ["Trivial (<5 min)", "Small (15-30 min)", "Medium (1-2 hr)", "Large (half day)", "Huge (full day+)"]
  },
  should_delegate: {
    type: "noul",
    instructions: "Can/should this task be delegated?"
  },
  energy_type: {
    type: "choice",
    instructions: "What energy does this task require?",
    options: {
      creative: "Writing, designing, brainstorming",
      analytical: "Research, calculations, decisions",
      social: "Calls, meetings, coordination",
      physical: "Movement, hands-on work",
      administrative: "Forms, filing, routine tasks"
    }
  }
}
```

**State input**: `{ title, notes, list_title }` from tasks table.

**Implementation**:
1. Batch classify all `pending_classification` tasks
2. Hook into Google Tasks sync to classify new tasks on import
3. Add to mybrain pipeline cron job

**Cost**: ~200 tokens/task → $0.000008 each → $0.08 to classify all 10,000 tasks

---

### 3.2 Transaction Categorization

**Current state**: Transactions have `category` from SimpleFIN and `mybrain_category` (often null). Categorization rules table exists but underutilized.

**Jev integration**: Intelligent categorization with confidence.

**Questions schema**:

```javascript
{
  mybrain_category: {
    type: "choice",
    instructions: "What spending category does this transaction belong to?",
    options: {
      groceries: "Food, household supplies",
      dining: "Restaurants, takeout, coffee",
      transport: "Gas, car, Uber, parking",
      utilities: "Electric, water, internet, phone",
      housing: "Rent/mortgage, repairs, insurance",
      healthcare: "Doctors, pharmacy, therapy",
      entertainment: "Movies, games, subscriptions",
      shopping: "Clothes, electronics, general purchases",
      travel: "Flights, hotels, vacation",
      income: "Salary, dividends, refunds",
      transfer: "Account moves, investments",
      business: "Work expenses, tools, subscriptions"
    }
  },
  is_recurring: {
    type: "noul",
    instructions: "Is this a recurring expense?"
  },
  needs_review: {
    type: "noul",
    instructions: "Is this transaction unusual or needing manual review?"
  }
}
```

**State input**: `{ description, payee, amount, category }`

**Implementation**:
1. Run on new transactions during SimpleFIN sync
2. High-confidence (>0.9) → auto-categorize
3. Medium confidence (0.6-0.9) → accept but flag
4. Low confidence (<0.6) → flag for manual review

---

### 3.3 Entity Extraction and Linking

**Current state**: Entities table empty despite 756 entity links noted in prior memory.

**Jev integration**: Extract entities from diary entries, task notes, transactions.

**Questions schema**:

```javascript
{
  entity_type: {
    type: "choice",
    instructions: "What type of entity is this?",
    options: {
      person: "Named individual",
      organization: "Company, group, institution",
      place: "Physical location, venue",
      project: "Named effort, initiative",
      concept: "Idea, topic, theme"
    }
  },
  importance: {
    type: "score",
    instructions: "How important is this entity to track?",
    criteria: ["Mention once", "Minor", "Notable", "Important", "Central"]
  },
  sentiment: {
    type: "score",
    instructions: "What's the sentiment toward this entity?",
    criteria: ["Very negative", "Negative", "Neutral", "Positive", "Very positive"]
  }
}
```

**State input**: Text snippet containing entity mention + surrounding context.

---

### 3.4 Diary Entry Analysis

**Current state**: Diary entries exist but lack structured analysis.

**Jev integration**: Extract mood, themes, entities from each entry.

**Questions schema**:

```javascript
{
  mood: {
    type: "score",
    instructions: "What's the overall mood of this entry?",
    criteria: ["Very low", "Low", "Neutral", "Good", "Great"]
  },
  energy_level: {
    type: "score",
    instructions: "What energy level does this entry convey?",
    criteria: ["Exhausted", "Tired", "Normal", "Energetic", "Hyper"]
  },
  notable: {
    type: "noul",
    instructions: "Is this entry notable enough to highlight in a weekly summary?"
  },
  themes: {
    type: "choice",
    instructions: "What primary theme does this entry touch?",
    options: {
      work: "Job, projects, career",
      health: "Physical, mental wellbeing",
      relationships: "Family, friends, romance",
      personal: "Self, growth, hobbies",
      practical: "Tasks, logistics, errands"
    }
  }
}
```

---

## 4. Architecture

### 4.1 Code Locations

```
mybiz/
├── src/lib/jev.ts              # TypeScript client (Convex + Astro)
├── scripts/lib/jev.mjs         # ESM client (CLI scripts)
├── scripts/jev-prospect.mjs    # Prospect Radar scoring
├── scripts/jev-content.mjs     # Content partition/classification
├── convex/
│   └── actions/jevGate.ts      # Convex action wrapper
└── docs/plans/
    └── 2026-09-18-001-jev-integration.md  # this file

mybrain/
└── scripts/
    ├── jev-tasks.mjs           # Task classification
    ├── jev-transactions.mjs     # Transaction categorization
    └── jev-diary.mjs           # Diary analysis
```

### 4.2 Shared Client Implementation

**TypeScript (src/lib/jev.ts)**:

```typescript
const OPENROUTER_DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

export interface JevQuestion {
  type: "noul" | "choice" | "score";
  instructions: string;
  // noul options
  true?: string;
  false?: string;
  // choice options
  options?: Record<string, string>;
  // score options
  criteria?: string[];
}

export interface JevRequest {
  state: string | object;
  questions: Record<string, JevQuestion>;
  model?: string;
}

export interface JevAnswer {
  type: "noul" | "choice" | "score";
  // noul
  noul?: number;
  // choice
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
  // score
  score?: number;
  legend?: Record<string, string>;
}

export interface JevResult {
  model: string;
  answers: Record<string, JevAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

export async function evaluate(req: JevRequest): Promise<JevResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");
  
  const response = await fetch(OPENROUTER_DECISIONS_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: req.model || "~typesafe/jev-latest",
      state: req.state,
      questions: req.questions,
    }),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Jev API error ${response.status}: ${text}`);
  }
  
  return response.json();
}
```

**ESM (scripts/lib/jev.mjs)** — same logic, ESM export, loads `.env` manually.

### 4.3 Speculative Fan-Out Pattern

Jev's key advantage: **all questions evaluated in parallel** against the same state. Ask everything you might need in one call.

**Anti-pattern** (sequential LLM calls):
```typescript
const isUrgent = await llm("Is this urgent?");
const dept = await llm("Which department?");
const priority = await llm("What priority?");
// 3 round trips, ~$0.01, ~15 seconds
```

**Jev pattern** (parallel fan-out):
```typescript
const result = await jev.evaluate({
  state: customerMessage,
  questions: {
    is_urgent: { type: "noul", instructions: "Is this urgent?" },
    department: { type: "choice", instructions: "Which department?", options: {...} },
    priority: { type: "score", instructions: "What priority?", criteria: [...] },
    sentiment: { type: "score", instructions: "Customer sentiment?", criteria: [...] },
    needs_escalation: { type: "noul", instructions: "Does this need escalation?" },
    // Add speculative questions you might need later — parallel evaluation is free
    estimated_resolution_time: { type: "score", ... },
    suggested_action: { type: "choice", ... }
  }
});
// 1 round trip, ~$0.0001, ~100ms
```

---

## 5. Implementation Phases

### Phase 1: Shared Infrastructure (Week 1)

| Task | Owner | Est |
|------|-------|-----|
| Create `src/lib/jev.ts` client | mybiz | 2h |
| Create `scripts/lib/jev.mjs` client | mybiz | 1h |
| Add OPENROUTER_API_KEY to mybrain .env | mybrain | 5m |
| Write test script validating endpoint | mybiz | 30m |

### Phase 2: Prospect Radar (Week 2)

| Task | Owner | Est |
|------|-------|-----|
| Create `scripts/jev-prospect.mjs` | mybiz | 3h |
| Parallel run: Jev vs point scoring | mybiz | 2h |
| Compare predictions vs actual outcomes | mybiz | ongoing |
| Document confidence thresholds | mybiz | 1h |

### Phase 3: mybrain Classification (Week 3)

| Task | Owner | Est |
|------|-------|-----|
| Create `jev-tasks.mjs` batch classifier | mybrain | 3h |
| Create `jev-transactions.mjs` categorizer | mybrain | 2h |
| Integrate with mybrain pipeline cron | mybrain | 1h |
| Add confidence-based review flags | mybrain | 2h |

### Phase 4: Content Pipeline (Week 4)

| Task | Owner | Est |
|------|-------|-----|
| Create `jev-content.mjs` partition router | mybiz | 2h |
| Create Convex `jevGate` action | mybiz | 2h |
| Integrate with Harbor generation flow | mybiz | 3h |
| Add to AEO measurement pipeline | mybiz | 1h |

### Phase 5: Review Triage (Week 5)

| Task | Owner | Est |
|------|-------|-----|
| Create Aftercall review webhook handler | mybiz | 3h |
| Add Jev triage to webhook | mybiz | 2h |
| Test with mock reviews | mybiz | 1h |
| Document integration | mybiz | 1h |

---

## 6. Success Metrics

| Use Case | Metric | Target |
|----------|--------|--------|
| Prospect Radar | Correlation with conversion | > 0.5 |
| Task Classification | Agreement with manual labels | > 85% |
| Transaction Categorization | Auto-accept rate | > 90% |
| Content Partition | Agreement with manual decision | > 95% |
| AEO Quality Gate | False positive rate (publish bad content) | < 5% |
| Review Triage | Urgent reviews flagged within 5 min | > 99% |

---

## 7. Cost Analysis

| Use Case | Volume | Tokens/call | Cost/call | Monthly cost |
|----------|--------|-------------|-----------|--------------|
| Prospect Radar | 100 prospects/day | 500 | $0.00002 | $0.06 |
| Task Classification | 50 new tasks/day | 200 | $0.000008 | $0.01 |
| Transaction Categorization | 200 trans/day | 150 | $0.000006 | $0.04 |
| Content Classification | 20 pieces/day | 2000 | $0.00008 | $0.05 |
| Review Triage | 10 reviews/day | 300 | $0.00001 | $0.003 |
| **Total** | | | | **~$0.20/month** |

Effectively free at current volumes. Scales linearly.

---

## 8. Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|----------|
| TypeSafe SDK direct | First-party support | Another account, separate billing | Rejected — OpenRouter unified |
| Vercel AI SDK | Already using | Requires adapter for Jev | Future option, not blocking |
| Claude/GPT with structured output | No new dependency | 100x slower, 400x more expensive | Keep for prose, not decisions |
| Local model (llama.cpp) | Free | No calibrated probabilities, slower | Rejected for this use case |

---

## 9. Open Questions

1. **Calibration data**: Do we have labeled data to validate Jev's calibration? Can start with manual spot-checks.
2. **Fallback behavior**: If Jev API fails, fall back to point scoring? Log and alert?
3. **Batch size limits**: How many questions per call before diminishing returns? Test with 13+ questions.
4. **mybrain write access**: MCP is read-only. Classification writes need separate path (sync script, not MCP).

---

## 10. References

- TypeSafe blog: https://typesafe.ai/blog/introducing-system-one-models-and-jev
- OpenRouter Jev docs: https://openrouter.ai/~typesafe/jev-latest
- Cloudflare Workers AI: https://developers.cloudflare.com/ai/models/typesafe/jev/
- Flavio Copes deep dive: https://flaviocopes.com/jev/
