import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { searchMock, answerMock } = vi.hoisted(() => ({
  searchMock: vi.fn(),
  answerMock: vi.fn(),
}));

class MockExa {
  static instances = 0;
  search = searchMock;
  answer = answerMock;
  constructor() {
    MockExa.instances += 1;
  }
}

vi.mock("exa-js", () => ({ default: MockExa }));

async function loadExa() {
  return import("../src/lib/exa");
}

beforeEach(() => {
  vi.resetModules();
  MockExa.instances = 0;
  searchMock.mockReset();
  answerMock.mockReset();
  vi.stubEnv("EXA_API_KEY", "exa-test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("client setup", () => {
  it("throws when EXA_API_KEY is missing", async () => {
    vi.stubEnv("EXA_API_KEY", "");
    const exa = await loadExa();
    await expect(exa.search({ query: "q" })).rejects.toThrow(
      "EXA_API_KEY not set (add to .env)"
    );
    expect(MockExa.instances).toBe(0);
  });

  it("reuses a single client across calls", async () => {
    const exa = await loadExa();
    searchMock.mockResolvedValue({ results: [] });
    await exa.search({ query: "a" });
    await exa.search({ query: "b" });
    expect(MockExa.instances).toBe(1);
  });
});

describe("search", () => {
  it("applies defaults and maps results", async () => {
    const exa = await loadExa();
    searchMock.mockResolvedValueOnce({
      results: [
        {
          url: "https://a.com",
          title: "A",
          text: "body",
          highlights: ["h"],
          summary: "s",
          publishedDate: "2026-01-01",
          author: "X",
        },
        { url: "https://b.com", title: "B" },
      ],
    });
    const results = await exa.search({ query: "harbor seo" });
    expect(results).toEqual([
      {
        url: "https://a.com",
        title: "A",
        text: "body",
        highlights: ["h"],
        summary: "s",
        publishedDate: "2026-01-01",
        author: "X",
      },
      { url: "https://b.com", title: "B" },
    ]);
    expect(searchMock).toHaveBeenCalledWith("harbor seo", {
      numResults: 10,
      type: "auto",
      contents: { highlights: true },
    });
  });

  it("requests text and summary contents and passes filters through", async () => {
    const exa = await loadExa();
    searchMock.mockResolvedValueOnce({ results: [] });
    await exa.search({
      query: "q",
      numResults: 3,
      type: "deep",
      category: "news",
      includeDomains: ["a.com"],
      excludeDomains: ["b.com"],
      startPublishedDate: "2026-01-01",
      highlights: false,
      text: true,
      summary: true,
    });
    expect(searchMock).toHaveBeenCalledWith("q", {
      numResults: 3,
      type: "deep",
      category: "news",
      includeDomains: ["a.com"],
      excludeDomains: ["b.com"],
      startPublishedDate: "2026-01-01",
      contents: { text: { maxCharacters: 2000 }, summary: true },
    });
  });

  it("omits contents when nothing is requested", async () => {
    const exa = await loadExa();
    searchMock.mockResolvedValueOnce({ results: [] });
    await exa.search({ query: "q", highlights: false });
    expect(searchMock).toHaveBeenCalledWith("q", {
      numResults: 10,
      type: "auto",
      contents: undefined,
    });
  });

  it("returns an empty array when the response has no results", async () => {
    const exa = await loadExa();
    searchMock.mockResolvedValueOnce({});
    await expect(exa.search({ query: "q" })).resolves.toEqual([]);
  });
});

describe("answer", () => {
  it("falls back from content to answer and defaults citations", async () => {
    const exa = await loadExa();
    answerMock.mockResolvedValueOnce({
      content: "the answer",
      citations: [{ url: "https://x.com/a", title: "X" }],
    });
    await expect(exa.answer("who?")).resolves.toEqual({
      content: "the answer",
      citations: [{ url: "https://x.com/a", title: "X" }],
    });
    expect(answerMock).toHaveBeenCalledWith("who?", {});

    answerMock.mockResolvedValueOnce({ answer: "fallback", citations: [] });
    await expect(exa.answer("who?")).resolves.toEqual({
      content: "fallback",
      citations: [],
    });
  });
});

describe("checkCitation", () => {
  it("detects whether a domain appears in the citations", async () => {
    const exa = await loadExa();
    const citations = [
      { url: "https://codevex.app/post", title: "P" },
      { url: "https://other.com", title: "O" },
    ];
    answerMock.mockResolvedValueOnce({ content: "answer text", citations });
    await expect(exa.checkCitation("best seo workspace", "codevex.app")).resolves.toEqual({
      cited: true,
      answer: "answer text",
      citations,
    });

    answerMock.mockResolvedValueOnce({
      content: "nope",
      citations: [{ url: "https://other.com", title: "O" }],
    });
    const result = await exa.checkCitation("best seo workspace", "codevex.app");
    expect(result.cited).toBe(false);
    expect(result.answer).toBe("nope");
  });
});

describe("domain helpers", () => {
  it("companySearch uses the company category with defaults", async () => {
    const exa = await loadExa();
    searchMock.mockResolvedValueOnce({ results: [] });
    await exa.companySearch("Harbor");
    expect(searchMock).toHaveBeenCalledWith(
      "Harbor",
      expect.objectContaining({
        category: "company",
        numResults: 5,
        type: "auto",
        contents: { highlights: true },
      })
    );
  });

  it("companySearch lets options override defaults", async () => {
    const exa = await loadExa();
    searchMock.mockResolvedValueOnce({ results: [] });
    await exa.companySearch("Harbor", { numResults: 3, text: true });
    const callArgs = searchMock.mock.calls[0][1];
    expect(callArgs.numResults).toBe(3);
    expect(callArgs.contents).toEqual({ highlights: true, text: { maxCharacters: 2000 } });
  });

  it("researchSearch targets research papers", async () => {
    const exa = await loadExa();
    searchMock.mockResolvedValueOnce({ results: [] });
    await exa.researchSearch("vector search", { startPublishedDate: "2026-01-01" });
    expect(searchMock).toHaveBeenCalledWith(
      "vector search",
      expect.objectContaining({
        category: "research paper",
        numResults: 10,
        startPublishedDate: "2026-01-01",
        contents: { highlights: true },
      })
    );
  });
});
