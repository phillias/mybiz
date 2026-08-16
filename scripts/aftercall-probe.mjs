#!/usr/bin/env node
/**
 * Harbor Voice — "The Aftercall" CLI probe.
 *
 * Verifies the review-link rotation + the exact Telnyx Create Call payload
 * WITHOUT placing a call by default:
 *
 *   node scripts/aftercall-probe.mjs --phone +12345550123 --service "drain cleaning" --city Alanson
 *
 *   --apply        perform the real outbound call POST to api.telnyx.com/v2/calls
 *   --slot N       rotation slot (0=google, 1=yelp, 2=angi); default 0
 *   --platform X   force google|yelp|angi (overrides --slot)
 *   --place ID     business identifier for a direct link (Place ID / Yelp slug / Angi slug)
 *   --job-id ID    optional job id carried in client_state
 *
 * Reads TELNYX_API_KEY / TELNYX_NUMBER / PUBLIC_CONVEX_URL from .env (Node >= 20.12
 * `process.loadEnvFile`) or the process environment. NEVER prints the API key.
 *
 * Keep-in-sync: PLATFORMS, REVIEW_WINDOW, REVIEW_LINK_TEMPLATES, buildPayload and
 * AFTERCALL_PROMPT mirror the canonical implementations in
 * convex/aftercall.ts. If you change one, change both.
 */

try {
  process.loadEnvFile(".env");
} catch (err) {
  if (process.env.TELNYX_API_KEY === undefined) {
    console.warn("[aftercall:env] no .env (or loadEnvFile unsupported) — falling back to process env");
  }
}

const TELNYX_CONNECTION_ID = "3016892976782640902"; // voice connection (runbook)
const TELNYX_CALLS_ENDPOINT = "https://api.telnyx.com/v2/calls";

const PLATFORMS = ["google", "yelp", "angi"];
const REVIEW_WINDOW = { startHours: 24, endHours: 48, label: "24-48h after service" };

function buildLink(platform, { place, service, city }) {
  switch (platform) {
    case "google":
      return place
        ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(place)}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([service, city].filter(Boolean).join(", "))}`;
    case "yelp":
      return place
        ? `https://www.yelp.com/biz/${encodeURIComponent(place)}`
        : `https://www.yelp.com/search?find_desc=${encodeURIComponent(service ?? "")}&find_loc=${encodeURIComponent(city ?? "")}`;
    case "angi":
      return place
        ? `https://www.angi.com/company/${encodeURIComponent(place)}`
        : "https://www.angi.com/"; // TODO: confirm Angi search/review-write URL shape
    default:
      throw new Error(`unknown platform ${platform}`);
  }
}

// Mirrors buildTelnyxCallPayload in convex/aftercall.ts. Fields verified
// against the Telnyx Create Call reference (telnyx-voice-javascript skill):
// to, from, connection_id, client_state, webhook_url, webhook_url_method, command_id.
function buildPayload({ to, from, connectionId, clientState, webhookUrl, commandId }) {
  return {
    connection_id: connectionId,
    to,
    from,
    client_state: JSON.stringify(clientState),
    webhook_url: webhookUrl,
    webhook_url_method: "POST",
    command_id: commandId,
  };
}

const AFTERCALL_PROMPT = `You are the Aftercall agent for Harbor Voice. You make one short, warm follow-up call after a home-service job is done.

TOOLS
- Use send_message only after the customer has consented to receiving a review link by text message.
- Never call tools for the customer; let them talk.

SCRIPT
1. WARM-UP (first ~10 seconds)
   Greet by name if you have it. Say you're calling from the company that finished the recent job in {city}. Keep it light: "I just wanted to check in quickly — this will only take about 30 seconds."

2. CONFIRM THE EXPERIENCE (don't rush to the ask)
   Ask whether the work got taken care of. Listen. If they mention a problem, acknowledge it plainly and offer to pass it along — do NOT solicit a review.

3. CALEB FRAMING (the core ask — general, not coached)
   Say, in your own words: "Would you mind talking about what happened and what the outcome was?" No leading adjectives, no star-rating language, no naming specific services or people.

4. CONSENT CAPTURE
   If they agree to share feedback, say you'll text them a review link. Ask "Is it okay to text that to you?" Get a clear yes before using send_message. Tell them: "Watch for the review link I'm sending."

5. OBJECTION HANDLING (no pressure, ever)
   - "I don't leave reviews" → "Totally fine — no pressure at all. Thanks for your time."
   - "What will you do with it?" → "It helps the company see how the job went. Purely optional."
   - Mentions of incentives → you never offer money, discounts, or anything in exchange for a review.
   - If they seem annoyed → apologize briefly, end warmly, do not send anything.

6. END
   Thank them by name. Say goodbye. If you promised a text, send it before ending.

RULES
- Never offer incentives, contests, or discounts for a review.
- Never ask only happy customers — everyone gets the same friendly ask.
- Never suggest what to write, which rating to give, or which services/people to mention.
- If the customer opts out ("stop", "don't contact me"), do not send anything and mark the number as opted out.
- Keep every turn short and conversational. No scripts read aloud verbatim.`;

function parseArgs(argv) {
  const args = { phone: null, service: null, city: null, platform: null, place: null, jobId: null, slot: 0, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--phone": args.phone = next(); break;
      case "--service": args.service = next(); break;
      case "--city": args.city = next(); break;
      case "--platform": args.platform = next(); break;
      case "--place": args.place = next(); break;
      case "--job-id": args.jobId = next(); break;
      case "--slot": args.slot = Number(next()); break;
      case "--apply": args.apply = true; break;
      case "-h": case "--help": args.help = true; break;
      default:
        if (a.startsWith("-")) {
          console.error(`[aftercall] unknown flag: ${a}`);
          process.exit(2);
        }
    }
  }
  return args;
}

function redactStatus(env) {
  return {
    TELNYX_API_KEY: env.TELNYX_API_KEY ? "set" : "MISSING",
    TELNYX_NUMBER: env.TELNYX_NUMBER ? env.TELNYX_NUMBER : "MISSING",
    PUBLIC_CONVEX_URL: env.PUBLIC_CONVEX_URL ? "set (.convex.site)" : "MISSING",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:
  node scripts/aftercall-probe.mjs --phone +12345550123 --service "drain cleaning" --city Alanson [--slot 0|1|2] [--platform google|yelp|angi] [--place ID] [--job-id J] [--apply]

  --apply   perform the real outbound Telnyx call (default: dry-run, no call placed)`);
    return;
  }
  if (!args.phone || !args.service || !args.city) {
    console.error("[aftercall] required: --phone --service --city");
    process.exit(2);
  }

  const platform = args.platform ?? PLATFORMS[Math.abs(args.slot) % PLATFORMS.length];
  if (!PLATFORMS.includes(platform)) {
    console.error(`[aftercall] unknown platform ${platform} (want ${PLATFORMS.join("|")})`);
    process.exit(2);
  }

  const link = buildLink(platform, { place: args.place, service: args.service, city: args.city });

  const from = process.env.TELNYX_NUMBER;
  const convexUrl = process.env.PUBLIC_CONVEX_URL;
  const clientState = {
    kind: "aftercall",
    jobId: args.jobId ?? null,
    platform,
    service: args.service,
    city: args.city,
  };
  const payload = buildPayload({
    to: args.phone,
    from,
    connectionId: TELNYX_CONNECTION_ID,
    clientState,
    webhookUrl: convexUrl ? `${convexUrl}/telnyx-webhook` : "",
    commandId: crypto.randomUUID(),
  });

  console.log(`[aftercall] plan`);
  console.log(`  phone:      ${args.phone}`);
  console.log(`  service:    ${args.service}`);
  console.log(`  city:       ${args.city}`);
  console.log(`  platform:   ${platform} (slot ${args.slot} of google→yelp→angi)`);
  console.log(`  link:       ${link}`);
  console.log(`  window:     ${REVIEW_WINDOW.label}`);
  console.log(`  jobId:      ${args.jobId ?? "(none)"}`);
  console.log(`  mode:       ${args.apply ? "APPLY (real call)" : "dry-run (no call placed)"}`);
  console.log(`  env:        ${JSON.stringify(redactStatus(process.env))}`);
  console.log();
  console.log(`[aftercall] would-be POST ${TELNYX_CALLS_ENDPOINT}`);
  console.log(JSON.stringify(payload, null, 2));
  console.log();
  console.log(`[aftercall] agent prompt (AFTERCALL_PROMPT)`);
  console.log("---");
  console.log(AFTERCALL_PROMPT);
  console.log("---");

  if (!args.apply) {
    console.log("[aftercall] dry-run complete — nothing sent to Telnyx.");
    return;
  }

  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey || !from || !convexUrl) {
    console.error("[aftercall:apply] missing TELNYX_API_KEY / TELNYX_NUMBER / PUBLIC_CONVEX_URL in .env — aborting before any call");
    process.exit(1);
  }

  console.log(`[aftercall:apply] placing call to ${args.phone} ...`);
  const res = await fetch(TELNYX_CALLS_ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[aftercall:apply] Telnyx ${res.status}: ${text}`);
    process.exit(1);
  }
  const json = JSON.parse(text);
  const data = json.data ?? {};
  console.log(`[aftercall:apply] OK`);
  console.log(JSON.stringify({
    callControlId: data.call_control_id ?? data.callControlId,
    callLegId: data.call_leg_id ?? data.callLegId,
    callSessionId: data.call_session_id ?? data.callSessionId,
    isAlive: data.is_alive ?? data.isAlive,
    raw: json.meta ?? null,
  }, null, 2));
}

main().catch((err) => {
  console.error("[aftercall] fatal:", err.message);
  process.exit(1);
});
