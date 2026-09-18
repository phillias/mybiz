#!/usr/bin/env node
// Jev-based Prospect Radar scoring — replaces point-based scoring with
// calibrated probability-based assessment.
//
// Usage:
//   node scripts/jev-prospect.mjs --city <city> --category <category>
//   node scripts/jev-prospect.mjs --fixture <file.json>
//   node scripts/jev-prospect.mjs --prospect '{"name":"May Plumbing",...}'
//
// Outputs Jev scores + comparison with point-based baseline.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate, noul, choice, score } from "./lib/jev.mjs";
import { scoreProspect, slugify, WEIGHTS } from "./lib/scoring.mjs";

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

const USAGE = `Jev Prospect Radar — probability-based business scoring.

Usage:
  node scripts/jev-prospect.mjs --city <city> --category <category>
  node scripts/jev-prospect.mjs --fixture <file.json>
  node scripts/jev-prospect.mjs --prospect '{"name":"May Plumbing",...}'

Options:
  --city <city>         target city (reads from fixture)
  --category <cat>     service category
  --fixture <file>     score cached prospects
  --prospect <json>    score a single prospect inline
  --compare            show point-based baseline alongside
  --help               this text

Outputs scored prospects with Jev probabilities.`;

function flag(args, name) {
  return args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] : undefined;
}

/**
 * Build state string for Jev from prospect data.
 */
function buildState(p) {
  const parts = [];
  parts.push(`Business: ${p.name}`);
  if (p.category) parts.push(`Category: ${p.category}`);
  if (p.city) parts.push(`Location: ${p.city}`);
  
  if (p.website) {
    parts.push(`Website: ${p.website}`);
  } else {
    parts.push("Website: NONE");
  }
  
  if (p.reviewCount !== undefined) {
    parts.push(`Reviews: ${p.reviewCount} (${p.rating ?? "?"} stars)`);
  }
  
  if (p.pages !== undefined) {
    parts.push(`Website pages: ${p.pages}`);
  }
  if (p.words !== undefined) {
    parts.push(`Website word count: ${p.words}`);
  }
  if (p.pagespeed !== undefined) {
    parts.push(`PageSpeed score: ${p.pagespeed}`);
  }
  
  if (p.serp) {
    parts.push(`Map pack: ${p.serp.inPack ? "YES" : "NO"}`);
    parts.push(`Sponsored listings: ${p.serp.sponsoredCount ?? 0}`);
    parts.push(`Long-tail clusters: ${p.serp.longTailClusters ?? 0}`);
  }
  
  return parts.join("\n");
}

/**
 * Evaluate a prospect with Jev.
 */
async function jevScoreProspect(p) {
  const state = buildState(p);
  
  const result = await evaluate({
    state,
    questions: {
      digital_presence: score(
        "How complete is this business's digital presence (website, reviews, map pack)?",
        ["Absent", "Minimal", "Basic", "Good", "Excellent"]
      ),
      growth_potential: score(
        "How much growth potential exists for this business in their local market?",
        ["Saturated", "Stable", "Growing", "High-growth", "Explosive"]
      ),
      high_ticket: noul(
        "Is this a high-ticket service business (typical transaction $500+)?",
        { true: "High-value service", false: "Low-value or commodity service" }
      ),
      review_sentiment: score(
        "What is the sentiment pattern in their reviews?",
        ["Very negative", "Negative", "Neutral", "Positive", "Very positive"]
      ),
      website_quality: score(
        "How would you rate the quality of their website (if any)?",
        ["No website", "Poor", "Basic", "Good", "Excellent"]
      ),
      urgency: noul(
        "Does this business need immediate marketing help?",
        { true: "Clear need for marketing services", false: "Already well-marketed or not a fit" }
      ),
      best_channel: choice(
        "What outreach channel would be most effective?",
        {
          phone: "Direct phone call",
          email: "Email outreach",
          mail: "Direct mail",
          gbp: "Google Business Profile message"
        }
      )
    }
  });
  
  return { prospect: p, jev: result };
}

/**
 * Convert Jev scores to 0-100 opportunity score.
 */
function jevToOpportunity(jevResult) {
  const a = jevResult.answers;
  
  // Extract scores (0-4 scale from criteria)
  const digital = a.digital_presence.type === "score" ? a.digital_presence.score : 2;
  const growth = a.growth_potential.type === "score" ? a.growth_potential.score : 2;
  const sentiment = a.review_sentiment.type === "score" ? a.review_sentiment.score : 2;
  const website = a.website_quality.type === "score" ? a.website_quality.score : 2;
  const urgent = a.urgency.type === "noul" ? a.urgency.noul : 0.5;
  const highTicket = a.high_ticket.type === "noul" ? a.high_ticket.noul : 0.5;
  
  // Invert: low digital presence = high opportunity
  const digitalOpp = (4 - digital) / 4;
  const websiteOpp = (4 - website) / 4;
  
  // Combine with weights
  const opportunity = Math.round(
    digitalOpp * 25 +
    (growth / 4) * 20 +
    websiteOpp * 20 +
    urgent * 20 +
    highTicket * 10 +
    (sentiment > 3 ? 5 : 0) // bonus for good sentiment (proven demand)
  );
  
  return {
    opportunity,
    breakdown: {
      digital_gap: Math.round(digitalOpp * 25),
      growth_potential: Math.round((growth / 4) * 20),
      website_gap: Math.round(websiteOpp * 20),
      urgency: Math.round(urgent * 20),
      high_ticket: Math.round(highTicket * 10),
      sentiment_bonus: sentiment > 3 ? 5 : 0
    },
    confidence: a.urgency.type === "noul" ? a.digital_presence.type === "score" ? 
      (a.digital_presence.confidence + a.growth_potential.confidence) / 2 : 0.5 : 0.5
  };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes("--help")) {
    console.log(USAGE);
    process.exit(args.includes("--help") ? 0 : 1);
  }
  
  const compare = args.includes("--compare");
  const fixtureFile = flag(args, "--fixture");
  const prospectJson = flag(args, "--prospect");
  const city = flag(args, "--city");
  const category = flag(args, "--category");
  
  let prospects = [];
  let runCity = city;
  let runCat = category;
  
  if (prospectJson) {
    const p = JSON.parse(prospectJson);
    runCity = p.city ?? city;
    runCat = p.category ?? category;
    prospects = [{ ...p, city: runCity, category: runCat }];
  } else if (fixtureFile) {
    const data = JSON.parse(readFileSync(fixtureFile, "utf8"));
    runCity = data.city ?? city;
    runCat = data.category ?? category;
    prospects = (data.prospects ?? []).map(p => ({ ...p, city: runCity, category: runCat }));
  } else {
    console.error("Need --fixture <file> or --prospect <json>");
    process.exit(1);
  }
  
  console.error(`Scoring ${prospects.length} prospect(s) with Jev...`);
  
  // Score each prospect
  const results = [];
  for (const p of prospects) {
    const start = Date.now();
    const jevResult = await jevScoreProspect(p);
    const elapsed = Date.now() - start;
    
    const opp = jevToOpportunity(jevResult.jev);
    
    // Compare with point-based scoring if requested
    let pointScore = null;
    if (compare) {
      pointScore = scoreProspect(p);
    }
    
    results.push({
      name: p.name,
      city: runCity,
      category: runCat,
      website: p.website,
      jev_opportunity: opp.opportunity,
      jev_breakdown: opp.breakdown,
      jev_confidence: opp.confidence,
      point_opportunity: pointScore?.opportunity ?? null,
      point_breakdown: pointScore ?? null,
      latency_ms: elapsed
    });
    
    console.error(`  ${p.name}: Jev=${opp.opportunity}${pointScore ? ` Point=${pointScore.opportunity}` : ""} (${elapsed}ms)`);
  }
  
  // Sort by Jev opportunity
  results.sort((a, b) => b.jev_opportunity - a.jev_opportunity);
  
  // Output JSON
  const output = {
    city: runCity,
    category: runCat,
    generatedAt: new Date().toISOString(),
    model: "typesafe/jev-1.13",
    compare,
    prospects: results
  };
  
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
