// Jev client for CLI scripts — pure ESM JavaScript.
// Loads .env manually since scripts run outside Astro/Convex context.
//
// Usage:
//   import { evaluate, noul, choice, score } from "./lib/jev.mjs";
//
// Requires OPENROUTER_API_KEY in .env or environment.

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

const OPENROUTER_DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

// Default request timeout — bounds a slow/stalled OpenRouter request so CLI
// workflows (jev-prospect, test-jev, debug-jev) can't hang indefinitely.
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Combine the caller's AbortSignal (if any) with a default timeout into one
 * signal. Caller signal aborts take precedence (either firing aborts fetch).
 */
function combinedSignal(signal, timeoutMs) {
  if (signal) {
    return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  }
  return AbortSignal.timeout(timeoutMs);
}

/**
 * Non-transient network errors — retrying them wastes latency on a
 * hopeless request (DNS can't resolve, nothing is listening, or the
 * request timed out and the caller wants control back).
 */
function isNonRetryableNetworkError(err) {
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return true;
  const code = err?.cause?.code ?? err?.code;
  return code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "EAI_AGAIN";
}

function getApiKey() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set (add to .env or export)");
  return key;
}

/**
 * Create a noul (boolean probability) question.
 * criteria is an object { true: "desc", false: "desc" }
 */
export function noul(instructions, criteria = {}) {
  return { type: "noul", instructions, criteria };
}

/**
 * Create a choice question.
 * criteria is an object { optionKey: "description", ... }
 */
export function choice(instructions, criteria) {
  return { type: "choice", instructions, criteria };
}

/**
 * Create a score question.
 * criteria is an array of level labels.
 */
export function score(instructions, criteria) {
  return { type: "score", instructions, criteria };
}

/**
 * Evaluate state against multiple questions in parallel.
 * All questions see the same state; each evaluated independently.
 * Returns calibrated probabilities and confidence scores.
 *
 * @param {object} req - { state: string|object, questions: {...}, model?: string, signal?: AbortSignal, timeoutMs?: number }
 * @returns {Promise<object>} - { model, answers, usage }
 */
export async function evaluate(req) {
  const apiKey = getApiKey();

  // Questions use 'criteria' for all types
  const questions = {};
  for (const [id, q] of Object.entries(req.questions)) {
    questions[id] = {
      type: q.type,
      instructions: q.instructions,
      criteria: q.criteria,
    };
  }

  const maxRetries = 3;
  // Serialize body once before the retry loop so deterministic
  // JSON.stringify failures aren't misclassified as network errors.
  const serializedBody = JSON.stringify({
    model: req.model || "~typesafe/jev-latest",
    state: req.state,
    questions,
  });

  // Fail fast if the caller already cancelled before we started.
  if (req.signal?.aborted) throw req.signal.reason ?? new Error("Jev: aborted before request");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response;
    try {
      response = await fetch(OPENROUTER_DECISIONS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: serializedBody,
        signal: combinedSignal(req.signal, req.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (err) {
      // Caller-initiated aborts are never retried — propagate immediately.
      if (req.signal?.aborted) throw err;
      // Timeouts and non-transient failures (DNS, connection refused) are
      // hopeless to retry — surface them without burning the backoff budget.
      if (isNonRetryableNetworkError(err)) {
        throw new Error(`Jev network error (non-retryable): ${err.message ?? err}`);
      }
      if (attempt < maxRetries) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      throw new Error(`Jev network error: ${err.message}`);
    }

    // Retry on 429 and 5xx — cap the delay so a huge Retry-After can't
    // outlast the request timeout by orders of magnitude.
    if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
      const retryAfter = response.headers.get("Retry-After");
      const delay = parseRetryAfter(
        retryAfter,
        2 ** attempt * 1000,
        req.timeoutMs ?? DEFAULT_TIMEOUT_MS
      );
      await sleep(delay);
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jev API error ${response.status}: ${text}`);
    }

    return response.json();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse Retry-After header. Supports both delta-seconds and HTTP-date.
 * Caps at the request timeout (a longer server-directed delay is treated
 * as fail-fast: we don't park the process for an hour on one 429) and at
 * Node's max timer delay (2^31-1 ms) to avoid the immediate-fire bug.
 */
function parseRetryAfter(header, fallbackMs, requestTimeoutMs = fallbackMs) {
  const MAX_TIMER_MS = 2 ** 31 - 1;
  const cap = Math.min(requestTimeoutMs, MAX_TIMER_MS);
  if (!header) return Math.min(fallbackMs, cap);
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds) && /^[\d\s]+$/.test(header)) {
    return Math.min(seconds * 1000, cap);
  }
  const date = new Date(header).getTime();
  if (!isNaN(date)) {
    return Math.min(Math.max(0, date - Date.now()), cap);
  }
  return Math.min(fallbackMs, cap);
}

/**
 * Convenience: evaluate a single boolean question.
 * Returns the probability (0-1) that the statement is true.
 */
export async function isTrue(state, instructions, criteria = {}) {
  const result = await evaluate({ state, questions: { q: noul(instructions, criteria) } });
  return result.answers.q.type === "noul" ? result.answers.q.noul : 0;
}

/**
 * Convenience: evaluate a single choice question.
 * Returns { choice, confidence, probabilities }.
 */
export async function pick(state, instructions, criteria) {
  const result = await evaluate({ state, questions: { q: choice(instructions, criteria) } });
  if (result.answers.q.type === "choice") {
    return {
      choice: result.answers.q.choice,
      confidence: result.answers.q.confidence,
      probabilities: result.answers.q.probabilities,
    };
  }
  throw new Error("Unexpected answer type");
}

/**
 * Convenience: evaluate a single score question.
 * Returns { score, confidence, legend }.
 */
export async function rate(state, instructions, criteria) {
  const result = await evaluate({ state, questions: { q: score(instructions, criteria) } });
  if (result.answers.q.type === "score") {
    return {
      score: result.answers.q.score,
      confidence: result.answers.q.confidence,
      legend: result.answers.q.legend,
    };
  }
  throw new Error("Unexpected answer type");
}
