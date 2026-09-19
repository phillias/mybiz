// treg client for CLI scripts — pure ESM JavaScript.
// Loads .env manually since scripts run outside Astro/Convex context.
//
// Usage:
//   import { call, hunter, moz } from "./lib/treg.mjs";
//
// Requires TREG_TOKEN in .env or environment.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env if present
const __scriptDir = dirname(fileURLToPath(import.meta.url));
const envPath = pathResolve(__scriptDir, "..", "..", ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq > 0) {
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const TREG_BASE_URL = "https://treg.to";

function getToken() {
  // Try TREG_TOKEN first, then check file path from .zshrc pattern
  let key = process.env.TREG_TOKEN;
  if (!key) {
    const tokenPath = process.env.TREG_TOKEN_PATH || `${process.env.HOME}/.agents/keys/default/.treg-token`;
    if (existsSync(tokenPath)) {
      key = readFileSync(tokenPath, "utf8").trim();
    }
  }
  if (!key) throw new Error("TREG_TOKEN not set (add to .env or export)");
  return key;
}

/**
 * Call a treg catalog endpoint or proxy a URL with credential injection.
 */
export async function call(endpoint, options = {}) {
  const token = getToken();

  const url = new URL(`${TREG_BASE_URL}/call/${endpoint}`);

  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      url.searchParams.append(k, String(v));
    }
  }

  const headers = {
    "X-Treg-Token": token,
    "Content-Type": "application/json",
  };

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  if (options.meta) {
    const metaStr = Object.entries(options.meta)
      .slice(0, 5)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    headers["X-Treg-Meta"] = metaStr;
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`treg API error ${response.status}: ${text}`);
  }

  return response.json();
}

/**
 * Hunter — find emails for a company domain.
 */
export async function hunterFindEmail(domain, limit = 5) {
  const result = await call("hunter.companies.emails", { query: { domain, limit } });
  return result.data;
}

/**
 * Moz — get URL metrics (DA/PA/spam).
 */
export async function mozMetrics(targets) {
  const result = await call("moz.web.url.metrics", {
    method: "POST",
    body: { targets },
  });
  return result.results;
}

/**
 * Moz — get backlinks summary.
 */
export async function mozBacklinksSummary(target) {
  return call("moz.web.backlinks.summary", { query: { target } });
}

/**
 * Search catalog by capability.
 */
export async function catalogSearch(query) {
  const token = getToken();

  const response = await fetch(`${TREG_BASE_URL}/catalog/search?q=${encodeURIComponent(query)}`, {
    headers: { "X-Treg-Token": token },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`treg catalog error ${response.status}: ${text}`);
  }

  return response.json();
}

/**
 * Get endpoint details.
 */
export async function catalogGet(endpointId) {
  const token = getToken();

  const response = await fetch(`${TREG_BASE_URL}/catalog/${endpointId}`, {
    headers: { "X-Treg-Token": token },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`treg catalog error ${response.status}: ${text}`);
  }

  return response.json();
}

/**
 * Check balance.
 */
export async function balance() {
  const token = getToken();

  const response = await fetch(`${TREG_BASE_URL}/balance`, {
    headers: { "X-Treg-Token": token },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`treg balance error ${response.status}: ${text}`);
  }

  return response.json();
}

// Convenience namespace
export const catalog = { search: catalogSearch, get: catalogGet };
