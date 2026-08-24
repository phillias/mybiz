import type { MiddlewareHandler } from "astro";

// Domain cutover 2026-08-24 (captain decision): codevex.app is the commercial
// domain; phillias.us traffic 301s to the same path on codevex.app.
// IMPORTANT: both hostnames serve the SAME Cloudflare Pages project, so this
// redirect MUST stay host-scoped. A host-blind catch-all in public/_redirects
// would infinite-loop codevex.app traffic. Unit-tested in tests/domain-redirect.test.ts.
export const LEGACY_HOST_SUFFIX = "phillias.us";
export const PRIMARY_ORIGIN = "https://codevex.app";

export function isLegacyHost(hostHeader: string | null | undefined): boolean {
  const hostname = (hostHeader ?? "").split(":")[0] ?? "";
  const h = hostname.trim().toLowerCase();
  return h === LEGACY_HOST_SUFFIX || h.endsWith(`.${LEGACY_HOST_SUFFIX}`);
}

export function legacyRedirectTarget(url: URL): string {
  return `${PRIMARY_ORIGIN}${url.pathname}${url.search}`;
}

// Type-only astro import (erased at runtime), so this module is unit-testable
// without resolving the astro:middleware virtual module.
export const legacyHostRedirect: MiddlewareHandler = (context, next) => {
  if (isLegacyHost(context.request.headers.get("host"))) {
    return context.redirect(legacyRedirectTarget(new URL(context.request.url)), 301);
  }
  return next();
};
