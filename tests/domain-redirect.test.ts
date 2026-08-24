import { describe, expect, it, vi } from "vitest";
import {
  isLegacyHost,
  legacyRedirectTarget,
  legacyHostRedirect,
} from "../src/lib/domain-redirect";

type RedirectContext = Parameters<typeof legacyHostRedirect>[0];

// Minimal APIContext stub: only what legacyHostRedirect touches.
function stubContext(host: string, path = "/", search = ""): RedirectContext {
  const url = `https://${host}${path}${search}`;
  return {
    request: new Request(url, { headers: { host } }),
    redirect: (location: string, status = 302) =>
      new Response(null, { status, headers: { location } }),
  } as unknown as RedirectContext;
}

const nextResponse = new Response("next");
const next = vi.fn(async () => nextResponse);

describe("isLegacyHost", () => {
  it("matches the apex and any subdomain of phillias.us", () => {
    expect(isLegacyHost("phillias.us")).toBe(true);
    expect(isLegacyHost("www.phillias.us")).toBe(true);
  });

  it("is case-insensitive and strips ports", () => {
    expect(isLegacyHost("PHILLIAS.US")).toBe(true);
    expect(isLegacyHost("WWW.Phillias.us:8443")).toBe(true);
  });

  it("never matches codevex.app hosts (loop safety)", () => {
    expect(isLegacyHost("codevex.app")).toBe(false);
    expect(isLegacyHost("www.codevex.app")).toBe(false);
  });

  it("does not match lookalike suffixes or other hosts", () => {
    expect(isLegacyHost("notphillias.us")).toBe(false);
    expect(isLegacyHost("phillias.us.evil.test")).toBe(false);
    expect(isLegacyHost("mybiz-91l.pages.dev")).toBe(false);
    expect(isLegacyHost("localhost:4321")).toBe(false);
    expect(isLegacyHost(null)).toBe(false);
  });
});

describe("legacyRedirectTarget", () => {
  it("preserves path and query on codevex.app", () => {
    expect(legacyRedirectTarget(new URL("https://phillias.us/articles/foo/?x=1&y=2"))).toBe(
      "https://codevex.app/articles/foo/?x=1&y=2",
    );
    expect(legacyRedirectTarget(new URL("https://www.phillias.us/opt-in"))).toBe(
      "https://codevex.app/opt-in",
    );
    expect(legacyRedirectTarget(new URL("https://phillias.us/"))).toBe("https://codevex.app/");
  });
});

describe("legacyHostRedirect middleware", () => {
  it("301s a phillias.us request to the same path+query on codevex.app", async () => {
    const ctx = stubContext(
      "phillias.us",
      "/articles/local-first-context-memory-for-ai-coding-agents/",
      "?utm=x",
    );
    const res = (await legacyHostRedirect(ctx, next)) as Response;
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(
      "https://codevex.app/articles/local-first-context-memory-for-ai-coding-agents/?utm=x",
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("301s a www.phillias.us subdomain request too", async () => {
    const res = (await legacyHostRedirect(stubContext("www.phillias.us", "/privacy"), next)) as Response;
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://codevex.app/privacy");
  });

  it("passes codevex.app through untouched (no redirect loop)", async () => {
    next.mockClear();
    const res = (await legacyHostRedirect(stubContext("codevex.app", "/articles/", "?q=1"), next)) as Response;
    expect(next).toHaveBeenCalled();
    expect(res).toBe(nextResponse);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes www.codevex.app and non-legacy hosts through", async () => {
    for (const host of ["www.codevex.app", "mybiz-91l.pages.dev", "localhost:4321"]) {
      next.mockClear();
      const res = (await legacyHostRedirect(stubContext(host), next)) as Response;
      expect(next).toHaveBeenCalled();
      expect(res).toBe(nextResponse);
      expect(res.headers.get("location")).toBeNull();
    }
  });
});
