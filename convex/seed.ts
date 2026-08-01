import { internalMutation } from "./_generated/server";

/**
 * U1: seed the content-model archetypes (plan U4 page inventory shape).
 * 8 core + 2 service + (location pages generated per-site later) + 9 supporting.
 * Run once via: `npx convex run seed --prod` (or from the dashboard).
 */
export default internalMutation({
  handler: async (ctx) => {
    const blueprints = [
      // --- 8 core pages ---
      { slug: "home", archetype: "core", template: "core", intent: "navigational", schemaType: "WebSite", internalLinks: ["services", "about", "contact"] },
      { slug: "about", archetype: "core", template: "core", intent: "informational", schemaType: "AboutPage", internalLinks: ["contact", "services"] },
      { slug: "contact", archetype: "core", template: "core", intent: "transactional", schemaType: "ContactPage", internalLinks: ["services"] },
      { slug: "services", archetype: "core", template: "core", intent: "transactional", schemaType: "ItemList", internalLinks: ["home", "contact"] },
      { slug: "blog", archetype: "core", template: "core", intent: "informational", schemaType: "Blog", internalLinks: ["home"] },
      { slug: "reviews", archetype: "core", template: "core", intent: "informational", schemaType: "Review", internalLinks: ["services", "contact"] },
      { slug: "faq", archetype: "core", template: "core", intent: "informational", schemaType: "FAQPage", internalLinks: ["services", "contact"] },
      { slug: "pricing", archetype: "core", template: "core", intent: "transactional", schemaType: "Offer", internalLinks: ["services", "contact"] },
      // --- 2 service pages (examples; per-niche) ---
      { slug: "services/seo-content", archetype: "service", template: "service", intent: "transactional", schemaType: "Service", internalLinks: ["services", "pricing", "contact"] },
      { slug: "services/local-seo", archetype: "service", template: "service", intent: "transactional", schemaType: "Service", internalLinks: ["services", "pricing", "contact"] },
      // --- 9 supporting pages ---
      { slug: "privacy", archetype: "supporting", template: "supporting", intent: "informational", internalLinks: [] },
      { slug: "terms", archetype: "supporting", template: "supporting", intent: "informational", internalLinks: [] },
      { slug: "refund-policy", archetype: "supporting", template: "supporting", intent: "informational", internalLinks: [] },
      { slug: "acceptable-use", archetype: "supporting", template: "supporting", intent: "informational", internalLinks: [] },
      { slug: "cookies", archetype: "supporting", template: "supporting", intent: "informational", internalLinks: [] },
      { slug: "sitemap", archetype: "supporting", template: "supporting", intent: "navigational", internalLinks: [] },
      { slug: "resources", archetype: "supporting", template: "supporting", intent: "informational", internalLinks: ["blog"] },
      { slug: "careers", archetype: "supporting", template: "supporting", intent: "informational", internalLinks: ["about"] },
      { slug: "404", archetype: "supporting", template: "supporting", intent: "navigational", internalLinks: ["home"] },
      // --- location archetype note ---
      // Location pages (20-30 per site) are generated per-site at build time
      // from locationData rows; see plan U4. Example row:
      // { slug: "locations/indianapolis", archetype: "location", template: "location",
      //   intent: "local", schemaType: "LocalBusiness",
      //   internalLinks: ["services", "services/seo-content", "contact"], ... }
    ] as const;

    for (const b of blueprints) {
      const existing = await ctx.db
        .query("pageBlueprint")
        .withIndex("by_slug", (q) => q.eq("slug", b.slug))
        .first();
      if (!existing) {
        await ctx.db.insert("pageBlueprint", b);
      }
    }
    return { inserted: blueprints.length };
  },
});
