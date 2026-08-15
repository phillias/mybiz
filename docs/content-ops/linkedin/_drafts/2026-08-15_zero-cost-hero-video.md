---
date: 2026-08-15
channel: linkedin
topic: build-in-public-zero-cost-hero-video
format: post
status: draft
cycle: 1
performance:
notes: "Cycle 1 of the LinkedIn pilot. _insights.md and _examples/ are empty, so this draft is from the skill's baseline Voice rules only. Source: phillias/mybiz PR #14 (merged) — the 8s looping dusk-cloud hero video built with the repo-local OpenMontage free pipeline; reproducible commands in docs/hero-video.md. Rev 2 (2026-08-15, captain review): cut the seam/loop-math sentence entirely, added honest tradeoffs of the free approach (generic CC footage, no on-brand art direction, time spent hunting footage, pipeline complexity, reliance on Wikimedia Commons), and replaced the closing question with a concrete next step."
---

The background video on my landing page cost $0. No stock subscription. No AI video tool. No account at all.

It's CC-licensed footage from Wikimedia Commons, pulled through a keyless pipeline, cut with a local ffmpeg. Five commands, documented so the whole thing rebuilds from a clean clone.

Free has a bill, it just isn't in dollars.

The clip is generic. Dusk clouds from a stranger's camera, not art-directed for Harbor. The motion is whatever I could find, not what I'd have designed. I spent real hours hunting footage and fighting a pipeline before the first frame rendered. And the whole thing leans on Wikimedia Commons staying up and keeping its license. That's a third party I don't control.

The asset itself is tight, and that part isn't a trade. 588KB across MP4, WebM, and a poster frame. Poster first, video metadata deferred, so the headline stays the page's LCP element. People who prefer reduced motion get the static poster.

So the honest next step for Harbor is to stop treating free as the finish line. The loop works and costs nothing to run. Now I want the version that's ours. Original footage, on-brand motion. Same performance, none of the trade-offs.

If you're building in public, try the same five commands once. It costs a few hours of your time, and you'll see exactly what free buys. Then decide if that's a trade worth making.

#buildinpublic #indiedev #webperf #indiehackers #astro
