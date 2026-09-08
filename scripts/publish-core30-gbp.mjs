#!/usr/bin/env node
// Core 30 GBP publisher: read blueprints → Harbor generate → GBP publish.
// Completes the Core 30 loop: site pages (Harbor) + profile content (GBP API).
//
// Usage:
//   node scripts/publish-core30-gbp.mjs --dry-run
//   node scripts/publish-core30-gbp.mjs --apply --account-id <id> --location-id <id>
//   node scripts/publish-core30-gbp.mjs --apply --from-blueprint content/blueprints/client.json

import { readFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: new URL("../../.env", import.meta.url).pathname });

import { GBPAdapter } from "../src/lib/gbp.ts";

const HARBOR_API = process.env.HARBOR_API_URL || "https://outgoing-oyster-428.convex.site/v1";
const HARBOR_SITE_ID = process.env.HARBOR_SITE_ID;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");

  if (!process.env.GBP_ACCESS_TOKEN) {
    console.error("GBP_ACCESS_TOKEN not set (add to .env)");
    process.exit(1);
  }

  const gbp = new GBPAdapter({ accessToken: process.env.GBP_ACCESS_TOKEN });

  // 1. List accounts if not specified
  let accountId = args[args.indexOf("--account-id") + 1];
  let locationId = args[args.indexOf("--location-id") + 1];

  if (!accountId) {
    console.log("\n=== GBP Accounts ===");
    const accounts = await gbp.listAccounts();
    for (const a of accounts) {
      console.log(`  ${a.name} — ${a.accountName} (${a.type})`);
    }
    console.log("\nPass --account-id <name> to continue");
    return;
  }

  // 2. List locations if not specified
  if (!locationId) {
    console.log(`\n=== Locations for ${accountId} ===`);
    const locations = await gbp.listLocations(accountId);
    for (const loc of locations) {
      console.log(`  ${loc.name} — ${loc.locationName}`);
    }
    console.log("\nPass --location-id <name> to continue");
    return;
  }

  // 3. Load blueprints (from file or Convex)
  const blueprintFile = args[args.indexOf("--from-blueprint") + 1];
  let blueprints = [];

  if (blueprintFile) {
    blueprints = JSON.parse(readFileSync(blueprintFile, "utf-8"));
  } else {
    // TODO: Query Convex for pageBlueprint rows
    console.error("--from-blueprint required (Convex query not yet wired)");
    process.exit(1);
  }

  console.log(`\n=== Core 30 GBP Publishing ===`);
  console.log(`Account: ${accountId}`);
  console.log(`Location: ${locationId}`);
  console.log(`Blueprints: ${blueprints.length}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : apply ? "APPLY" : "PREVIEW"}`);

  // 4. For each blueprint: generate Harbor content → create GBP post
  for (const bp of blueprints) {
    console.log(`\n[${bp.archetype}] ${bp.slug}`);

    if (bp.archetype === "service") {
      // Generate a GBP post for each service page
      const keyword = bp.keywordCluster || bp.slug.split("/").pop()?.replace(/-/g, " ");
      const postContent = `${keyword} — We provide professional ${keyword?.toLowerCase()} services in ${bp.locationData?.city || "our service area"}. Call or book online today!`;

      console.log(`  Post: "${postContent.slice(0, 80)}..."`);

      if (apply) {
        const result = await gbp.createPost(accountId, locationId, {
          summary: postContent,
          topicType: "STANDARD",
          callToAction: {
            actionType: "CALL",
          },
        });
        console.log(`  ✓ Created post: ${result.name}`);
      } else {
        console.log(`  → Would create GBP post`);
      }
    }

    if (bp.archetype === "supporting") {
      // FAQ-style post
      const question = bp.slug.split("/").pop()?.replace(/-/g, " ") || "FAQ";
      const answer = "Check our website for detailed answers to common questions.";

      console.log(`  Q&A: "${question}"`);

      if (apply) {
        await gbp.createQuestion(accountId, locationId, question);
        console.log(`  ✓ Created Q&A`);
      } else {
        console.log(`  → Would create Q&A`);
      }
    }
  }

  // 5. Review reply sample (if reviews exist)
  if (apply) {
    console.log(`\n=== Review Replies ===`);
    const reviews = await gbp.listReviews(accountId, locationId, 5);
    console.log(`  Found ${reviews.length} recent reviews`);

    for (const r of reviews.slice(0, 2)) {
      if (!r.comment) {
        console.log(`  ${r.reviewer}: ${r.starRating} stars — thanking`);
        await gbp.replyToReview(
          accountId,
          locationId,
          r.name,
          `Thank you for the ${r.starRating.toLowerCase()} review! We appreciate your business.`
        );
      }
    }
  }

  console.log(`\n=== Done ===`);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
