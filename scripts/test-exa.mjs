#!/usr/bin/env node
// Quick smoke test for Exa integration.
// Usage: node scripts/test-exa.mjs

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");
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

async function main() {
  const Exa = (await import("exa-js")).default;
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    console.error("EXA_API_KEY not set");
    process.exit(1);
  }
  console.log("EXA_API_KEY found:", apiKey.slice(0, 8) + "...");

  const exa = new Exa(apiKey);

  // Test 1: Basic search
  console.log("\n=== Test 1: Basic Search ===");
  const searchRes = await exa.search("answer engine optimization strategies 2025", {
    numResults: 3,
    type: "auto",
    contents: { highlights: true },
  });
  console.log(`Results: ${searchRes.results?.length || 0}`);
  for (const r of (searchRes.results || []).slice(0, 3)) {
    console.log(`  - ${r.title}`);
    console.log(`    ${r.url}`);
    if (r.highlights?.[0]) console.log(`    highlight: ${r.highlights[0].slice(0, 100)}...`);
  }

  // Test 2: Company search
  console.log("\n=== Test 2: Company Search ===");
  const companyRes = await exa.search("Phileas Fogg SEO content studio", {
    numResults: 3,
    category: "company",
    contents: { highlights: true },
  });
  console.log(`Company results: ${companyRes.results?.length || 0}`);
  for (const r of (companyRes.results || []).slice(0, 3)) {
    console.log(`  - ${r.title}`);
    console.log(`    ${r.url}`);
  }

  // Test 3: Research paper search
  console.log("\n=== Test 3: Research Paper Search ===");
  const researchRes = await exa.search("AI answer engine optimization retrieval", {
    numResults: 3,
    category: "research paper",
    contents: { highlights: true },
  });
  console.log(`Research results: ${researchRes.results?.length || 0}`);
  for (const r of (researchRes.results || []).slice(0, 3)) {
    console.log(`  - ${r.title}`);
    console.log(`    ${r.url}`);
  }

  // Test 4: Answer endpoint (citation check)
  console.log("\n=== Test 4: Answer Endpoint ===");
  try {
    const answerRes = await exa.answer("What is the best AI content SEO studio?");
    console.log("Answer:", (answerRes.content || answerRes.answer || "").slice(0, 200));
    console.log("Citations:", answerRes.citations?.length || 0);
    for (const c of (answerRes.citations || []).slice(0, 5)) {
      console.log(`  - ${c.title}: ${c.url}`);
    }
  } catch (e) {
    console.log("Answer endpoint:", e.message?.slice(0, 100));
  }

  console.log("\n=== All Exa tests passed ===");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
