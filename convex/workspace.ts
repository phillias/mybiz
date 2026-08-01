import { query } from "./_generated/server";

/**
 * U1: authenticated identity. Proves the Clerk → Convex verification chain:
 * client sends the Clerk session token; Convex validates it against the
 * issuer (auth.config.ts) and exposes the identity here.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return {
      subject: identity.subject,
      email: identity.email,
      name: identity.name,
      orgId: identity.orgId ?? null,
    };
  },
});
