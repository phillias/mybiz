import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** Internal write half of checkNiche. Upserts nicheScore by keyword. */
export const upsert = internalMutation({
  args: {
    keyword: v.string(),
    sponsoredCount: v.number(),
    mapPack: v.boolean(),
    top10AuthorityMedian: v.optional(v.number()),
    longTailClusters: v.number(),
    verdict: v.union(v.literal("PASS"), v.literal("FAIL"), v.literal("PENDING")),
    source: v.string(),
  },
  handler: async (ctx, row) => {
    const existing = await ctx.db
      .query("nicheScore")
      .withIndex("by_keyword", (q) => q.eq("keyword", row.keyword))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, row);
    } else {
      await ctx.db.insert("nicheScore", row);
    }
  },
});
