import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Top PROCEED demand signals (most recent first) — feeds the U3/U4 pipeline:
 * pick a signal -> checkNiche gate -> generate.
 */
export const listProceed = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 10 }) => {
    return ctx.db
      .query("demandSignal")
      .withIndex("by_verdict", (q) => q.eq("providerVerdict", "PROCEED"))
      .order("desc")
      .take(limit);
  },
});
