import { ConvexHttpClient } from "convex/browser";

/**
 * Convex HTTP client for browser-side calls.
 * Requires PUBLIC_CONVEX_URL (see .env.example).
 */
export const convex = new ConvexHttpClient(
  import.meta.env.PUBLIC_CONVEX_URL ?? "https://placeholder.convex.site",
);
