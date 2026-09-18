#!/usr/bin/env node
// Test Jev endpoint connectivity via OpenRouter Decisions API.
//
// Usage:
//   node scripts/test-jev.mjs
//
// Requires OPENROUTER_API_KEY in .env or environment.

import { evaluate, noul, choice, score } from "./lib/jev.mjs";

async function main() {
  console.error("Testing Jev endpoint via OpenRouter...");

  // Test with Cloudflare-compatible format (criteria for all types)
  const state = "Customer email: 'My payouts have been failing for 3 days! I'm losing money every day this isn't fixed. This is unacceptable!'";

  console.error("\nState:", state);
  console.error("Evaluating 5 questions in parallel...");

  const start = Date.now();
  const result = await evaluate({
    state,
    questions: {
      is_urgent: noul("Does this message convey urgency?", {
        true: "Explicitly time-sensitive",
        false: "No urgency expressed"
      }),
      department: choice("Which team should handle this?", {
        billing: "Payments, invoicing, refunds",
        technical: "Bugs, outages, integrations",
        sales: "Pricing, upgrades, new accounts"
      }),
      frustration: score("How frustrated is the customer?", ["Calm", "Frustrated", "Very angry", "Extremely angry"]),
      needs_escalation: noul("Does this need manager attention?", {
        true: "Requires immediate escalation",
        false: "Standard handling sufficient"
      }),
      likely_churn: score("How likely is this customer to churn?", ["Unlikely", "Possible", "Likely", "Very likely"])
    }
  });
  const elapsed = Date.now() - start;

  console.error(`\nModel: ${result.model}`);
  console.error(`Latency: ${elapsed}ms`);
  console.error(`Tokens: ${result.usage.input_tokens} in, ${result.usage.output_tokens} out`);

  console.log("\nResults:");
  for (const [id, answer] of Object.entries(result.answers)) {
    if (answer.type === "noul") {
      console.log(`  ${id}: ${answer.noul.toFixed(2)} (probability true)`);
    } else if (answer.type === "choice") {
      console.log(`  ${id}: "${answer.choice}" (confidence ${answer.confidence.toFixed(2)})`);
      const probs = Object.entries(answer.probabilities)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k}:${(v * 100).toFixed(0)}%`)
        .join(", ");
      console.log(`       distribution: ${probs}`);
    } else if (answer.type === "score") {
      const legend = answer.legend[String(Math.round(answer.score))] || "?";
      console.log(`  ${id}: ${answer.score.toFixed(2)} = "${legend}" (confidence ${answer.confidence.toFixed(2)})`);
    }
  }

  console.error("\n✓ Jev endpoint working!");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
