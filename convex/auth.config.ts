import type { AuthConfig } from "convex/server";

/**
 * U1: Clerk → Convex token validation.
 * Requires CLERK_JWT_ISSUER_DOMAIN (Clerk Frontend API URL, e.g.
 * https://powerful.gibbon-3.clerk.accounts.dev) set on the Convex deployment.
 * Also requires the "Convex" integration activated in the Clerk dashboard
 * (dashboard.clerk.com/apps/setup/convex) so tokens carry applicationID "convex".
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
