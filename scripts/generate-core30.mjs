#!/usr/bin/env node
// Core 30 generation: read pageBlueprint rows -> Harbor API articles.
// Consumes the Core 30 GBP strategy (docs/plans/2026-08-16-001-core-30-gbp-strategy.md).
//
//   node scripts/generate-core30.mjs --blueprints content/blueprints/core30-sample.json --dry-run
//   node scripts/generate-core30.mjs --blueprints <file> --apply --city "Petoskey" --limit 3
//   node scripts/generate-core30.mjs --convex --dry-run   # pull blueprints from Convex instead
//
// Defaults to dry-run (no credits spent). Pass --apply to generate (1 credit/page).
// Requires HARBOR_API_KEY in the environment (.env); optional HARBOR_SITE_ID.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const API = "https://outgoing-oyster-428.convex.site/v1";
const SITE_ID = process.env.HARBOR_SITE_ID || "nd7amxhtnt94bx5er1ygvm4rbx8c97yz";

const BRIEFS = {
  service:
    "Mirror the client's Google Business Profile service entity exactly. Lead with the answer. Use the exact service entity plus the city in the first paragraph. Include attribute-specific language customers and AI use (e.g. 'tankless water heater', 'lead main drain line', 'after-hours emergency'). Write plain-language questions as verbatim headings. Build a real FAQ section from how people phrase the question. 1,000+ words. End with one concrete next step.",
  location:
    "Local service-area page. Lead with the answer. Use the exact service entity plus the city in the first paragraph. Mention the service area, nearby communities, landmarks, and realistic travel context. Include attribute-specific language. Write plain-language questions as verbatim headings. Add a FAQ section. 1,000+ words. End with one concrete next step.",
  supporting:
    "Trust content for a local service business. Pick one real customer question cluster and answer it honestly and specifically: what it costs, what problems look like, when we are not the right fit, or repair-vs-replace. Lead with the answer. Include attribute-specific language. Write plain-language questions as verbatim headings. End with one concrete next step.",
  core:
    "Hub page for a local service business. Lead with the answer. State the primary service entity plus the city in the first paragraph. Cover each secondary category with 50-70 words and link to its dedicated page. Write plain-language questions as headings. End with one concrete next step.",
};

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function blueprintKeyword(bp, city) {
  if (bp.keywordCluster) return bp.keywordCluster;
  if (!bp.slug) return city ? city : "untitled";
  const base = bp.slug.split("/").pop().split("-").join(" ");
  return city ? `${base} ${city}` : base;
}

function toFilename(bp, city) {
  if (!bp.slug) return city ? slugify(city) : "untitled";
  const stem = bp.slug.replace(/^services\//, "").replace(/^locations\//, "");
  const base = slugify(stem);
  return city && !base.includes(slugify(city)) ? `${base}-${slugify(city)}` : base;
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { authorization: `Bearer ${process.env.HARBOR_API_KEY}`, ...(opts.headers || {}) },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Harbor ${res.status}: ${body?.error?.message ?? JSON.stringify(body).slice(0, 200)}`);
  return body;
}

async function generate(bp, outDir) {
  const keyword = blueprintKeyword(bp, bp.city || "");
  const filename = `${toFilename(bp, bp.city)}.html`;
  const job = await api("/articles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      site_id: SITE_ID,
      keywords: keyword,
      content_mode: "freeform",
      instructions: bp.instructions || BRIEFS[bp.archetype] || BRIEFS.supporting,
      content_type: bp.archetype === "service" ? "Service page" : bp.archetype === "location" ? "Location page" : undefined,
    }),
  });
  let article = job;
  for (let i = 0; i < 20; i++) {
    article = await api(`/articles/${job.id}?wait=true`);
    if (article.status === "completed" || article.status === "failed") break;
  }
  if (article.status !== "completed") throw new Error(`job ${job.id} ended ${article.status}`);
  const dest = `${outDir}/${filename}`;
  writeFileSync(dest, article.content ?? article.html ?? "");
  return { filename, keyword, status: article.status, bytes: (article.content ?? article.html ?? "").length };
}

async function loadBlueprints(args) {
  const convex = args.includes("--convex");
  if (convex) {
    const raw = execFileSync("npx", ["convex", "run", "pageBlueprints:list", "{}"], { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] });
    return JSON.parse(raw);
  }
  const fileIdx = args.indexOf("--blueprints");
  const file = fileIdx >= 0 ? args[fileIdx + 1] : undefined;
  if (!file) throw new Error("--blueprints <file.json> (or --convex) is required");
  return JSON.parse(readFileSync(file, "utf8"));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--apply");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
  const cityIdx = args.indexOf("--city");
  const city = cityIdx >= 0 ? args[cityIdx + 1] : undefined;
  const outDir = args[args.indexOf("--out-dir") + 1] || "content/drafts/core30";

  if (!process.env.HARBOR_API_KEY) {
    console.error("HARBOR_API_KEY not set (source .env)");
    process.exit(1);
  }

  const blueprints = await loadBlueprints(args);
  const targets = blueprints
    .filter((b) => ["service", "location", "supporting", "core"].includes(b.archetype))
    .slice(0, limit)
    .map((b) => ({ ...b, city: b.locationData?.city || city }));

  if (dryRun) {
    console.log(`DRY RUN — ${targets.length} page(s) planned, 0 credits spent (--apply to generate)`);
    for (const bp of targets) {
      console.log(`  ${bp.archetype.padEnd(9)} ${toFilename(bp, bp.city)}  <- "${blueprintKeyword(bp, bp.city)}"`);
    }
    return;
  }

  const account = await api("/account");
  console.error(`plan=${account.plan} credits=${account.articles_remaining}/${account.articles_monthly_limit}`);
  mkdirSync(outDir, { recursive: true });
  const manifest = [];
  for (const bp of targets) {
    try {
      const r = await generate(bp, outDir);
      manifest.push(r);
      console.log(`  generated ${r.filename} (${r.bytes} chars)`);
    } catch (err) {
      manifest.push({ filename: toFilename(bp, bp.city), status: "failed", error: err.message });
      console.error(`  FAILED ${toFilename(bp, bp.city)}: ${err.message}`);
    }
  }
  writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));
  const ok = manifest.filter((m) => m.status === "completed").length;
  console.log(`done: ${ok}/${manifest.length} generated -> ${outDir}/ (manifest.json)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
