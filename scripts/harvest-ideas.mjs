#!/usr/bin/env node
// Harvest validated idea signals from MonetScope's FREE public catalog into
// the demandSignal shape consumed by convex/actions/importDemandSignal.ts.
//
// Source: monetscope.com — no account required, server-rendered pages.
// No API key needed. Output is JSON for `npx convex run importDemandSignal`.
//
// Usage:
//   node scripts/harvest-ideas.mjs                 # dry-run: emit JSON, don't import
//   node scripts/harvest-ideas.mjs --source sitemap # harvest full catalog (default: /this-week)
//   node scripts/harvest-ideas.mjs --limit 10
//   node scripts/harvest-ideas.mjs --apply         # pipe into `npx convex run importDemandSignal`
//   node scripts/harvest-ideas.mjs --prod          # target prod deployment (with --apply)

const BASE = "https://monetscope.com";

const VERDICT_RULES = [
  // [minValidation, minConfidence, verdict] — first match wins, highest threshold first
  { validation: 8.5, confidence: 85, verdict: "PROCEED" },
  { validation: 6.5, confidence: 60, verdict: "PIVOT" },
  { validation: 0, confidence: 0, verdict: "PAUSE" },
];

function text(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ");
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "user-agent": "harbor-mybiz-harvester/0.1" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

// Collect opportunity URLs from a listing page.
async function collectUrls(source) {
  const page = source === "sitemap"
    ? `${BASE}/sitemap.xml`
    : `${BASE}/this-week`;
  const html = await fetchText(page);
  const pattern = source === "sitemap"
    ? /<loc>([^<]*\/opportunities\/[a-z0-9-]+)<\/loc>/g
    : /href="(\/opportunities\/[a-z0-9-]+)"/g;
  const urls = new Set();
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const u = m[1].startsWith("/") ? `${BASE}${m[1]}` : m[1];
    urls.add(u);
  }
  return [...urls];
}

function deriveVerdict(validation, confidence) {
  for (const rule of VERDICT_RULES) {
    if (validation >= rule.validation && confidence >= rule.confidence) {
      return rule.verdict;
    }
  }
  return "PAUSE";
}

function num(s) {
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 10) : undefined; // /10 → 0-100
}

// Parse one opportunity page into a demandSignal record.
async function parseOpportunity(url) {
  const html = await fetchText(url);
  const t = text(html);

  const titleTag = (html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .trim();
  const keyword = titleTag.split("—")[0].split("|")[0].trim();

  // Numeric block: "Pain 9.00 /10 WTP 8.0 /10 Market 8.0 /10 Validation 9.0 Confidence 95%"
  const scores = t.match(
    /Pain\s+([\d.]+)\s*\/10\s+WTP\s+([\d.]+)\s*\/10\s+Market\s+([\d.]+)\s*\/10\s+Validation\s+([\d.]+)\s+Confidence\s+(\d+)\s*%/,
  );

  const pain = scores ? num(scores[1]) : undefined;
  const buyerIntent = scores ? num(scores[2]) : undefined; // WTP
  const market = scores ? num(scores[3]) : undefined;
  const validation = scores ? num(scores[4]) : undefined;
  const confidence = scores ? parseFloat(scores[5]) : undefined;

  const updated = t.match(/(?:Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul)\s+\d{1,2},\s+\d{4}/)?.[0];

  return {
    keyword,
    source: "monetscope",
    providerVerdict: deriveVerdict(validation ?? 0, confidence ?? 0),
    pain,
    buyerIntent,
    raw: { url, market, validation, confidence, updated },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const source = args.includes("--source") ? args[args.indexOf("--source") + 1] : "thisweek";
  const apply = args.includes("--apply");
  const prod = args.includes("--prod");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 0;

  if (!["thisweek", "sitemap"].includes(source)) {
    console.error("--source must be thisweek or sitemap");
    process.exit(1);
  }

  const urls = await collectUrls(source);
  const effectiveLimit = limit > 0
    ? limit
    : (source === "sitemap" ? 100 : 0); // full catalog is ~1900 pages — cap by default
  const picked = effectiveLimit > 0 ? urls.slice(0, effectiveLimit) : urls;
  console.error(`harvest: ${picked.length} opportunities from ${source}`);

  // Small concurrency so we don't hammer the site.
  const records = [];
  const workers = [];
  let i = 0;
  const runWorker = async () => {
    while (i < picked.length) {
      const url = picked[i++];
      try {
        records.push(await parseOpportunity(url));
      } catch (err) {
        console.error(`skip ${url}: ${err.message}`);
      }
    }
  };
  for (let w = 0; w < 8; w++) workers.push(runWorker());
  await Promise.all(workers);

  records.sort((a, b) => (b.raw?.validation ?? 0) - (a.raw?.validation ?? 0));
  const payload = records.map((r) => ({ ...r, ingestedAt: undefined }));
  const json = JSON.stringify(payload);

  if (!apply) {
    process.stdout.write(json + "\n");
    console.error(`harvest: ${records.length} records, verdicts ->`, tally(payload));
    return;
  }

  const target = prod ? "--prod" : "";
  const { execFileSync } = await import("node:child_process");
  execFileSync(
    "npx",
    ["convex", "run", "actions/importDemandSignal:importDemandSignal", ...(target ? [target] : []), "--push", JSON.stringify({ payload })],
    { stdio: "inherit" },
  );
  console.error(`imported ${records.length} demandSignal records`);
}

function tally(records) {
  return records.reduce((acc, r) => ((acc[r.providerVerdict] = (acc[r.providerVerdict] ?? 0) + 1), acc), {});
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
