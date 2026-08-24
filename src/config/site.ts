// Single source of truth for site identity values.
// Domain cutover 2026-08-24: codevex.app is the commercial/professional domain;
// phillias.us traffic 301s to it via src/middleware.ts. Brand entity: "Phileas".
// Override at build/deploy time via PUBLIC_* env vars (.env / Pages secrets).
export const siteUrl = import.meta.env.PUBLIC_SITE_URL || "https://codevex.app";
export const contactEmail = import.meta.env.PUBLIC_CONTACT_EMAIL || "admin@codevex.app";

// Brand entity (captain decision 2026-08-24): the Organization is "Phileas";
// the public-facing site brand shown in headers/titles is "Phileas Fogg".
export const organizationName = "Phileas";
export const siteName = "Phileas Fogg";

// Social share image (public/og-image.png, 1200x630) and favicon assets.
export const ogImagePath = "/og-image.png";
export const faviconSvgPath = "/favicon.svg";
export const faviconIcoPath = "/favicon.ico";

/** Absolute URL for a site-relative path (canonical, og:url, JSON-LD ids). */
export function absoluteUrl(path: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
