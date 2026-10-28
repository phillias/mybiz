import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeGBPToken, GBPAdapter, getGBPOAuthUrl } from "../src/lib/gbp";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    json: async () => body,
  } as unknown as Response;
}

const TOKEN = "gbp-access-token";

function adapter() {
  return new GBPAdapter({ accessToken: TOKEN, accountId: "acc_1" });
}

function lastCall(): { url: URL; init: RequestInit } {
  const [rawUrl, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url: new URL(rawUrl as string), init: init as RequestInit };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe("OAuth helpers", () => {
  it("getGBPOAuthUrl builds the consent URL", () => {
    const url = new URL(
      getGBPOAuthUrl("client-123", "https://app.example.com/cb", "state-xyz")
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/cb");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/business.manage"
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("state-xyz");
  });

  it("getGBPOAuthUrl defaults state to an empty string", () => {
    const url = new URL(getGBPOAuthUrl("c", "https://r"));
    expect(url.searchParams.get("state")).toBe("");
  });

  it("exchangeGBPToken posts the authorization_code grant", async () => {
    const tokens = { access_token: "at", refresh_token: "rt", expires_in: 3600 };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, tokens));
    await expect(exchangeGBPToken("c", "s", "auth-code", "https://r")).resolves.toEqual(
      tokens
    );
    const { url, init } = lastCall();
    expect(url.toString()).toBe("https://oauth2.googleapis.com/token");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded"
    );
    const body = init.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code");
    expect(body.get("client_id")).toBe("c");
    expect(body.get("client_secret")).toBe("s");
    expect(body.get("redirect_uri")).toBe("https://r");
  });

  it("exchangeGBPToken throws on failure", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, "invalid_grant"));
    await expect(exchangeGBPToken("c", "s", "x", "https://r")).rejects.toThrow(
      "Token exchange failed: invalid_grant"
    );
  });
});

describe("GBPAdapter", () => {
  it("sends bearer auth to the v4 endpoint", async () => {
    const locations = [{ name: "acc_1/locations/loc_1", locationName: "Harbor HQ" }];
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { locations }));
    await expect(adapter().listLocations("acc_1")).resolves.toEqual(locations);
    const { url, init } = lastCall();
    expect(url.toString()).toBe("https://mybusiness.googleapis.com/v4/accounts/acc_1/locations");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("throws a GBP API error on failure", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, "PERMISSION_DENIED"));
    await expect(adapter().listLocations("acc_1")).rejects.toThrow(
      "GBP API 403: PERMISSION_DENIED"
    );
  });

  it("listAccounts uses the account management host and defaults to []", async () => {
    const accounts = [{ name: "accounts/a", accountName: "Acme", type: "PERSONAL" }];
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { accounts }));
    await expect(adapter().listAccounts()).resolves.toEqual(accounts);
    expect(lastCall().url.toString()).toBe(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
    );

    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await expect(adapter().listAccounts()).resolves.toEqual([]);
  });

  it("listAccounts surfaces errors from the account host", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, "boom"));
    await expect(adapter().listAccounts()).rejects.toThrow("GBP API 500: boom");
  });

  it("createPost posts the local post payload", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { name: "p1", state: "LIVE" }));
    const post = { summary: "We are open", topicType: "STANDARD" as const };
    await expect(adapter().createPost("acc_1", "loc_1", post)).resolves.toEqual({
      name: "p1",
      state: "LIVE",
    });
    const { url, init } = lastCall();
    expect(url.pathname).toBe("/v4/accounts/acc_1/locations/loc_1/localPosts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(post);
  });

  it("listPosts maps posts and defaults to an empty list", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        localPosts: [{ name: "p1", summary: "s", state: "LIVE", extra: "ignored" }],
      })
    );
    await expect(adapter().listPosts("acc_1", "loc_1")).resolves.toEqual([
      { name: "p1", summary: "s", state: "LIVE" },
    ]);
    expect(lastCall().url.pathname).toBe("/v4/accounts/acc_1/locations/loc_1/localPosts");
    expect(lastCall().url.searchParams.get("pageSize")).toBe("100");

    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await expect(adapter().listPosts("acc_1", "loc_1")).resolves.toEqual([]);
  });

  it("deletePost issues a DELETE", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await adapter().deletePost("acc_1", "loc_1", "p1");
    const { url, init } = lastCall();
    expect(url.pathname).toBe("/v4/accounts/acc_1/locations/loc_1/localPosts/p1");
    expect(init.method).toBe("DELETE");
  });

  it("listReviews maps reviewers with an anonymous fallback", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        reviews: [
          { name: "r1", reviewer: { displayName: "Jo" }, starRating: "FIVE", comment: "great" },
          { name: "r2", starRating: "THREE" },
        ],
      })
    );
    await expect(adapter().listReviews("acc_1", "loc_1")).resolves.toEqual([
      { name: "r1", reviewer: "Jo", starRating: "FIVE", comment: "great" },
      { name: "r2", reviewer: "Anonymous", starRating: "THREE", comment: undefined },
    ]);
    expect(lastCall().url.searchParams.get("pageSize")).toBe("50");
  });

  it("replyToReview expands a bare review id onto the reply endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { comment: "Thanks!" }));
    await adapter().replyToReview("acc_1", "loc_1", "rev_1", "Thanks!");
    const { url, init } = lastCall();
    expect(url.pathname).toBe("/v4/accounts/acc_1/locations/loc_1/reviews/rev_1/reply");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ comment: "Thanks!" });
  });

  it("replyToReview keeps a full review name as-is", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    const fullName = "accounts/acc_1/locations/loc_1/reviews/rev_2";
    await adapter().replyToReview("acc_1", "loc_1", fullName, "hi");
    expect(lastCall().url.pathname).toBe(`/v4/${fullName}/reply`);
  });

  it("deleteReply issues a DELETE against the reply endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await adapter().deleteReply("acc_1", "loc_1", "rev_1");
    expect(lastCall().url.pathname).toBe(
      "/v4/accounts/acc_1/locations/loc_1/reviews/rev_1/reply"
    );
    expect(lastCall().init.method).toBe("DELETE");
  });

  it("listQuestions maps authors and answers", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        questions: [
          {
            name: "q1",
            text: "Do you ship?",
            author: { displayName: "Sam" },
            answers: [{ text: "Yes" }, { text: "No" }],
          },
          { name: "q2", text: "Parking?", answers: [] },
        ],
      })
    );
    await expect(adapter().listQuestions("acc_1", "loc_1")).resolves.toEqual([
      {
        name: "q1",
        text: "Do you ship?",
        author: "Sam",
        answers: [{ text: "Yes" }, { text: "No" }],
      },
      { name: "q2", text: "Parking?", author: "Anonymous", answers: [] },
    ]);
  });

  it("createQuestion and answerQuestion post the question text", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { name: "q9", text: "Do you ship?" }));
    await adapter().createQuestion("acc_1", "loc_1", "Do you ship?");
    const { url, init } = lastCall();
    expect(url.pathname).toBe("/v4/accounts/acc_1/locations/loc_1/questions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ text: "Do you ship?" });

    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await adapter().answerQuestion("acc_1", "loc_1", "q9", "Yes we ship!");
    const ansCall = lastCall();
    expect(ansCall.url.pathname).toBe(
      "/v4/accounts/acc_1/locations/loc_1/questions/q9/answers"
    );
    expect(ansCall.init.method).toBe("POST");
    expect(JSON.parse(ansCall.init.body as string)).toEqual({ text: "Yes we ship!" });
  });

  it("listServices maps name and displayName", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { services: [{ name: "s1", displayName: "SEO audit" }] })
    );
    await expect(adapter().listServices("acc_1", "loc_1")).resolves.toEqual([
      { name: "s1", displayName: "SEO audit" },
    ]);
  });

  it("getInsights queries the performance API with daily metric ranges", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { location: { metrics: [] } }));
    await adapter().getInsights(
      "acc_1",
      "loc_1",
      "2026-10-01T00:00:00Z",
      "2026-10-07T00:00:00Z"
    );
    const { url, init } = lastCall();
    expect(url.toString()).toBe(
      "https://mybusinessbusinessprofileperformance.googleapis.com/v1/locations/loc_1:fetchMultiDailyMetricsTimeSeries"
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      dailyMetricTimeRanges: [
        {
          dailyMetric: "ALL",
          timeRange: {
            startTime: "2026-10-01T00:00:00Z",
            endTime: "2026-10-07T00:00:00Z",
          },
        },
      ],
    });
  });

  it("getInsights surfaces errors from the performance API", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, "BAD_REQUEST"));
    await expect(
      adapter().getInsights("acc_1", "loc_1", "2026-10-01T00:00:00Z", "2026-10-07T00:00:00Z")
    ).rejects.toThrow("GBP API 400: BAD_REQUEST");
  });
});
