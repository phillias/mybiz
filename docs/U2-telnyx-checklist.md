# U2 — Telnyx Portal Checklist (10DLC + Number)

Status: scaffold ready, webhook stub in `convex/http.ts` (`/telnyx-webhook`).
Owner: portal actions below are user-side (account + legal info).

## Why this matters

- Voice works immediately on any new number — STIR/SHAKEN attestation is automatic (no registration).
- SMS to real US numbers needs A2P registration: either **10DLC** (local numbers) or **toll-free verification**.
- **No business entity required** — you are a solo operator: toll-free verification, or Sole Proprietor 10DLC with SSN (no EIN/LLC needed).

## 1. Account (done — you have one, admin@phillias.us → phillias@gmail.com)

- [x] Telnyx Mission Control login works
- [ ] Generate API key: Mission Control → API Keys → Create (store as `TELNYX_API_KEY` / `TELNYX_PUBLIC_KEY` in `.env`)
- [ ] Copy webhook signing secret: Mission Control → Webhooks → outbound (store as `TELNYX_WEBHOOK_SECRET`)

## 2. Number provisioning (~$0.25/mo, voice-live immediately)

- [ ] Mission Control → Numbers → Search & Buy → US local number
- [ ] Test: dial the number → call connects (agent wiring is U6)
- [ ] Record number as `TELNYX_NUMBER` in `.env` (E.164, e.g. `+13175550123`)

## 3. SMS registration — pick ONE path

### Path A: Toll-free verification (recommended for solo launch, ~1–5 days)
- [ ] Buy a toll-free number (~$2/mo) instead of / alongside local
- [ ] Mission Control → Messaging → Toll-free → submit verification form (answers questions + consent to recording; no entity required)
- [ ] Once verified: outbound/inbound SMS on that number works

### Path B: Sole Proprietor 10DLC (local numbers, 2–4 wk lead)
- [ ] Mission Control → 10DLC → Brand registration → type "Sole Proprietor", tax ID = SSN
- [ ] Campaign registration (~$15, "Low Volume" if <100 msgs/day): use-case "Two-way conversation" / "Account notifications"
- [ ] Wait for approval (2–4 weeks); SMS goes live on approval

> Defer either path until launch week if needed — dev/test uses Telnyx test credentials (no registration).

## 4. Branded Call Display (lead-gen: caller ID shows "Harbor")

- [ ] Mission Control → Identity → Branded Calling → register brand + STIR/SHAKEN attestation
- [ ] Verify on a T-Mobile + Verizon handset that the name displays

## 5. Webhook → Convex wiring

- [ ] Mission Control → Webhooks → Create → URL: `https://<your-project>.convex.site/telnyx-webhook`
- [ ] Events: `message.received` (SMS), `call.*` (voice; U6 wires these)
- [ ] QA (plan U2): reply to the number → `conversations` row appears in Convex dashboard with valid HMAC (401 without secret)

## 6. Env keys to collect

| Key | Where |
|---|---|
| `TELNYX_API_KEY` / `TELNYX_PUBLIC_KEY` | Mission Control → API Keys |
| `TELNYX_WEBHOOK_SECRET` | Mission Control → Webhooks |
| `TELNYX_NUMBER` | Numbers → your number |
