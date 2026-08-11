import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * U1: content model — every page on a client site derives from a blueprint.
 * Archetypes: core / service / location / supporting (plan U4).
 */
export const pageBlueprint = defineTable({
  slug: v.string(),
  archetype: v.union(
    v.literal("core"),
    v.literal("service"),
    v.literal("location"),
    v.literal("supporting"),
  ),
  /** Astro template name (e.g. "location", "service", "core") */
  template: v.string(),
  /** Search intent for the page (informational/transactional/navigational/local) */
  intent: v.string(),
  /** Primary keyword cluster this page targets */
  keywordCluster: v.optional(v.string()),
  /** schema.org type for structured data (LocalBusiness, Service, FAQPage, ...) */
  schemaType: v.optional(v.string()),
  /** Hub-and-spoke internal-link targets (slugs this page must link to) */
  internalLinks: v.array(v.string()),
  /** Location-specific data for templated pages (city, region, NAP, landmarks...) */
  locationData: v.optional(v.object({
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    address: v.optional(v.string()),
    serviceArea: v.optional(v.array(v.string())),
  })),
})
  .index("by_slug", ["slug"])
  .index("by_archetype", ["archetype"]);

/**
 * U3: niche-validation results. Written by the DataForSEO SERP pipeline;
 * verdict gates whether agents may commit content strategy to a niche.
 */
export const nicheScore = defineTable({
  keyword: v.string(),
  /** number of sponsored results on the live SERP (gate: must be 0) */
  sponsoredCount: v.number(),
  /** whether a local map-pack is present (gate: must be false) */
  mapPack: v.boolean(),
  /** median authority proxy (referring domains / domain rank) of top-10 results */
  top10AuthorityMedian: v.optional(v.number()),
  /** count of low-competition long-tail clusters found (gate: >= 3) */
  longTailClusters: v.number(),
  verdict: v.union(v.literal("PASS"), v.literal("FAIL"), v.literal("PENDING")),
  /** data source + timestamp for auditability */
  source: v.string(),
})
  .index("by_verdict", ["verdict"])
  .index("by_keyword", ["keyword"]);

/**
 * Demand-side validation signals (MonetScope / Trendstr / manual import).
 * Provider verdict kept verbatim; Harbor's own gate is computed at read time —
 * nicheScore.verdict === "PASS" && demandSignal.providerVerdict === "PROCEED"
 * → commit content strategy. Do not collapse the enums in storage.
 * Dimension columns carry the weighted factors from each provider's export
 * (MonetScope PROCEED/PIVOT/PAUSE; Trendstr 5-factor weighted scores).
 */
export const demandSignal = defineTable({
  keyword: v.string(),
  source: v.union(
    v.literal("monetscope"),
    v.literal("trendstr"),
    v.literal("manual"),
  ),
  /** provider's own verdict, verbatim */
  providerVerdict: v.union(
    v.literal("PROCEED"),
    v.literal("PIVOT"),
    v.literal("PAUSE"),
  ),
  /** provider factor scores (0-100) */
  buyerIntent: v.optional(v.number()),
  pain: v.optional(v.number()),
  urgency: v.optional(v.number()),
  /** raw provider payload, for auditability */
  raw: v.optional(v.any()),
  /** epoch ms of ingestion */
  ingestedAt: v.number(),
})
  .index("by_keyword", ["keyword"])
  .index("by_source_ingested", ["source", "ingestedAt"])
  .index("by_verdict", ["providerVerdict"]);

/**
 * U2/U6: two-way SMS + voice conversation log. Webhook target for Telnyx.
 * optedOut drives the TCPA opt-out gate (STOP keyword handling).
 */
export const conversations = defineTable({
  /** E.164, e.g. +13175550123 */
  phoneNumber: v.string(),
  direction: v.union(v.literal("inbound"), v.literal("outbound")),
  channel: v.union(v.literal("sms"), v.literal("voice")),
  body: v.optional(v.string()),
  /** true once the user has opted out (STOP) — blocks further sends */
  optedOut: v.boolean(),
  /** raw provider event payload, for debugging */
  metadata: v.optional(v.any()),
})
  .index("by_phone", ["phoneNumber"])
  .index("by_optedOut", ["optedOut"]);

export default defineSchema({ pageBlueprint, nicheScore, demandSignal, conversations });
