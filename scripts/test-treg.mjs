#!/usr/bin/env node
// Test treg connectivity and key endpoints.
//
// Usage:
//   node scripts/test-treg.mjs

import { call, hunterFindEmail, mozMetrics, mozBacklinks, balance, catalogSearch } from "./lib/treg.mjs";

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

  // 3. Test Moz metrics
  console.error("\n3. Testing Moz metrics (moz.com)...");
  try {
    const moz = await mozMetrics("moz.com");
    console.log(`   Domain Authority: ${moz.domain_authority}`);
    console.log(`   Page Authority: ${moz.page_authority}`);
    console.log(`   Spam Score: ${moz.spam_score}`);
    console.log(`   Linking Domains: ${moz.linking_domains}`);
  } catch (err) {
    console.error(`   Error: ${err.message}`);
  }

  // 4. Test Moz backlinks (limited)
  console.error("\n4. Testing Moz backlinks (moz.com, limit 5)...");
  try {
    const links = await mozBacklinks("moz.com", 5);
    console.log(`   Total backlinks: ${links.total}`);
    if (links.backlinks?.[0]) {
      console.log(`   Top link: ${links.backlinks[0].source}`);
      console.log(`   Anchor: "${links.backlinks[0].anchor}"`);
      console.log(`   DA: ${links.backlinks[0].domain_authority}`);
    }
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
