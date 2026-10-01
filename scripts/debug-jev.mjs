#!/usr/bin/env node
// Debug Jev API request format

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
import { existsSync, readFileSync } from "node:fs";

// Load .env
const envPath = resolve(__dir, "..", ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq > 0) {
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("OPENROUTER_API_KEY not set");
  process.exit(1);
}

// Try minimal request matching OpenRouter docs exactly
const payload = {
  model: "~typesafe/jev-latest",
  state: "Help! My payouts have been failing for 3 days.",
  questions: {
    is_urgent: {
      type: "noul",
      instructions: "Does this message convey urgency?",
      criteria: {
        true: "Explicitly time-sensitive",
        false: "No urgency expressed"
      }
    },
    department: {
      type: "choice",
      instructions: "Which team should handle this?",
      criteria: {
        billing: "Payments, invoicing, refunds",
        technical: "Bugs, outages, integrations",
        sales: "Pricing, upgrades, new accounts"
      }
    },
    frustration: {
      type: "score",
      instructions: "How frustrated is the customer?",
      criteria: ["Calm", "Frustrated", "Very angry"]
    }
  }
};

console.log("Request payload:");
console.log(JSON.stringify(payload, null, 2));
console.log("\n---\n");

const payloadPath = "/tmp/jev-payload.json";
writeFileSync(payloadPath, JSON.stringify(payload));

// Use fetch so the API key never appears in a child-process command line
// (visible to local process observers) and the request is time-bounded.
try {
  const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  console.log("Response:");
  console.log(text);
} catch (err) {
  if (err.name === "TimeoutError" || err.name === "AbortError") {
    console.error("Request timed out after 30s");
    process.exit(1);
  }
  throw err;
}
