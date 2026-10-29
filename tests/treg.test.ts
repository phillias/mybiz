import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  balance,
  call,
  catalog,
  catalogGet,
  catalogSearch,
  hunterFindEmail,
  mozBacklinksSummary,
  mozMetrics,
} from "../src/lib/treg";

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

function lastCall(): { url: URL; init: RequestInit } {
  const [rawUrl, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url: new URL(rawUrl as string), init: init as RequestInit };
}

beforeEach(() => {
  vi.stubEnv("TREG_TOKEN", "test-token");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe("call", () => {
  it("throws when TREG_TOKEN is missing", async () => {
    vi.stubEnv("TREG_TOKEN", "");
    await expect(call("hunter.companies.emails")).rejects.toThrow(
      "TREG_TOKEN not set in environment"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("builds URL and headers and defaults to GET", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const result = await call("hunter.companies.emails", {
      query: { domain: "example.com", limit: 5 },
    });
    expect(result).toEqual({ ok: true });
    const { url, init } = lastCall();
    expect(url.toString()).toBe(
      "https://treg.to/call/hunter.companies.emails?domain=example.com&limit=5"
    );
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Treg-Token"]).toBe("test-token");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("serializes the body once and defaults to POST", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { results: [] }));
    await call("moz.web.url.metrics", { body: { targets: ["a.com"] } });
    const { init } = lastCall();
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ targets: ["a.com"] }));
  });

  it("sends the idempotency key and caps meta at 5 pairs", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await call("some.endpoint", {
      idempotencyKey: "idem-1",
      meta: { a: "1", b: "2", c: "3", d: "4", e: "5", f: "6" },
    });
    const headers = lastCall().init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("idem-1");
    expect(headers["X-Treg-Meta"]).toBe("a=1, b=2, c=3, d=4, e=5");
  });

  it("throws before any request when the body cannot be serialized", async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(call("some.endpoint", { body: circular })).rejects.toThrow(
      "treg: failed to serialize request body"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries a 429 honoring Retry-After and succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, "slow down", { "Retry-After": "0" }))
      .mockResolvedValueOnce(jsonResponse(200, { recovered: true }));
    await expect(call("some.endpoint")).resolves.toEqual({ recovered: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("exhausts retries on a persistent 429 and throws the API error", async () => {
    for (let i = 0; i < 4; i++) {
      fetchMock.mockResolvedValueOnce(jsonResponse(429, "quota", { "Retry-After": "0" }));
    }
    await expect(call("some.endpoint")).rejects.toThrow("treg API error 429: quota");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("retries transient network errors with backoff", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    fetchMock.mockRejectedValue(new Error("boom"));
    const promise = call("some.endpoint");
    const assertion = expect(promise).rejects.toThrow("treg network error: boom");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not retry timeout or connection-refused network errors", async () => {
    const timeoutErr = new Error("The operation was aborted due to timeout");
    timeoutErr.name = "TimeoutError";
    fetchMock.mockRejectedValueOnce(timeoutErr);
    await expect(call("some.endpoint")).rejects.toThrow(
      "treg network error (non-retryable): The operation was aborted due to timeout"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const refused = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
    });
    fetchMock.mockRejectedValueOnce(refused);
    await expect(call("some.endpoint")).rejects.toThrow(
      "treg network error (non-retryable):"
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("catalog", () => {
  it("catalogSearch encodes the query and sends only the token header", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));
    await catalogSearch("seo tools");
    const { url, init } = lastCall();
    expect(url.toString()).toBe("https://treg.to/catalog/search?q=seo%20tools");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Treg-Token"]).toBe("test-token");
    expect(init.method).toBeUndefined();
  });

  it("catalogSearch throws a catalog error on failure", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, "forbidden"));
    await expect(catalogSearch("x")).rejects.toThrow("treg catalog error 403: forbidden");
  });

  it("catalogGet fetches endpoint details via the catalog namespace", async () => {
    expect(catalog.search).toBe(catalogSearch);
    expect(catalog.get).toBe(catalogGet);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "moz.web.url.metrics" }));
    await catalogGet("moz.web.url.metrics");
    expect(lastCall().url.toString()).toBe("https://treg.to/catalog/moz.web.url.metrics");
  });

  it("balance fetches /balance and reports errors distinctly", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { balance_usd: 12.5 }));
    await expect(balance()).resolves.toEqual({ balance_usd: 12.5 });
    expect(lastCall().url.toString()).toBe("https://treg.to/balance");
    fetchMock.mockResolvedValueOnce(jsonResponse(402, "payment required"));
    await expect(balance()).rejects.toThrow("treg balance error 402: payment required");
  });
});

describe("domain helpers", () => {
  it("hunterFindEmail returns the data envelope", async () => {
    const data = { domain: "example.com", emails: [{ value: "a@example.com" }] };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data }));
    await expect(hunterFindEmail("example.com")).resolves.toBe(data);
    const { url } = lastCall();
    expect(url.searchParams.get("domain")).toBe("example.com");
    expect(url.searchParams.get("limit")).toBe("5");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data }));
    await hunterFindEmail("example.com", 10);
    expect(lastCall().url.searchParams.get("limit")).toBe("10");
  });

  it("mozMetrics posts targets and unwraps results", async () => {
    const results = [{ page: "https://a.com", domain_authority: 42 }];
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { results }));
    await expect(mozMetrics(["a.com"])).resolves.toBe(results);
    const { init } = lastCall();
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ targets: ["a.com"] });
  });

  it("mozBacklinksSummary passes the target as a query param", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { backlinks: 7 }));
    await expect(mozBacklinksSummary("example.com")).resolves.toEqual({ backlinks: 7 });
    expect(lastCall().url.searchParams.get("target")).toBe("example.com");
  });
});
