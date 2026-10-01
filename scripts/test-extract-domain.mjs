// Regression test for extractDomain in scripts/lib/treg-enrich.mjs
// (CodeRabbit PR #41: port/query strings must not leak into Hunter domains)
//
// Run: node scripts/test-extract-domain.mjs

import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./lib/treg-enrich.mjs", import.meta.url), "utf8");
const match = src.match(/^function extractDomain\(website\) \{[\s\S]*?^\}/m);
if (!match) {
  console.error("extractDomain not found in treg-enrich.mjs — test needs updating");
  process.exit(2);
}
// The function is module-private; evaluate the matched source standalone.
// It has no free variables besides globals, so this is safe.
const extractDomain = new Function(`${match[0]}; return extractDomain;`)();

const cases = [
  ["https://www.example.com/path?q=1", "example.com"],
  ["http://example.com:8443/path", "example.com"],
  ["example.com:8443", "example.com"],
  ["www.foo.bar/baz", "foo.bar"],
  ["example.com?q=x", "example.com"],
  ["https://Sub.Domain.IO/", "sub.domain.io"],
  ["", null],
  [null, null],
  ["not a url at all", null],
];

let failed = 0;
for (const [input, want] of cases) {
  const got = extractDomain(input);
  if (got !== want) {
    console.error(`FAIL ${JSON.stringify(input)} -> ${JSON.stringify(got)} (want ${JSON.stringify(want)})`);
    failed++;
  } else {
    console.log(`PASS ${JSON.stringify(input)} -> ${JSON.stringify(got)}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} cases passed`);
