#!/usr/bin/env node
// VAPI Aftercall — place or schedule outbound review-request calls.
// Uses Vapi.ai for voice AI + Telnyx for phone number.
//
// Usage:
//   node scripts/vapi-aftercall.mjs --dry-run                        # list setup status
//   node scripts/vapi-aftercall.mjs --setup                          # create assistant + import number
//   node scripts/vapi-aftercall.mjs --call +12314455555 --dry-run    # preview call
//   node scripts/vapi-aftercall.mjs --call +12314455555              # place real call
//   node scripts/vapi-aftercall.mjs --campaign prospects.json        # batch campaign

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, "..");
const ENV_PATH = join(ROOT, ".env");
const OUT_DIR = join(ROOT, "content", "prospects");

// --- .env loader ---
function loadEnv() {
  if (!existsSync(ENV_PATH)) throw new Error(`.env not found at ${ENV_PATH}`);
  const env = {};
  for (const line of readFileSync(ENV_PATH, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const VAPI_BASE = "https://api.vapi.ai";

async function vapi(path, opts = {}, key) {
  const res = await fetch(`${VAPI_BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...opts.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`VAPI ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

// --- Commands ---

async function status(env) {
  const key = env.VAPI_API_KEY;
  if (!key) { console.log("VAPI_API_KEY not set in .env"); return; }

  console.log("=== VAPI Setup Status ===\n");

  // List assistants
  try {
    const assistants = await vapi("/assistant", { method: "GET" }, key);
    const list = Array.isArray(assistants) ? assistants : assistants.data ?? [];
    console.log(`Assistants: ${list.length}`);
    for (const a of list) {
      console.log(`  - ${a.name} (${a.id})`);
    }
  } catch (e) {
    console.log(`Assistants: error — ${e.message}`);
  }

  // List phone numbers
  try {
    const numbers = await vapi("/phone-number", { method: "GET" }, key);
    const list = Array.isArray(numbers) ? numbers : numbers.data ?? [];
    console.log(`\nPhone Numbers: ${list.length}`);
    for (const n of list) {
      console.log(`  - ${n.name ?? "unnamed"}: ${n.number} (${n.id})`);
    }
  } catch (e) {
    console.log(`Phone Numbers: error — ${e.message}`);
  }
}

async function setup(env) {
  const key = env.VAPI_API_KEY;
  if (!key) throw new Error("VAPI_API_KEY not set in .env");

  console.log("=== Setting up VAPI Aftercall ===\n");

  // Step 1: Create assistant
  console.log("1. Creating Aftercall assistant...");
  const AFTERCALL_PROMPT = `You are a warm, professional follow-up agent for a home-service business. Your name is Harper.

GOAL: After a service job is completed, check in with the customer and invite them to share their experience as a review.

FLOW:
1. Greet the customer by name. Mention the service that was just completed.
2. Ask how the experience was — "What happened, and what was the outcome?"
3. Listen actively. Acknowledge their response.
4. If they had a positive experience, say: "Would you mind sharing that experience as a review? It helps other people find good service. I can text you a direct link right now."
5. If they say yes, call the send_sms tool with the review link.
6. If they say no or are hesitant, say: "No pressure at all — thanks for choosing us!" and end warmly.
7. If they had a negative experience, say: "I'm sorry to hear that. I'll make sure the team knows about this. Is there anything I can do right now to help?" — do NOT push for a review.

RULES:
- Never coach the content of the review
- Never offer incentives for reviews
- Never transcribe and post — the customer writes the review themselves
- Keep the call under 60 seconds
- Always respect STOP/opt-out
- If the customer seems busy, offer to just text the link and let them go`;

  const assistant = await vapi("/assistant", {
    method: "POST",
    body: JSON.stringify({
      name: "Harbor Aftercall Agent",
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: AFTERCALL_PROMPT }],
      },
      firstMessage: "Hi {{name}}! This is Harper from {{business_name}}. I'm just checking in about your {{service}} today — how did everything go?",
      voicemailMessage: "Hi, this is Harper from {{business_name}}. We just wanted to check in about your recent service. If you'd like to share a review, we can text you a link. Have a great day!",
      endCallMessage: "Thanks for your time! We appreciate your business.",
      voicemailDetection: { enabled: true },
    }),
  }, key);
  console.log(`   Created: ${assistant.name} (${assistant.id})`);

  // Step 2: Import Telnyx number
  const telnyxNumber = env.TELNYX_NUMBER;
  if (!telnyxNumber) {
    console.log("\n2. Skipping Telnyx number import — TELNYX_NUMBER not in .env");
    console.log("   Add it and re-run --setup, or import manually in Vapi dashboard");
  } else {
    console.log(`\n2. Importing Telnyx number ${telnyxNumber}...`);
    // For Telnyx, we need to create a credential first
    // The simplest path is to use the "telnyx" provider directly
    try {
      const credential = await vapi("/credential", {
        method: "POST",
        body: JSON.stringify({
          provider: "telnyx",
          name: `Telnyx - ${telnyxNumber}`,
          apiKey: env.TELNYX_API_KEY,
        }),
      }, key);
      console.log(`   Credential: ${credential.id}`);

      const phoneNum = await vapi("/phone-number", {
        method: "POST",
        body: JSON.stringify({
          provider: "telnyx",
          name: `Aftercall - ${telnyxNumber}`,
          number: telnyxNumber,
          credentialId: credential.id,
        }),
      }, key);
      console.log(`   Phone number: ${phoneNum.number} (${phoneNum.id})`);
    } catch (e) {
      console.log(`   Import error: ${e.message}`);
      console.log("   Try importing manually in the Vapi dashboard at https://dashboard.vapi.ai");
    }
  }

  // Step 3: Save IDs
  console.log("\n3. Saving configuration...");
  const config = {
    assistantId: assistant.id,
    phoneNumber: telnyxNumber,
    createdAt: new Date().toISOString(),
  };
  const configPath = join(OUT_DIR, "vapi-config.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`   Saved to ${configPath}`);

  console.log("\n=== Setup Complete ===");
  console.log(`Assistant ID: ${assistant.id}`);
  console.log("Next: Add VAPI_ASSISTANT_ID and VAPI_PHONE_NUMBER_ID to .env");
}

async function placeCall(env, args) {
  const key = env.VAPI_API_KEY;
  if (!key) throw new Error("VAPI_API_KEY not set in .env");

  const customerNumber = args.call;
  const isDryRun = args.dryRun;

  // Load config
  const configPath = join(OUT_DIR, "vapi-config.json");
  if (!existsSync(configPath)) {
    throw new Error("Run --setup first to create assistant and import number");
  }
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  const assistantId = env.VAPI_ASSISTANT_ID ?? config.assistantId;
  const phoneNumberId = env.VAPI_PHONE_NUMBER_ID;

  if (!assistantId) throw new Error("VAPI_ASSISTANT_ID not configured");
  if (!phoneNumberId) throw new Error("VAPI_PHONE_NUMBER_ID not configured (add to .env)");

  const callParams = {
    assistantId,
    phoneNumberId,
    customer: { number: customerNumber },
    assistantOverrides: {
      variableValues: {
        name: args.name ?? "there",
        business_name: args.business ?? "your service provider",
        service: args.service ?? "recent service",
        review_link: args.reviewLink ?? "",
      },
    },
  };

  if (isDryRun) {
    console.log("=== DRY RUN — Call Parameters ===");
    console.log(JSON.stringify(callParams, null, 2));
    return;
  }

  console.log(`Placing Aftercall to ${customerNumber}...`);
  const result = await vapi("/call/phone", {
    method: "POST",
    body: JSON.stringify(callParams),
  }, key);
  console.log(`Call placed: ${result.id}`);
  console.log(`Status: ${result.status ?? "initiated"}`);
}

async function runCampaign(env, args) {
  const key = env.VAPI_API_KEY;
  if (!key) throw new Error("VAPI_API_KEY not set in .env");

  const campaignFile = args.campaign;
  if (!existsSync(campaignFile)) throw new Error(`File not found: ${campaignFile}`);

  const prospects = JSON.parse(readFileSync(campaignFile, "utf-8"));
  const configPath = join(OUT_DIR, "vapi-config.json");
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  const assistantId = env.VAPI_ASSISTANT_ID ?? config.assistantId;
  const phoneNumberId = env.VAPI_PHONE_NUMBER_ID;

  if (!assistantId || !phoneNumberId) throw new Error("Run --setup first");

  const customers = prospects.map((p) => ({
    number: p.phone,
    assistantOverrides: {
      variableValues: {
        name: p.name ?? "there",
        business_name: args.business ?? p.business_name ?? "your service provider",
        service: p.service ?? "recent service",
        review_link: p.reviewLink ?? "",
      },
    },
  }));

  if (args.dryRun) {
    console.log(`=== DRY RUN — Campaign: ${customers.length} contacts ===`);
    console.log(JSON.stringify({ assistantId, phoneNumberId, customers: customers.slice(0, 3), maxConcurrency: 5 }, null, 2));
    return;
  }

  console.log(`Launching Aftercall campaign: ${customers.length} contacts...`);
  const result = await vapi("/v2/campaign", {
    method: "POST",
    body: JSON.stringify({
      name: `Aftercall - ${new Date().toISOString().slice(0, 10)}`,
      assistantId,
      phoneNumberId,
      maxConcurrency: 5,
      customers,
    }),
  }, key);
  console.log(`Campaign launched: ${result.id}`);
}

// --- Main ---
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { dryRun: true, call: null, setup: false, campaign: null, name: null, business: null, service: null, reviewLink: null };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--dry-run": break; // default
      case "--apply": parsed.dryRun = false; break;
      case "--setup": parsed.setup = true; break;
      case "--call": parsed.call = args[++i]; break;
      case "--campaign": parsed.campaign = args[++i]; break;
      case "--name": parsed.name = args[++i]; break;
      case "--business": parsed.business = args[++i]; break;
      case "--service": parsed.service = args[++i]; break;
      case "--review-link": parsed.reviewLink = args[++i]; break;
      default: console.error(`Unknown arg: ${args[i]}`); process.exit(1);
    }
  }
  return parsed;
}

const args = parseArgs();
const env = loadEnv();

if (args.setup) {
  setup(env).catch((e) => { console.error(`Setup failed: ${e.message}`); process.exit(1); });
} else if (args.call) {
  placeCall(env, args).catch((e) => { console.error(`Call failed: ${e.message}`); process.exit(1); });
} else if (args.campaign) {
  runCampaign(env, args).catch((e) => { console.error(`Campaign failed: ${e.message}`); process.exit(1); });
} else {
  status(env).catch((e) => { console.error(`Status check failed: ${e.message}`); process.exit(1); });
}
