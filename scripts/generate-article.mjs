#!/usr/bin/env node
// Generate an SEO article via the Harbor API (harborseo.ai) for the commercial
// site (codevex.app since the 2026-08-24 cutover), saving the finished HTML to
// a drafts dir. This is the "generate" stage
// of the U3/U4 pipeline: demandSignal PROCEED -> keyword -> article draft.
//
// Usage:
//   node scripts/generate-article.mjs --keyword "ai seo content for agencies"
//   node scripts/generate-article.mjs --keyword "..." --out content/drafts/my.md
//   node scripts/generate-article.mjs --dry-run        # check credits, no generation
//
// Requires HARBOR_API_KEY in the environment (.env). Consumes 1 article credit
// per generation (research is free). Failed jobs refund automatically.

import { mkdirSync, writeFileSync } from "node:fs";

const API = "https://outgoing-oyster-428.convex.site/v1";
// INTENTIONAL (2026-08-24 cutover): this Harbor site id was registered against
// phillias.us pre-cutover and stays the default until codevex.app is live and
// re-registered — see docs/codevex-migration-runbook.md §Harbor. Override with HARBOR_SITE_ID.
const SITE_ID = process.env.HARBOR_SITE_ID || "nd7amxhtnt94bx5er1ygvm4rbx8c97yz";

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { authorization: `Bearer ${process.env.HARBOR_API_KEY}`, ...(opts.headers || {}) },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Harbor ${res.status}: ${body?.error?.message ?? JSON.stringify(body).slice(0, 200)}`);
  return body;
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const outIdx = args.indexOf("--out");
  const out = outIdx >= 0 ? args[outIdx + 1] : undefined;
  const kwIdx = args.indexOf("--keyword");
  const keyword = kwIdx >= 0 ? args[kwIdx + 1] : undefined;

  if (!process.env.HARBOR_API_KEY) {
    console.error("HARBOR_API_KEY not set (source .env)");
    process.exit(1);
  }
  if (!keyword) {
    console.error("--keyword <phrase> is required");
    process.exit(1);
  }

  const account = await api("/account");
  console.error(`plan=${account.plan} credits_remaining=${account.articles_remaining}/${account.articles_monthly_limit}`);

  if (dryRun) return;

  const job = await api("/articles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ site_id: SITE_ID, keywords: keyword }),
  });
  console.error(`job ${job.id} -> ${job.status}`);

  let article = job;
  for (let i = 0; i < 20; i++) {
    article = await api(`/articles/${job.id}?wait=true`);
    if (article.status === "completed" || article.status === "failed") break;
  }
  if (article.status !== "completed") {
    console.error(`job ended ${article.status}: ${JSON.stringify(article).slice(0, 300)}`);
    process.exit(1);
  }

  const content = article.content ?? article.html ?? "";
  const dest = out ?? `content/drafts/${slug(keyword)}.html`;
  mkdirSync("content/drafts", { recursive: true });
  writeFileSync(dest, content);
  console.log(`saved ${content.length} chars -> ${dest}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
