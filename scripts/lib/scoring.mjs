// Shared scoring for the Prospect Radar pipeline (prospect-side of
// tool.rankexpand.com's niche validator). Pure — no network, no env.
// A sub-score of 1.0 means the business is weak on that axis (lost customers
// = opportunity); 0.0 means it is already winning. Weights sum to 100.

export const WEIGHTS = { website: 30, speed: 15, reviews: 25, serp: 20, authority: 10 };

export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function normalizeDomain(site) {
  if (!site) return "";
  return String(site)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .trim();
}

export function hasWebsite(p) {
  const s = (p.website ?? "").trim();
  return s !== "" && !/^https?:\/\/(www\.)?$/i.test(s);
}

// No website = highest intent. Thin crawled sites (few pages, few words, no
// title/meta) score high; unknown sites default to "assume thin".
export function websiteWeakness(p) {
  if (!hasWebsite(p)) return 1.0;
  const pages = p.pages !== undefined ? p.pages : p.pageCount;
  const words = p.words !== undefined ? p.words : p.wordCount;
  if (pages === undefined && words === undefined) return 0.8;
  const pageFactor = pages === undefined ? 0.5 : 1 - clamp(pages / 30, 0, 1);
  const wordFactor = words === undefined ? 0.5 : 1 - clamp(words / 5000, 0, 1);
  let s = 0.6 * pageFactor + 0.4 * wordFactor;
  if (!(p.title ?? "").trim()) s += 0.1;
  if (!(p.meta ?? "").trim()) s += 0.1;
  return clamp(s, 0, 1);
}

// Slow pages lose customers. No website = the whole experience is absent.
export function speedWeakness(p) {
  if (!hasWebsite(p)) return 1.0;
  const score = typeof p.pagespeed === "number" ? p.pagespeed : p.pagespeed?.performance ?? p.pagespeed?.score;
  if (typeof score !== "number") return 0.5;
  return 1 - clamp(score / 100, 0, 1);
}

// Few / old-starved reviews = no review asset for Google to reward.
export function reviewWeakness(p) {
  const count = typeof p.reviewCount === "number" ? p.reviewCount : p.reviews;
  const rating = typeof p.rating === "number" ? p.rating : undefined;
  if (count === undefined && rating === undefined) return 0.5;
  const countFactor = count === undefined ? 0.5 : 1 - clamp(count / 50, 0, 1);
  const ratingFactor = rating === undefined ? 0.5 : 1 - clamp(rating / 5, 0, 1);
  return 0.65 * countFactor + 0.35 * ratingFactor;
}

// Not in the map pack for their own money keyword = losing local search.
// Uses the checkNiche gate signals (sponsoredCount, mapPack, longTailClusters).
export function serpWeakness(p) {
  const s = p.serp;
  if (!s) return 0.5;
  const demand = clamp((s.longTailClusters ?? 0) / 12, 0, 1);
  const pack = s.mapPack ? (s.inPack ? 0 : 1) : 0.6;
  const pressure = (s.sponsoredCount ?? 0) > 0 ? 1 : 0;
  return clamp(0.45 * demand + 0.4 * pack + 0.15 * pressure, 0, 1);
}

// Optional signal — no per-business authority source wired yet. Neutral until
// a referring-domains proxy is added (see the plan's "Authority gap" row).
export function authorityWeakness() {
  return 0.5;
}

export function scoreProspect(p) {
  const subs = {
    website: websiteWeakness(p),
    speed: speedWeakness(p),
    reviews: reviewWeakness(p),
    serp: serpWeakness(p),
    authority: authorityWeakness(),
  };
  subs.opportunity = Math.round(
    subs.website * WEIGHTS.website +
      subs.speed * WEIGHTS.speed +
      subs.reviews * WEIGHTS.reviews +
      subs.serp * WEIGHTS.serp +
      subs.authority * WEIGHTS.authority,
  );
  return subs;
}
