---
date: 2026-08-15
channel: linkedin
topic: build-in-public-zero-cost-hero-video
format: post
status: draft
cycle: 1
performance:
notes: "Cycle 1 of the LinkedIn pilot. _insights.md and _examples/ are empty, so this draft is from the skill's baseline Voice rules only. Source: phillias/mybiz PR #14 (merged) — the 8s looping dusk-cloud hero video built with the repo-local OpenMontage free pipeline; reproducible commands in docs/hero-video.md."
---

The background video on my landing page cost $0. No stock subscription. No AI video tool. No account at all.

It's CC-licensed footage from Wikimedia Commons, pulled through a keyless pipeline, cut with a local ffmpeg. Five commands in total, documented so the whole thing rebuilds from a clean clone.

The part that surprised me: a seamless loop isn't magic. It's math.

I trimmed an 8-second window, slowed it to 0.7x, and crossfaded the tail into the head. Then I measured the seam. Join error ~6.3, against the clip's own natural drift of ~15.7. When the join is tighter than the footage's own variation, nothing reads as a loop.

The finished asset ships at 588KB. MP4, WebM, and poster frame combined.

And it costs nothing on performance. Poster first, video metadata deferred, so the headline stays the page's Largest Contentful Paint element. People who prefer reduced motion get the static poster instead.

A 588KB cinematic hero, zero secrets, zero accounts, and it doesn't slow the page down.

What's the most expensive-looking thing on your site that actually cost nothing to make?

#buildinpublic #indiedev #webperf #indiehackers #astro
