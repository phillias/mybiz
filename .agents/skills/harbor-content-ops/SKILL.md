---
name: harbor-content-ops
description: >
  Self-improving LinkedIn content operations for Harbor (phillias.us). Use when
  drafting a LinkedIn post, repurposing Harbor content for LinkedIn, or closing
  the self-improvement loop after the captain approves a draft. Reads the
  per-channel learning log and quality bar before drafting, always drafts to
  `docs/content-ops/linkedin/_drafts/` (never publishes directly), and ends with
  a mandatory self-improvement step that diffs the draft against what the captain
  kept and bakes the pattern back into this skill. For generic social-media
  strategy and copywriting across platforms, see the `social` skill; this skill
  owns the LinkedIn channel's voice and its improvement loop.
---

# Harbor content-ops — LinkedIn channel (self-improving)

The pilot skill for the content-ops workspace at `docs/content-ops/` (see its
README for the full lifecycle). This skill owns **one channel — LinkedIn** — and
the loop that makes it improve every cycle.

## The loop (what makes this different)

```
read _insights.md + _examples/ → draft to _drafts/ → captain approves/edits →
move kept version to _published/ → append dated pattern to _insights.md →
promote top performers to _examples/ → if a pattern recurs 2+ times, rewrite this skill's rules
```

Nothing enforces this mechanically — the loop is prompt discipline. If it is not
closed after a publish, the system degrades into a static prompt library.

## When to use

- Drafting a LinkedIn post for Harbor (product launch, milestone, article share,
  contrarian take, industry observation, event, repurpose).
- Repurposing Harbor-generated SEO content (raw-HTML articles in
  `content/drafts/` or published Astro pages) into a LinkedIn post.
- Closing the loop after the captain has approved/edited a LinkedIn draft.

Do **not** use for other channels yet — the pilot is LinkedIn-only. Do **not**
use for generic social strategy; that is the `social` skill's job.

## Step 0 — Read the learning bar before drafting (mandatory)

Before writing a single line, read:

1. `docs/content-ops/linkedin/_insights.md` — the dated learning log
   (what works / what doesn't / voice tells).
2. Every file in `docs/content-ops/linkedin/_examples/` — 3–5 top performers
   with annotated frontmatter; match their structure, tone, and patterns.
3. This skill's `## Voice` rules below.

Apply the insights and examples to the draft. If `_insights.md` is empty or
`_examples/` has no files yet, draft from this skill's baseline rules and say
so in the draft's notes — that is cycle 1 of the pilot.

## Sourcing context before you write

Never write a post from thin air. Fetch the source material first:

| Source | How to fetch |
|---|---|
| Harbor article / landing page | Read the raw-HTML file under `content/drafts/`, or the rendered Astro page source |
| GitHub release / README / PR | `gh-axi repo view` / `gh-axi pr view` / read the file |
| Blog/article URL | `webfetch` the URL |
| Internal doc | Read the file from the repo |
| Metrics | Convex (via the `convex` MCP) for Harbor product data |

Read the source fully, then extract: (1) the single most interesting claim or
data point, (2) why it matters to Harbor's audience, (3) what is non-obvious or
counterintuitive about it.

## Voice

Baseline rules (cycle 1). These grow and get rewritten by the `## Self-improvement`
step as the captain's edits are diffed back in.

- Direct and conversational, never corporate. First person singular ("I")
  unless it is a team moment ("we").
- Short sentences. Fragments are fine. One thought per line; use line breaks liberally.
- **The first line is the post.** If it does not stop the scroll, nothing else matters.
  Strong openers: contrarian hook, specific number, question, confession, bold claim.
- **Never** open with "Excited to announce", "Thrilled to share", "I'm delighted to", "Big news!".
- Specific numbers and evidence over vague claims ("cut query time 45s → 2s",
  not "made it way faster").
- 150–300 words. Hook must land before the ~210-char "see more" fold.
- Emojis sparingly: max 1–2 per post, never as bullet markers.
- Hashtags: 3–5 max, at the bottom, relevant.
- Punctuation: periods over exclamation marks (max 1 per post); no em dashes or
  ellipses for dramatic effect.
- One post, one idea. End with one clear CTA or question.
- Stay close to the captain's voice. Improve, don't rewrite. Don't invent
  angles they didn't suggest.

### Vocabulary to avoid (ghostwriter cliches)

"game-changer", "banger", "nails it", "had a blast", "incredibly", "leverage",
"synergy", "ecosystem", "thought leader" (never self-applied), "deep dive",
"unpack", "landscape", "at the end of the day".

## Draft (always to `_drafts/`)

1. Write the draft following the learning bar, voice rules, and sourced context.
2. Save to `docs/content-ops/linkedin/_drafts/YYYY-MM-DD_short-slug.md` with frontmatter:

```yaml
---
date: YYYY-MM-DD
channel: linkedin
topic: short-topic
format: post
status: draft
cycle: 1
performance:
notes:
---
```

3. Present the draft to the captain for approval. **Never publish directly** —
   the approval gate is always human (the pilot's human-approval posture).

## Review checklist (before presenting)

- [ ] Hook lands before the "see more" fold (~210 chars)
- [ ] No banned vocabulary
- [ ] No em dashes / ellipses for effect
- [ ] No weak openers ("Excited to announce", ...)
- [ ] 150–300 words
- [ ] One clear CTA or question at the end
- [ ] 3–5 relevant hashtags
- [ ] Emojis sparingly (0–2)
- [ ] Specific numbers/evidence over vague claims
- [ ] Source material accurately represented
- [ ] First person voice throughout
- [ ] Applied `_insights.md` + `_examples/` learnings (note which)

## Self-improvement

**This section is mandatory — it is the whole point of the pilot. Run it after
every captain approval, not just sometimes.**

When a draft is approved and the kept version is moved to `_published/`:

1. **Diff** the draft vs. what the captain kept: which words, emojis, hooks,
   structures were swapped, added, or cut? Quote the specific change.
2. **Append one dated pattern** to `docs/content-ops/linkedin/_insights.md` —
   the `## Voice tells` section for a voice/structure change, `## What works` /
   `## What doesn't work` for engagement patterns. Be specific and dated.
3. **Record the edit-diff size** (how much the captain changed the draft) in the
   pilot-measurement table in `_insights.md` — this is the 4-cycle metric.
4. **If a pattern recurs 2+ times**, rewrite this skill's `## Voice` rules to
   encode it (and drop any baseline rule the captain keeps overriding). A
   recurring edit is a standing preference, not a one-off.
5. **If the piece is a top performer**, copy it to
   `docs/content-ops/linkedin/_examples/` (max 3–5) with annotated frontmatter:

```yaml
---
date: YYYY-MM-DD
channel: linkedin
topic: short-topic
format: post
status: published
performance:
  impressions: 0
  likes: 0
  comments: 0
notes: "Why this performed well — what to replicate."
---
```

Rules of the loop:

- The captain's edits are signal. Capture what they changed and why, then bake
  it into the rules and the insights log.
- Review the skill quarterly (or when rules accumulate): prune outdated rules,
  rotate `_examples/` to recent performers.
- If a cycle produced no edits, note that in `_insights.md` (draft converged —
  also a useful signal: the loop is working).
