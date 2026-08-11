"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * Import demand-validation signals (MonetScope / Trendstr / manual).
 * Contract boundary is this Convex action, not a provider SDK: callers pass
 * the demandSignal shape above and get an idempotent upsert by keyword+source.
 *
 * Source of the payload: MonetScope's export surface (dashboard JSON/CSV, or a
 * Monitor-stream API) is unverified — until it's confirmed on their side,
 * callers use a manual/scripted JSON import. ingestAt is stamped here.
 */
export const importDemandSignal = action({
  args: {
    payload: v.array(v.object({
      keyword: v.string(),
      source: v.union(
        v.literal("monetscope"),
        v.literal("trendstr"),
        v.literal("manual"),
      ),
      providerVerdict: v.union(
        v.literal("PROCEED"),
        v.literal("PIVOT"),
        v.literal("PAUSE"),
      ),
      buyerIntent: v.optional(v.number()),
      pain: v.optional(v.number()),
      urgency: v.optional(v.number()),
      raw: v.optional(v.any()),
    })),
  },
  handler: async (ctx, { payload }): Promise<{
    inserted: number;
    updated: number;
    ingestedAt: number;
  }> => {
    const ingestedAt = Date.now();
    const records = payload.map((p) => ({ ...p, ingestedAt }));
    const result = await ctx.runMutation(internal.importDemandSignalWrite.upsert, {
      records,
    });
    return { ...result, ingestedAt };
  },
});
