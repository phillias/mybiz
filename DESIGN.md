# DESIGN.md — Phileas Fogg (codevex.app)

Corporate landing design system. Modern Jules Verne "around the world" motif:
global reach, great-circle routes, waypoints. Deliberately NOT Victorian (no
sepia, filigree, serif-everything, or period dressing).

## Visual thesis

Editorial travel-journal meets modern SaaS: warm paper surfaces, deep ink-navy
hero, one amber signal accent, an animated great-circle route as the hero
anchor. Calm, spacious, typography-led.

## Tokens

- `--ink: #0b1f33` (deep navy) · `--ink-2: #12314f`
- `--paper: #f6f2ea` (warm) · `--paper-2: #ece5d7`
- `--accent: #e56b2b` (signal amber/orange) · `--accent-strong: #b6480f`
- Display: **Bricolage Grotesque** (800/700) · Body: **Schibsted Grotesk** (400-600)
- Buttons: pill (999px radius), accent solid for primary, ghost outline on dark

## Composition

- Hero: dark ink, split text + globe SVG; narrow text column; one H1; one primary CTA
- Route section: cardless numbered waypoints (01 Discover / 02 Draft / 03 Ship), top border rule
- Everywhere: coordinates list on `--paper-2`; final CTA on ink
- Max 5 sections; generous whitespace; no stat pills, no logo clouds, no gradients

## Motion

- Great-circle route draws in on scroll (stroke-dashoffset driven by
  IntersectionObserver + scroll progress); traveler dot follows the path
- Button hover: subtle -2px lift; respects `prefers-reduced-motion`
- Section reveals: fade-up via `[data-reveal]` + `.is-in` (IntersectionObserver)

## Guardrails

- Keep copy in product language; "around the world" motif, modern, not Victorian
- Never mention "mybiz"; business moniker is Phileas Fogg; never claim
  harborseo.ai or its domain/mailbox
- Contact published: admin@codevex.app (CTIA requirement; `PUBLIC_CONTACT_EMAIL` via src/config/site.ts; mailbox provisioning = docs/codevex-migration-runbook.md §4)
- WCAG AA contrast; visible `:focus-visible`; semantic elements (header/nav/main/section/ol)
- No purple-on-white, no Inter/Roboto/Space Grotesk, no em-dash saturation
