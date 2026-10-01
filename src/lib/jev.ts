// Jev client for TypeSafe's System One model via OpenRouter Decisions API.
// Outputs only structured decisions (no prose) with calibrated probabilities.
//
// Usage:
//   import { evaluate, noul, choice, score } from "../lib/jev";
//   
//   const result = await evaluate({
//     state: "Customer email: 'My payouts have been failing for 3 days!'",
//     questions: {
//       urgency: noul("Does this require immediate attention?", {
//         true: "Time-sensitive",
//         false: "Not urgent"
//       }),
//       department: choice("Which team?", {
//         billing: "Payments, invoices",
//         technical: "Bugs, outages",
//         sales: "Pricing, upgrades"
//       }),
//       sentiment: score("Customer frustration level?", ["Calm", "Frustrated", "Angry"])
//     }
//   });
//
// Requires OPENROUTER_API_KEY in environment.

const OPENROUTER_DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

// Default request timeout — bounds a slow/stalled OpenRouter request so
// callers (Convex actions, server routes) can't hang indefinitely.
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Combine the caller's AbortSignal (if any) with a default timeout into one
 * signal. Either firing aborts the fetch; caller aborts propagate as-is.
 */
function combinedSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
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
function isNonRetryableNetworkError(err: any): boolean {
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return true;
  const code = err?.cause?.code ?? err?.code;
  return code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "EAI_AGAIN";
}

// Question types — all use 'criteria'
export interface NoulQuestion {
  type: "noul";
  instructions: string;
  criteria: { true?: string; false?: string };
}

export interface ChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
}

export interface ScoreQuestion {
  type: "score";
  instructions: string;
  criteria: string[];
}

export type JevQuestion = NoulQuestion | ChoiceQuestion | ScoreQuestion;

// Helper constructors
export function noul(
  instructions: string,
  criteria: { true?: string; false?: string } = {}
): NoulQuestion {
  return { type: "noul", instructions, criteria };
}

export function choice(instructions: string, criteria: Record<string, string>): ChoiceQuestion {
  return { type: "choice", instructions, criteria };
}

export function score(instructions: string, criteria: string[]): ScoreQuestion {
  return { type: "score", instructions, criteria };
}

export interface JevRequest {
  state: string | object;
  questions: Record<string, JevQuestion>;
  model?: string;
  /** Caller-provided cancellation signal (aborts propagate, no retry). */
  signal?: AbortSignal;
  /** Per-request timeout override in ms (default 30s). */
  timeoutMs?: number;
}

export interface NoulAnswer {
  type: "noul";
  noul: number;
}

export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface ScoreAnswer {
  type: "score";
  score: number;
  confidence: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
}

export type JevAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export interface JevResult {
  model: string;
  answers: Record<string, JevAnswer>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY not set in environment");
  }
  return key;
}

/**
 * Evaluate state against multiple questions in parallel.
 * All questions see the same state; each is evaluated independently.
 * Returns calibrated probabilities and confidence scores.
 */
export async function evaluate(req: JevRequest): Promise<JevResult> {
  const apiKey = getApiKey();

  // Build request payload — criteria for all question types
  const questions: Record<string, any> = {};
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
    let response: Response;
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
    } catch (err: any) {
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

  // Unreachable — loop either returns or throws — but TS needs it
  throw new Error("Jev: exhausted retries without response");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse Retry-After header. Supports both delta-seconds and HTTP-date.
 * Caps at the request timeout (a longer server-directed delay is treated
 * as fail-fast: we don't park the process for an hour on one 429) and at
 * Node's max timer delay (2^31-1 ms) to avoid the immediate-fire bug.
 */
function parseRetryAfter(header: string | null, fallbackMs: number, requestTimeoutMs: number = fallbackMs): number {
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
export async function isTrue(
  state: string | object,
  instructions: string,
  criteria: { true?: string; false?: string } = {}
): Promise<number> {
  const result = await evaluate({
    state,
    questions: { q: noul(instructions, criteria) },
  });
  return result.answers.q.type === "noul" ? result.answers.q.noul : 0;
}

/**
 * Convenience: evaluate a single choice question.
 * Returns the selected option with confidence and full distribution.
 */
export async function pick(
  state: string | object,
  instructions: string,
  criteria: Record<string, string>
): Promise<{ choice: string; confidence: number; probabilities: Record<string, number> }> {
  const result = await evaluate({
    state,
    questions: { q: choice(instructions, criteria) },
  });
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
 * Returns the score position with confidence and legend.
 */
export async function rate(
  state: string | object,
  instructions: string,
  criteria: string[]
): Promise<{ score: number; confidence: number; legend: Record<string, string> }> {
  const result = await evaluate({
    state,
    questions: { q: score(instructions, criteria) },
  });
  if (result.answers.q.type === "score") {
    return {
      score: result.answers.q.score,
      confidence: result.answers.q.confidence,
      legend: result.answers.q.legend,
    };
  }
  throw new Error("Unexpected answer type");
}
