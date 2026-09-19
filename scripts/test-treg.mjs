#!/usr/bin/env node
// Test treg connectivity and key endpoints.
//
// Usage:
//   node scripts/test-treg.mjs

import { call, hunterFindEmail, mozMetrics, mozBacklinksSummary, balance, catalogSearch } from "./lib/treg.mjs";

async function main() {
  console.error("Testing treg connectivity...\n");

  // 1. Check balance
  console.error("1. Checking balance...");
  try {
    const bal = await balance();
    console.log(`   Balance: $${bal.balance_usd.toFixed(2)}`);
    console.log(`   Spent today: $${bal.spent_today_usd.toFixed(4)}`);
    console.log(`   Spent this month: $${bal.spent_this_month_usd.toFixed(4)}`);
  } catch (err) {
    console.error(`   Error: ${err.message}`);
    process.exit(1);
  }

  // 2. Test Hunter email finder
  console.error("\n2. Testing Hunter email finder (example.com)...");
  try {
    const hunter = await hunterFindEmail("example.com");
    console.log(`   Domain: ${hunter.domain}`);
    console.log(`   Emails found: ${hunter.emails?.length ?? 0}`);
    if (hunter.emails?.[0]) {
      console.log(`   Example: ${hunter.emails[0].value} (${hunter.emails[0].type}, ${hunter.emails[0].confidence}% confidence)`);
    }
    console.log(`   Pattern: ${hunter.pattern || "none"}`);
  } catch (err) {
    console.error(`   Error: ${err.message}`);
  }

  // 3. Test Moz metrics (mozMetrics takes an array, returns array)
  console.error("\n3. Testing Moz metrics (moz.com)...");
  try {
    const moz = await mozMetrics(["moz.com"]);
    const m = moz[0];
    console.log(`   Domain Authority: ${m.domain_authority}`);
    console.log(`   Page Authority: ${m.page_authority}`);
    console.log(`   Spam Score: ${m.spam_score}`);
    console.log(`   Linking Domains: ${m.root_domains_to_root_domain}`);
  } catch (err) {
    console.error(`   Error: ${err.message}`);
  }

  // 4. Test Moz backlinks summary
  console.error("\n4. Testing Moz backlinks summary (moz.com)...");
  try {
    const links = await mozBacklinksSummary("moz.com");
    console.log(`   Backlinks: ${links.backlinks}`);
    console.log(`   Referring domains: ${links.referring_domains}`);
  } catch (err) {
    console.error(`   Error: ${err.message}`);
  }

  // 5. Test catalog search
  console.error("\n5. Testing catalog search...");
  try {
    const tools = await catalogSearch("email finder");
    console.log(`   Found ${tools.length} tools for "email finder"`);
    if (tools[0]) {
      console.log(`   Top: ${tools[0].id} — $${tools[0].price_per_call?.toFixed(4)}/call`);
    }
  } catch (err) {
    console.error(`   Error: ${err.message}`);
  }

  console.error("\n✓ treg connectivity verified!");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
