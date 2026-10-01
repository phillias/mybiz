#!/usr/bin/env node
// Prospect Radar enrichment — adds email + authority data via treg.
//
// Usage:
//   node scripts/enrich-prospects.mjs --fixture <file.json>
//   node scripts/enrich-prospects.mjs --prospect '{"name":"May Plumbing","website":null}'
//
// For each prospect:
//   1. If website exists → Hunter email lookup
//   2. If website exists → Moz DA/spam score
//   3. Output enriched prospects with contact + authority signals

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import { enrichWithTreg } from "./lib/treg-enrich.mjs";

// Load .env manually
const __scriptDir = dirname(fileURLToPath(import.meta.url));
const envPath = pathResolve(__scriptDir, "..", ".env");
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

const USAGE = `Prospect Radar enrichment — email + authority signals.

Usage:
  node scripts/enrich-prospects.mjs --fixture <file.json>
  node scripts/enrich-prospects.mjs --prospect '{"name":"May Plumbing",...}'

Options:
  --fixture <file>    enrich cached prospects
  --prospect <json>   enrich a single prospect inline
  --help              this text

Adds:
  - email: contact email from Hunter (if website exists)
  - domain_authority: Moz DA 0-100
  - spam_score: Moz spam risk 0-100
`;

function flag(args, name) {
  return args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] : undefined;
}

function hasWebsite(p) {
  const s = (p.website ?? "").trim();
  return s !== "" && !/^https?:\/\/(www\.)?$/.test(s);
}

async function enrichProspect(p) {
  const enriched = { ...p };
  const signals = {};

  if (!hasWebsite(p)) {
    enriched.email = null;
    enriched.domain_authority = null;
    enriched.spam_score = null;
    signals.website = false;
    return { enriched, signals };
  }

  signals.website = true;
  const tregData = await enrichWithTreg(p);
  Object.assign(enriched, tregData);

  signals.email = !!tregData.email;
  signals.moz = tregData.domain_authority !== undefined;

  return { enriched, signals };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes("--help")) {
    console.log(USAGE);
    process.exit(args.includes("--help") ? 0 : 1);
  }
  
  const fixtureFile = flag(args, "--fixture");
  const prospectJson = flag(args, "--prospect");
  
  let prospects = [];
  let outputFile = null;
  
  if (prospectJson) {
    const p = JSON.parse(prospectJson);
    prospects = [p];
  } else if (fixtureFile) {
    const data = JSON.parse(readFileSync(fixtureFile, "utf8"));
    prospects = data.prospects ?? [];
    outputFile = fixtureFile.replace(".json", ".enriched.json");
  } else {
    console.error("Need --fixture <file> or --prospect <json>");
    process.exit(1);
  }
  
  console.error(`Enriching ${prospects.length} prospect(s)...\n`);
  
  const enriched = [];
  for (const p of prospects) {
    const start = Date.now();
    const { enriched: e, signals } = await enrichProspect(p);
    const elapsed = Date.now() - start;
    
    enriched.push(e);
    
    const status = [];
    if (signals.email) status.push(`email:${e.email}`);
    if (signals.moz) status.push(`DA:${e.domain_authority}`);
    if (e.email_verified) status.push("verified");
    if (e.errors) status.push(`errors:${Object.keys(e.errors).join("/")}`);

    console.error(`  ${e.name}: ${status.length > 0 ? status.join(", ") : "no enrichment"} (${elapsed}ms)`);
  }

  // End-of-run summary — distinguishes "no data" from "endpoint failed"
  const failed = enriched.filter((e) => e.errors);
  if (failed.length > 0) {
    const hunter = failed.filter((e) => e.errors.hunter).length;
    const moz = failed.filter((e) => e.errors.moz).length;
    console.error(`\n${enriched.length} prospect(s) enriched, ${failed.length} with endpoint errors (hunter:${hunter}, moz:${moz})`);
  }
  
  // Output
  const output = {
    generatedAt: new Date().toISOString(),
    source: "treg",
    count: enriched.length,
    prospects: enriched,
  };
  
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
