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
import { hunterFindEmail, mozMetrics, mozBacklinksSummary } from "./lib/treg.mjs";

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
  - backlinks: total referring domains
`;

function flag(args, name) {
  return args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] : undefined;
}

function hasWebsite(p) {
  const s = (p.website ?? "").trim();
  return s !== "" && !/^https?:\/\/(www\.)?$/.test(s);
}

function extractDomain(website) {
  if (!website) return null;
  return website
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .trim();
}

async function enrichProspect(p) {
  const enriched = { ...p };
  const signals = {};
  
  if (!hasWebsite(p)) {
    enriched.email = null;
    enriched.domain_authority = null;
    enriched.spam_score = null;
    enriched.backlinks = null;
    signals.website = false;
    return { enriched, signals };
  }
  
  const domain = extractDomain(p.website);
  signals.domain = domain;
  
  // Parallel calls for speed
  const [emailResult, mozResult, backlinksResult] = await Promise.allSettled([
    hunterFindEmail(domain, 3),
    mozMetrics([domain]),
    mozBacklinksSummary(domain),
  ]);
  
  // Hunter results
  if (emailResult.status === "fulfilled" && emailResult.value?.emails?.[0]) {
    const topEmail = emailResult.value.emails[0];
    enriched.email = topEmail.value;
    enriched.email_confidence = topEmail.confidence;
    enriched.email_position = topEmail.position;
    enriched.email_verified = topEmail.verification?.status === "valid";
    signals.email = true;
  } else {
    enriched.email = null;
    signals.email = false;
  }
  
  // Moz metrics
  if (mozResult.status === "fulfilled" && mozResult.value?.[0]) {
    const moz = mozResult.value[0];
    enriched.domain_authority = moz.domain_authority;
    enriched.page_authority = moz.page_authority;
    enriched.spam_score = moz.spam_score;
    enriched.linking_domains = moz.root_domains_to_root_domain;
    signals.moz = true;
  } else {
    enriched.domain_authority = null;
    enriched.spam_score = null;
    signals.moz = false;
  }
  
  // Backlinks summary
  if (backlinksResult.status === "fulfilled") {
    enriched.backlinks = backlinksResult.value.backlinks;
    enriched.referring_domains = backlinksResult.value.referring_domains;
    signals.backlinks = true;
  } else {
    enriched.backlinks = null;
    signals.backlinks = false;
  }
  
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
    
    console.error(`  ${e.name}: ${status.length > 0 ? status.join(", ") : "no enrichment"} (${elapsed}ms)`);
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
