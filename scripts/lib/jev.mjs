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
 * @param {object} req - { state: string|object, questions: {...}, model?: string }
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

  const response = await fetch(OPENROUTER_DECISIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: req.model || "~typesafe/jev-latest",
      state: req.state,
      questions,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Jev API error ${response.status}: ${text}`);
  }

  return response.json();
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
