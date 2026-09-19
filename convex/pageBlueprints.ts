import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * U4: pageBlueprint queries for Core 30 generation.
 * Used by scripts/generate-core30.mjs --convex mode.
 */

/** List all pageBlueprint rows for a given archetype (optional filter). */
export const list = query({
  args: {
    archetype: v.optional(v.union(
      v.literal("core"),
      v.literal("service"),
      v.literal("location"),
      v.literal("supporting"),
    )),
    city: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // If archetype filter provided, use index; otherwise full table scan
    const archetype = args.archetype;
    const rows = await (archetype
      ? ctx.db
          .query("pageBlueprint")
          .withIndex("by_archetype", (q) => q.eq("archetype", archetype))
          .collect()
      : ctx.db.query("pageBlueprint").collect());

    // Filter by city if specified (in-memory since locationData.city is nested)
    let filtered = rows;
    if (args.city) {
      filtered = rows.filter((r) => r.locationData?.city === args.city);
    }

    // Apply limit
    const limit = args.limit ?? 100;
    return filtered.slice(0, limit);
  },
});

/** Get a single pageBlueprint by slug. */
export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("pageBlueprint")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

/** Count blueprints by archetype. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("pageBlueprint").collect();
    const counts: Record<string, number> = {};
    for (const row of all) {
      counts[row.archetype] = (counts[row.archetype] ?? 0) + 1;
    }
    return counts;
  },
});
