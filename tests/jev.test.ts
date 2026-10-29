import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { choice, evaluate, isTrue, noul, pick, rate, score } from "../src/lib/jev";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    json: async () => body,
    headers: new Headers(headers),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "or-test-key");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe("question constructors", () => {
  it("builds typed question objects", () => {
    expect(noul("Urgent?", { true: "T", false: "F" })).toEqual({
      type: "noul",
      instructions: "Urgent?",
      criteria: { true: "T", false: "F" },
    });
    expect(noul("Plain?")).toEqual({ type: "noul", instructions: "Plain?", criteria: {} });
    expect(choice("Which?", { a: "A" })).toEqual({
      type: "choice",
      instructions: "Which?",
      criteria: { a: "A" },
    });
    expect(score("Rate?", ["low", "high"])).toEqual({
      type: "score",
      instructions: "Rate?",
      criteria: ["low", "high"],
    });
  });
});

describe("evaluate", () => {
  it("throws when OPENROUTER_API_KEY is missing", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(evaluate({ state: "s", questions: {} })).rejects.toThrow(
      "OPENROUTER_API_KEY not set in environment"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the normalized payload with bearer auth and a default model", async () => {
    const apiResult = {
      model: "m",
      answers: {},
      usage: { input_tokens: 1, output_tokens: 2 },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, apiResult));
    const result = await evaluate({
      state: "customer says hi",
      questions: { u: noul("Urgent?") },
    });
    expect(result).toEqual(apiResult);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer or-test-key");
    expect(JSON.parse(init.body as string)).toEqual({
      model: "~typesafe/jev-latest",
      state: "customer says hi",
      questions: {
        u: { type: "noul", instructions: "Urgent?", criteria: {} },
      },
    });
  });

  it("honors a custom model and object state", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { answers: {} }));
    await evaluate({
      state: { order: 42 },
      questions: {},
      model: "~typesafe/jev-v2",
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.model).toBe("~typesafe/jev-v2");
    expect(body.state).toEqual({ order: 42 });
  });

  it("retries a 429 honoring Retry-After and succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, "rate limited", { "Retry-After": "0" }))
      .mockResolvedValueOnce(jsonResponse(200, { answers: {} }));
    await expect(evaluate({ state: "s", questions: {} })).resolves.toEqual({ answers: {} });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces API errors without retrying 4xx", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, "bad key"));
    await expect(evaluate({ state: "s", questions: {} })).rejects.toThrow(
      "Jev API error 401: bad key"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-retryable network errors", async () => {
    const err = Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" });
    fetchMock.mockRejectedValueOnce(err);
    await expect(evaluate({ state: "s", questions: {} })).rejects.toThrow(
      "Jev network error (non-retryable): getaddrinfo ENOTFOUND"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws the abort reason when the caller already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled by caller"));
    await expect(
      evaluate({ state: "s", questions: {}, signal: controller.signal })
    ).rejects.toThrow("cancelled by caller");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates a mid-flight caller abort without retrying", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementationOnce(async () => {
      controller.abort();
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    });
    await expect(
      evaluate({ state: "s", questions: {}, signal: controller.signal })
    ).rejects.toThrow("The operation was aborted");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries transient network errors with backoff", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    fetchMock.mockRejectedValue(new Error("boom"));
    const promise = evaluate({ state: "s", questions: {} });
    const assertion = expect(promise).rejects.toThrow("Jev network error: boom");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("convenience wrappers", () => {
  const noulAnswer = { type: "noul", noul: 0.87 };
  const choiceAnswer = {
    type: "choice",
    choice: "billing",
    confidence: 0.9,
    probabilities: { billing: 0.9 },
  };
  const scoreAnswer = {
    type: "score",
    score: 2,
    confidence: 0.8,
    legend: { 1: "low", 2: "high" },
    probabilities: {},
  };

  function mockResult(answer: unknown) {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        model: "m",
        answers: { q: answer },
        usage: { input_tokens: 1, output_tokens: 1 },
      })
    );
  }

  it("isTrue unwraps the noul probability", async () => {
    mockResult(noulAnswer);
    await expect(isTrue("s", "Urgent?")).resolves.toBe(0.87);
  });

  it("isTrue returns 0 on an unexpected answer type", async () => {
    mockResult(choiceAnswer);
    await expect(isTrue("s", "Urgent?")).resolves.toBe(0);
  });

  it("pick unwraps the chosen option", async () => {
    mockResult(choiceAnswer);
    await expect(pick("s", "Which?", { billing: "B" })).resolves.toEqual({
      choice: "billing",
      confidence: 0.9,
      probabilities: { billing: 0.9 },
    });
  });

  it("pick throws on an unexpected answer type", async () => {
    mockResult(noulAnswer);
    await expect(pick("s", "Which?", { billing: "B" })).rejects.toThrow(
      "Unexpected answer type"
    );
  });

  it("rate unwraps the score with confidence and legend", async () => {
    mockResult(scoreAnswer);
    await expect(rate("s", "Rate?", ["low", "high"])).resolves.toEqual({
      score: 2,
      confidence: 0.8,
      legend: { 1: "low", 2: "high" },
    });
  });

  it("rate throws on an unexpected answer type", async () => {
    mockResult(noulAnswer);
    await expect(rate("s", "Rate?", ["low", "high"])).rejects.toThrow(
      "Unexpected answer type"
    );
  });
});
