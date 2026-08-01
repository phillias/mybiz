# Toll-Free Verification — Draft Submission (U2)

Number: **+1-877-445-5580** · Endpoint: `POST /v2/messaging_tollfree/verification/requests`
(Fill the `‹FILL›` fields — personal info — then either run the curl below or paste the JSON into Mission Control → Messaging → Toll-free.)

## Submission JSON

```json
{
  "businessName": "Harbor",
  "corporateWebsite": "https://harborseo.ai",
  "businessAddr1": "‹FILL: street address›",
  "businessAddr2": null,
  "businessCity": "‹FILL: city›",
  "businessState": "‹FILL: full state name, e.g. Indiana›",
  "businessZip": "‹FILL: zip›",
  "businessContactFirstName": "‹FILL›",
  "businessContactLastName": "‹FILL›",
  "businessContactEmail": "admin@phillias.us",
  "businessContactPhone": "‹FILL: E.164, e.g. +13175550123›",
  "messageVolume": "1,000",
  "phoneNumbers": ["+18774455580"],
  "useCase": "Conversational / Alerts",
  "useCaseSummary": "Two-way conversational SMS for customers and agency clients: publish/rank-change notifications from the Harbor AI SEO platform, appointment and event reminders, and 2-way replies (human or AI agent) with STOP opt-out handling.",
  "productionMessageContent": "Harbor: Your article \u201cWhy AI SEO beats templates\u201d just published \u2014 view it: https://harborseo.ai/a/why-ai-seo \u2014 Reply HELP for help or STOP to unsubscribe.",
  "optInWorkflow": "Users opt in by (1) checking the SMS consent box during account signup at harborseo.ai, or (2) explicitly texting a keyword to the number. Consent records are stored per-number; STOP is honored immediately.",
  "optInWorkflowImageURLs": [],
  "additionalInformation": "Solo operator, startup volume under 1,000 messages/month. No marketing blasts; all messages are transactional, appointment/event-related, or in direct reply to a customer's inbound text."
}
```

## Submit via API

```bash
TELNYX_API_KEY="REDACTED_TELNYX_API_KEY"
curl -X POST "https://api.telnyx.com/v2/messaging_tollfree/verification/requests" \
  -H "Authorization: Bearer $TELNYX_API_KEY" -H "Content-Type: application/json" \
  -d '‹paste the JSON above with FILL fields completed›'
```

## Check status

```bash
curl -sS "https://api.telnyx.com/v2/messaging_tollfree/verification/requests/{id}" \
  -H "Authorization: Bearer $TELNYX_API_KEY"
```

## Acceptance (after approval, ~1–5 days)

1. Text **+1-877-445-5580** from your phone → `conversations` row lands in Convex dashboard (webhook `moonlit-spider-468.convex.site/telnyx-webhook`, Ed25519-verified)
2. Verify the row: phoneNumber = your number, channel = "sms", direction = "inbound"
