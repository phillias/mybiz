#!/usr/bin/env node
// Prospect Radar — rank local businesses by SEO opportunity (the prospect-side
// analogue of tool.rankexpand.com's niche validator). Scores each business
// 0-100 from website thinness, page speed, review deficit, map-pack/SERP
// presence, and an optional authority placeholder. See
// docs/plans/2026-08-16-004-prospect-radar-leadgen.md.
//
// Usage:
//   node scripts/prospect-score.mjs --city <city> --category <category> [options]
//   node scripts/prospect-score.mjs --fixture <file.json> [options]
//
// Options:
//   --city <city>      target city (required unless --fixture)
//   --category <cat>   service category (required unless --fixture)
//   --limit N          cap the ranked list (default: all)
//   --fixture <file>   score synthetic/cached prospects offline (no network)
//   --out-dir <dir>    output dir (default: $PROSPECT_OUT_DIR or content/prospects)
//   --apply            spend DataForSEO credits: Maps discovery (STUB) + SERP
//                      gate + free enrichment (crawl, PageSpeed). Dry-run by
//                      default.
//   --help             this text
//
// Dry-run never touches the network. With --city/--category and no --apply it
// reuses the last scored JSON as a discovery cache, or fails with a hint.
// Outputs <out>/<city>-<category>.json (full ranked set, doubles as cache)
// and .tsv (top-N). Requires DATAFORSEO_API_KEY (base64 email:password) from
// .env for --apply.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { scoreProspect, slugify, hasWebsite } from "./lib/scoring.mjs";
import { discoverBusinesses, fetchSerp, inPack } from "./lib/dataforseo.mjs";
import { crawlWebsite, fetchPageSpeed } from "./lib/enrich.mjs";

const USAGE = `Prospect Radar — rank local businesses by SEO opportunity (0-100).

Usage:
  node scripts/prospect-score.mjs --city <city> --category <category> [options]
  node scripts/prospect-score.mjs --fixture <file.json> [options]

Options:
  --city <city>      target city (required unless --fixture)
  --category <cat>   service category (required unless --fixture)
  --limit N          cap the ranked list (default: all)
  --fixture <file>   score synthetic/cached prospects offline (no network)
  --out-dir <dir>    output dir (default: \$PROSPECT_OUT_DIR or content/prospects)
  --apply            spend DataForSEO credits: Maps discovery (STUB) + SERP
                     gate + free enrichment (crawl, PageSpeed). Dry-run by default.
  --help             this text

Dry-run never touches the network. With --city/--category and no --apply it
reuses the last scored JSON as a discovery cache, or fails with a hint.`;

const TSV_HEADERS = [
  "opportunity", "name", "category", "city", "website", "phone",
  "pages", "words", "review_count", "rating",
  "in_map_pack", "sponsored_count", "long_tail_clusters",
  "w_website", "w_speed", "w_reviews", "w_serp", "w_authority",
];

function flag(args, name) {
  return args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] : undefined;
}

async function enrichAll({ prospects, category, city, apiKey }) {
  let serp = null;
  try {
    serp = await fetchSerp({ apiKey, keyword: `${category} ${city}` });
  } catch (err) {
    console.error(`serp gate skipped: ${err.message}`);
  }
  const out = new Array(prospects.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < prospects.length) {
      const i = cursor++;
      const p = { ...prospects[i], category, city };
      if (hasWebsite(p)) {
        try {
          Object.assign(p, await crawlWebsite(p.website));
        } catch (err) {
          console.error(`crawl skip ${p.name}: ${err.message}`);
        }
        try {
          p.pagespeed = await fetchPageSpeed(p.website);
        } catch (err) {
          console.error(`psi skip ${p.name}: ${err.message}`);
        }
      }
      if (serp) p.serp = { ...serp, inPack: inPack(serp.packDomains, p.website) };
      out[i] = p;
    }
  };
  await Promise.all([...Array(4)].map(worker));
  return out;
}

function esc(v) {
  return String(v ?? "").replace(/\t/g, " ").replace(/\r|\n/g, " ");
}

function r3(n) {
  return Math.round((n ?? 0) * 1000) / 1000;
}

function toTsv(rows) {
  const lines = [TSV_HEADERS.map(esc).join("\t")];
  for (const p of rows) {
    lines.push(
      [
        p.sub.opportunity, p.name, p.category, p.city, p.website, p.phone,
        p.pages ?? "", p.words ?? "", p.reviewCount ?? "", p.rating ?? "",
        p.serp?.inPack ?? "", p.serp?.sponsoredCount ?? "", p.serp?.longTailClusters ?? "",
        p.sub.website, r3(p.sub.speed), r3(p.sub.reviews), r3(p.sub.serp), r3(p.sub.authority),
      ].map(esc).join("\t"),
    );
  }
  return lines.join("\n") + "\n";
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    process.stderr.write(USAGE + "\n");
    process.exit(1);
  }
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(USAGE + "\n");
    return;
  }

  const apply = args.includes("--apply");
  const fixtureFile = flag(args, "--fixture");
  const city = flag(args, "--city");
  const category = flag(args, "--category");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 0;
  const outDirIdx = args.indexOf("--out-dir");
  const outDir = outDirIdx >= 0 ? args[outDirIdx + 1] : process.env.PROSPECT_OUT_DIR || "content/prospects";

  let runCity = city;
  let runCat = category;
  let prospects = [];

  if (fixtureFile) {
    const data = JSON.parse(readFileSync(fixtureFile, "utf8"));
    runCity = data.city ?? city;
    runCat = data.category ?? category;
    prospects = (data.prospects ?? []).map((p) => ({ ...p, city: runCity, category: runCat }));
  } else if (runCity && runCat) {
    const cache = `${outDir}/${slugify(runCity)}-${slugify(runCat)}.json`;
    if (apply) {
      const apiKey = process.env.DATAFORSEO_API_KEY;
      if (!apiKey) throw new Error("DATAFORSEO_API_KEY not set (source .env)");
      prospects = await discoverBusinesses({ apiKey, category: runCat, city: runCity, limit: limit || 20 });
      console.error(`discovery: ${prospects.length} businesses for "${runCat} ${runCity}"`);
      prospects = await enrichAll({ prospects, category: runCat, city: runCity, apiKey });
    } else if (existsSync(cache)) {
      prospects = JSON.parse(readFileSync(cache, "utf8")).prospects ?? [];
      console.error(`reusing cached discovery ${cache}`);
    } else {
      throw new Error(
        `no prospect data for "${runCat} ${runCity}" — pass --fixture <file> or run --apply (spends DataForSEO credits)`,
      );
    }
  } else {
    throw new Error("need --city + --category, or --fixture <file> (see --help)");
  }

  if (prospects.length === 0) throw new Error("no prospects to score");
  runCity = runCity ?? "unknown";
  runCat = runCat ?? "unknown";

  const scored = prospects.map((p) => ({ ...p, sub: scoreProspect(p) }));
  scored.sort((a, b) => b.sub.opportunity - a.sub.opportunity);
  const top = limit > 0 ? scored.slice(0, limit) : scored;

  mkdirSync(outDir, { recursive: true });
  const base = `${outDir}/${slugify(runCity)}-${slugify(runCat)}`;
  writeFileSync(`${base}.tsv`, toTsv(top));
  writeFileSync(
    `${base}.json`,
    JSON.stringify(
      {
        city: runCity,
        category: runCat,
        generatedAt: new Date().toISOString(),
        dryRun: !apply,
        prospects: scored,
      },
      null,
      2,
    ),
  );

  console.error(`${apply ? "APPLY" : "DRY RUN"} — ${top.length} prospects scored -> ${base}.tsv / .json`);
  for (const p of top) {
    console.log(
      `${String(p.sub.opportunity).padStart(3)}  ${(p.name ?? "").padEnd(30)}  ${p.website || "(no website)"}`,
    );
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
