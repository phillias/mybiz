# content-ops — self-improving content workspace (LinkedIn pilot)

The pilot from the Company-OS/Sylph scout report (`data/mybiz-companyos-sylph-scout/report.md` §8): transplant the self-improvement loop from `getnao/sylph` — the `_insights.md` + `_examples/` quality bar and the edit-diff convention — scoped to Harbor's LinkedIn content ops.

**Pilot scope:** one channel (LinkedIn), one skill (`.agents/skills/harbor-content-ops/SKILL.md`), ~4 cycles. If second drafts need fewer captain edits by cycle 4, generalize to a second channel (outbound or blog). If not, the loop wasn't being fed (edits not diffed) — a discipline failure, not a framework failure — and the pilot is small enough to discard.

## The lifecycle

Every piece of content follows this path:

```
draft → captain approval → publish → update _insights.md → promote to _examples/
```

| Stage | Location | When |
|---|---|---|
| Working draft | `linkedin/_drafts/` | While creating or iterating. **Always save here first — never publish directly.** |
| Finalized/published | `linkedin/_published/` | After the captain approves and edits; the kept version lives here |
| Learning log | `linkedin/_insights.md` | After publishing — log what worked, what didn't, with dates and numbers |
| Quality bar | `linkedin/_examples/` | Only when a piece is a top performer — 3–5 annotated examples, used as few-shot references |

## File naming

`YYYY-MM-DD_short-slug.md` — e.g. `2026-08-14_harbor-launch-post.md`.

## The mandatory self-improvement step

The 30 seconds after publishing are the most valuable 30 seconds in the workflow. The pilot only improves if the loop is closed:

1. Diff what the skill drafted vs. what the captain kept — which words, emojis, or structures got swapped, added, or cut.
2. Append one dated pattern to `linkedin/_insights.md`.
3. If a pattern recurs 2+ times, rewrite the skill's own voice rules in `SKILL.md`.
4. If the piece is a top performer, copy it to `_examples/` with annotated frontmatter (why it performed).

## Measuring the pilot (4 cycles)

- Track the *edit-diff size* each cycle: how many words/lines did the captain change before approving?
- Hypothesis: draft N+1 needs fewer captain edits than draft N.
- Record the per-cycle diff size in `_insights.md` so the trend is visible.

## Operators

- **The captain (human)** approves, edits, and publishes — the skill never publishes directly.
- **A crewmate/secondmate** may run drafting or the post-publish self-improvement step on the captain's behalf, but the approval gate is always human.
