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

// Default request timeout — bounds slow TREG/upstream requests so scoring,
// enrichment, and diagnostics can't hang until the runtime/network timeout.
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Shared timeout signal for all TREG fetches. One helper, one default.
 */
function timeoutSignal(timeoutMs = DEFAULT_TIMEOUT_MS) {
  return AbortSignal.timeout(timeoutMs);
}

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
 * Retries on 429/5xx with exponential backoff.
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

  const maxRetries = 3;
  // Serialize body once before the retry loop so deterministic
  // JSON.stringify failures aren't misclassified as network errors.
  let serializedBody;
  if (options.body) {
    try {
      serializedBody = JSON.stringify(options.body);
    } catch (err) {
      throw new Error(`treg: failed to serialize request body: ${err.message}`);
    }
  }

  const reqSignal = timeoutSignal();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response;
    try {
      response = await fetch(url.toString(), {
        method: options.method ?? (options.body ? "POST" : "GET"),
        headers,
        body: serializedBody,
        signal: reqSignal,
      });
    } catch (err) {
      // Network error — retry with backoff
      if (attempt < maxRetries) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      throw new Error(`treg network error: ${err.message}`);
    }

    // Retry on 429 and 5xx
    if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
      const retryAfter = response.headers.get("Retry-After");
      const delay = parseRetryAfter(retryAfter, 2 ** attempt * 1000);
      await sleep(delay);
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`treg API error ${response.status}: ${text}`);
    }

    return response.json();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse Retry-After header. Supports both delta-seconds and HTTP-date.
 * Caps at Node's max timer delay (2^31-1 ms) to avoid immediate-fire bug.
 */
function parseRetryAfter(header, fallbackMs) {
  const MAX_TIMER_MS = 2 ** 31 - 1;
  if (!header) return Math.min(fallbackMs, MAX_TIMER_MS);
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds) && /^[\d\s]+$/.test(header)) {
    return Math.min(seconds * 1000, MAX_TIMER_MS);
  }
  const date = new Date(header).getTime();
  if (!isNaN(date)) {
    return Math.min(Math.max(0, date - Date.now()), MAX_TIMER_MS);
  }
  return Math.min(fallbackMs, MAX_TIMER_MS);
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
    signal: timeoutSignal(),
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
    signal: timeoutSignal(),
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
    signal: timeoutSignal(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`treg balance error ${response.status}: ${text}`);
  }

  return response.json();
}

// Convenience namespace
export const catalog = { search: catalogSearch, get: catalogGet };
