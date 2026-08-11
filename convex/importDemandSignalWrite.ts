import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal write half of importDemandSignal. Upserts by keyword+source
 * (one demandSignal row per keyword/provider pair), stamping nothing —
 * ingestedAt arrives from the caller.
 */
export const upsert = internalMutation({
  args: {
    records: v.array(v.object({
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
      ingestedAt: v.number(),
    })),
  },
  handler: async (ctx, { records }) => {
    let inserted = 0;
    let updated = 0;
    for (const r of records) {
      const existing = await ctx.db
        .query("demandSignal")
        .withIndex("by_keyword", (q) => q.eq("keyword", r.keyword))
        .filter((q) => q.eq(q.field("source"), r.source))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, r);
        updated += 1;
      } else {
        await ctx.db.insert("demandSignal", r);
        inserted += 1;
      }
    }
    return { inserted, updated };
  },
});
