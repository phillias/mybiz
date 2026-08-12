#!/usr/bin/env node
// Pipeline glue: demand signal -> niche gate (DataForSEO) -> Harbor generation.
//
//   node scripts/run-pipeline.mjs --auto           # top PROCEED signal
//   node scripts/run-pipeline.mjs --keyword "<kw>"  # specific keyword
//
// Gate: checkNiche verdict must be PASS (sponsored==0, no map-pack, >=3
// related-search clusters); otherwise it exits without spending a credit.
// On PASS it calls scripts/generate-article.mjs (saves draft to content/drafts/).

import { execFileSync } from "node:child_process";

const PROD = ["--prod"];

function convex(fn, args) {
  return JSON.parse(
    execFileSync("npx", ["convex", "run", ...PROD, fn, JSON.stringify(args)], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "inherit"],
    }),
  );
}

function main() {
  const args = process.argv.slice(2);
  const kwIdx = args.indexOf("--keyword");
  const keyword = kwIdx >= 0 ? args[kwIdx + 1] : null;

  let target = keyword;
  if (!target) {
    const rows = convex("demandSignals:listProceed", { limit: 1 });
    target = rows[0]?.keyword;
    if (target) console.error(`pipeline: picked signal "${target}"`);
  }
  if (!target) {
    console.error("pipeline: no PROCEED signal found (run harvest first)");
    process.exit(1);
  }

  const niche = convex("actions/checkNiche:checkNiche", { keyword: target });
  console.error(
    `pipeline: checkNiche -> ${niche.verdict} (sponsored=${niche.sponsoredCount}, mapPack=${niche.mapPack}, longTail=${niche.longTailClusters})`,
  );
  if (niche.verdict !== "PASS") {
    console.error("pipeline: niche FAIL — not generating (no credit spent)");
    process.exit(1);
  }

  const gen = execFileSync("node", ["scripts/generate-article.mjs", "--keyword", target], {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
  });
  console.log(gen);
}

try {
  main();
} catch (err) {
  console.error(`pipeline: ${err.message}`);
  process.exit(1);
}
