// Single source of truth for site identity values.
// Domain cutover 2026-08-24: codevex.app is the commercial/professional domain;
// phillias.us traffic 301s to it via src/middleware.ts. Brand entity: "Phileas".
// Override at build/deploy time via PUBLIC_* env vars (.env / Pages secrets).
export const siteUrl = import.meta.env.PUBLIC_SITE_URL || "https://codevex.app";
export const contactEmail = import.meta.env.PUBLIC_CONTACT_EMAIL || "admin@codevex.app";
