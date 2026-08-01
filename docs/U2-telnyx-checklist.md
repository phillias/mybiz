# U2 — Telnyx Portal Checklist (10DLC + Number)

Status: scaffold ready, webhook stub in `convex/http.ts` (`/telnyx-webhook`).
Owner: portal actions below are user-side (account + legal info).

## Current state (verified 2026-08-01 via API)

- [x] Number **+1-689-225-8286** provisioned (id `3016894309799561006`, active)
- [x] Voice connection assigned: **Default Credential Connection** (id `3016892976782640902`)
- [x] Messaging profile **"mybiz"** created with webhook → `https://moonlit-spider-468.convex.site/telnyx-webhook`
- [x] Number → messaging profile assignment: **BLOCKED — account balance $0** (error: "not enough funds"). Add funds in Mission Control → Billing.
- [x] **Webhook signature verification: DONE** — Ed25519 over `${telnyx-timestamp}|${rawBody}` verified against `TELNYX_PUBLIC_KEY` (Web Crypto, fail-closed 401, 5-min replay window). Deployed + live-tested (missing/garbage sig → 401).

## ⚠️ Number type finding

**+1-689-225-8286 is a LOCAL number** (NPA 689 = Orlando, FL overlay), **not toll-free**.
Consequence: production SMS on it requires **10DLC registration** (Sole Proprietor brand, SSN — no entity needed, 2–4 wk lead). The faster toll-free verification path (~1–5 days) requires buying a toll-free number (~$2/mo) instead.

Options:
- A) Keep local number + register sole-prop 10DLC (SSN) — 2–4 wk lead, local look
- B) Also buy a toll-free number for SMS at launch — fast verification, ~$2/mo
- C) Defer SMS entirely until launch week (voice works now)

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
