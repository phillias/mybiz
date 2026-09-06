#!/usr/bin/env node
// AEO citation trend analysis.
// Compares latest measurement to historical baseline.
//
// Usage:
//   node scripts/aeo-trend.mjs                    # compare latest to previous
//   node scripts/aeo-trend.mjs --baseline 2026-09-01 --latest 2026-09-08

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MEASUREMENTS_DIR = join(ROOT, "content", "aeo-measurements");

function loadMeasurements() {
  if (!existsSync(MEASUREMENTS_DIR)) return [];
  
  return readdirSync(MEASUREMENTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const data = JSON.parse(readFileSync(join(MEASUREMENTS_DIR, f), "utf8"));
      return { date: f.replace(".json", ""), ...data };
    });
}

function trend(latest, baseline) {
  const diff = latest.summary.rate - baseline.summary.rate;
  const pctChange = baseline.summary.rate > 0 
    ? ((latest.summary.rate - baseline.summary.rate) / baseline.summary.rate) * 100 
    : 0;
  
  return {
    latestDate: latest.date,
    baselineDate: baseline.date,
    latestRate: latest.summary.rate,
    baselineRate: baseline.summary.rate,
    absoluteDiff: diff,
    pctChange,
    direction: diff > 0.01 ? "up" : diff < -0.01 ? "down" : "flat",
  };
}

function main() {
  const args = process.argv.slice(2);
  const measurements = loadMeasurements();
  
  if (measurements.length === 0) {
    console.log("No measurements found. Run aeo-measure.mjs first.");
    process.exit(0);
  }

  let baseline, latest;

  const baselineIdx = args.indexOf("--baseline");
  const latestIdx = args.indexOf("--latest");

  if (baselineIdx >= 0 && latestIdx >= 0) {
    baseline = measurements.find((m) => m.date === args[baselineIdx + 1]);
    latest = measurements.find((m) => m.date === args[latestIdx + 1]);
  } else {
    latest = measurements[measurements.length - 1];
    baseline = measurements[measurements.length - 2] || latest;
  }

  if (!baseline || !latest) {
    console.error("Could not find specified measurements");
    process.exit(1);
  }

  const t = trend(latest, baseline);
  
  console.log("\n=== AEO CITITION TREND ===");
  console.log(`\nBaseline: ${t.baselineDate} — ${(t.baselineRate * 100).toFixed(1)}%`);
  console.log(`Latest:   ${t.latestDate} — ${(t.latestRate * 100).toFixed(1)}%`);
  console.log(`\nChange:   ${t.absoluteDiff >= 0 ? "+" : ""}${(t.absoluteDiff * 100).toFixed(1)}pp (${t.pctChange >= 0 ? "+" : ""}${t.pctChange.toFixed(1)}%)`);
  console.log(`Trend:    ${t.direction.toUpperCase()}`);
  
  // Engine breakdown
  console.log("\n=== BY ENGINE ===");
  for (const engine of Object.keys(latest.engines)) {
    const l = latest.engines[engine];
    const b = baseline.engines[engine];
    if (!b) continue;
    const engineDiff = l.rate - b.rate;
    console.log(`${engine}: ${(l.rate * 100).toFixed(1)}% (${engineDiff >= 0 ? "+" : ""}${(engineDiff * 100).toFixed(1)}pp)`);
  }
}

main();
