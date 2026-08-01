# U2 — Telnyx Portal Checklist (10DLC + Number)

Status: scaffold ready, webhook stub in `convex/http.ts` (`/telnyx-webhook`).
Owner: portal actions below are user-side (account + legal info).

## Current state (verified 2026-08-01 via API)

- [x] **Toll-free number +1-877-445-5580** purchased by user (id `3017003223971005577`, active) — the earlier local +1-689-225-8286 was cancelled during verification
- [x] Voice connection assigned: **Default Credential Connection** (id `3016892976782640902`)
- [x] Messaging profile **"mybiz"** assigned with webhook → `https://moonlit-spider-468.convex.site/telnyx-webhook`
- [x] **Toll-free SMS verification SUBMITTED** (request `e89288f0-ed15-5705-ad1e-f90e34f082d4`, 2026-08-01, via API — business "Harbor", use-case "Conversational / Alerts", volume 1,000). Clock running: ~1–5 business days; approval emails to admin@phillias.us. Draft + curl in `docs/tollfree-verification-draft.md`.
- [ ] After approval: text **+1-877-445-5580** → `conversations` row lands in Convex (webhook round-trip test)
- [x] **Webhook signature verification: DONE** — Ed25519 over `${telnyx-timestamp}|${rawBody}` verified against `TELNYX_PUBLIC_KEY` (fail-closed 401, 5-min replay window). Live-tested.

## ⚠️ Number type finding

**+1-877-445-5580 is TOLL-FREE** — the fastest SMS path: toll-free verification form (~1–5 days, no entity/brand registration needed), unlike the 10DLC requirement for local numbers. The original local +1-689-225-8286 (Orlando FL) was cancelled during verification — no 10DLC needed on the current plan.

## 1. Account (done)

- [x] API key generated (`TELNYX_API_KEY` in `.env`)
- [x] Public key captured (`TELNYX_PUBLIC_KEY` in `.env`)

## 2. Number (done — voice live)

- [x] US local number provisioned, voice connection assigned
- [x] Test: dial the number → call connects (agent wiring is U6)

## 3. SMS registration — pick ONE path

### Path A: Toll-free verification (recommended for solo launch, ~1–5 days)
- [ ] Buy a toll-free number (~$2/mo) in Mission Control → Numbers
- [ ] Messaging → Toll-free → verification form (no entity required)
- [ ] Assign to "mybiz" profile + add funds

### Path B: Sole Proprietor 10DLC (local number, 2–4 wk lead)
- [ ] Add funds to the account (required before profile assignment)
- [ ] Mission Control → 10DLC → Brand registration → "Sole Proprietor", tax ID = SSN
- [ ] Campaign registration (~$15, "Low Volume"): use-case "Two-way conversation"
- [ ] Assign number to "mybiz" profile

## 4. Branded Call Display (lead-gen: caller ID shows "Harbor")

- [ ] Mission Control → Identity → Branded Calling → register brand + STIR/SHAKEN
- [ ] Verify on a T-Mobile + Verizon handset

## 5. Webhook (configured)

- [x] Messaging profile webhook → `https://moonlit-spider-468.convex.site/telnyx-webhook`
- [ ] QA (plan U2): reply to the number → `conversations` row in Convex dashboard

## 6. Env keys (in `.env` + GitHub secrets)

- [x] `TELNYX_API_KEY` / `TELNYX_PUBLIC_KEY` (Ed25519 webhook key) / `TELNYX_NUMBER`
- [x] `TELNYX_PUBLIC_KEY` set on Convex prod deployment (`convex env set --prod`)
