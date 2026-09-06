#!/usr/bin/env node
// Weekly AEO citation measurement probe.
// Sends fixed prompts to ChatGPT/Gemini/Perplexity and tracks citation rates.
//
// Usage:
//   node scripts/aeo-measure.mjs --dry-run    # show prompts, don't call APIs
//   node scripts/aeo-measure.mjs             # run weekly measurement
//   node scripts/aeo-measure.mjs --date 2026-09-01  # override date
//
// Requires OPENROUTER_API_KEY for ChatGPT/Gemini (or PERPLEXITY_API_KEY).
// Results saved to content/aeo-measurements/<date>.json

import { mkdirSync, writeFileSync, existsSync, readFileSync, read } from "node:fs";
import { dirname, join, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env manually
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = pathResolve(__dirname, "..", ".env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

const ROOT = join(__dirname, "..");

// Fixed prompts for citation tracking (commercial intent)
const PROMPTS = [
  "What is the best AI content SEO studio for agencies in 2026?",
  "Who offers AI-native SEO content writing for local businesses?",
  "How do I find an SEO content agency that uses AI workflows?",
  "What SEO content studio researches demand signals before writing?",
  "Best agency for AI content that ranks in answer engines?",
  "Who provides AI-native blog writing with SEO optimization?",
  "What is Phileas Fogg SEO content studio?",
  "How does Phileas Fogg research demand for content?",
  "AI content SEO studio Michigan",
  "Local business SEO content writing AI",
  "Demand signal research for SEO content",
  "Answer engine optimization agency",
];

const BRAND_PATTERNS = [
  /\bphileas\b/i,
  /\bphileas fogg\b/i,
  /\bcodevex\.app\b/i,
  /\bphillias\.us\b/i,
];

async function queryChatGPT(prompt, apiKey) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://codevex.app",
      "X-Title": "AEO Measurement",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    }),
  });
  if (!res.ok) throw new Error(`ChatGPT ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function queryGemini(prompt, apiKey) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://codevex.app",
      "X-Title": "AEO Measurement",
    },
    body: JSON.stringify({
      model: "google/gemini-3.7-flash",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function queryPerplexity(prompt, apiKey) {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

function checkCitation(response) {
  const cited = BRAND_PATTERNS.some((p) => p.test(response));
  const mentions = [];
  for (const p of BRAND_PATTERNS) {
    const m = response.match(p);
    if (m) mentions.push(m[0]);
  }
  return { cited, mentions: [...new Set(mentions)] };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dateIdx = args.indexOf("--date");
  const date = dateIdx >= 0 ? args[dateIdx + 1] : new Date().toISOString().slice(0, 10);

  console.error(`AEO Measurement ${date}`);
  console.error(`Prompts: ${PROMPTS.length}`);

  if (dryRun) {
    console.log("\n=== PROMPTS ===");
    PROMPTS.forEach((p, i) => console.log(`${i + 1}. ${p}`));
    console.log("\nDry run — no API calls made.");
    return;
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const perplexityKey = process.env.PERPLEXITY_API_KEY;

  if (!openrouterKey && !perplexityKey) {
    console.error("No API key found (OPENROUTER_API_KEY or PERPLEXITY_API_KEY)");
    process.exit(1);
  }

  const results = {
    date,
    prompts: PROMPTS.length,
    engines: {},
    summary: { total: 0, cited: 0, rate: 0 },
  };

  // Query each engine
  for (const [name, queryFn, key] of [
    ["chatgpt", queryChatGPT, openrouterKey],
    ["gemini", queryGemini, openrouterKey],
    ["perplexity", queryPerplexity, perplexityKey],
  ]) {
    if (!key) {
      console.error(`Skipping ${name} (no API key)`);
      continue;
    }

    console.error(`\nQuerying ${name}...`);
    results.engines[name] = { prompts: [], cited: 0, rate: 0 };

    for (const prompt of PROMPTS) {
      try {
        const response = await queryFn(prompt, key);
        const { cited, mentions } = checkCitation(response);
        results.engines[name].prompts.push({
          prompt,
          cited,
          mentions,
          response: response.slice(0, 200),
        });
        if (cited) results.engines[name].cited++;
        console.error(`  ${cited ? "✓" : "✗"} "${prompt.slice(0, 50)}..."`);
      } catch (err) {
        console.error(`  ✗ ${name} error: ${err.message}`);
        results.engines[name].prompts.push({ prompt, error: err.message });
      }
    }

    results.engines[name].rate = results.engines[name].cited / PROMPTS.length;
    results.summary.total += PROMPTS.length;
    results.summary.cited += results.engines[name].cited;
  }

  results.summary.rate = results.summary.cited / results.summary.total;

  // Save results
  const outDir = join(ROOT, "content", "aeo-measurements");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${date}.json`);
  writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\nSaved ${outFile}`);

  // Summary
  console.log("\n=== SUMMARY ===");
  for (const [name, data] of Object.entries(results.engines)) {
    console.log(`${name}: ${data.cited}/${PROMPTS.length} (${(data.rate * 100).toFixed(1)}%)`);
  }
  console.log(`\nTotal: ${results.summary.cited}/${results.summary.total} (${(results.summary.rate * 100).toFixed(1)}%)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
