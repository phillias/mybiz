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
