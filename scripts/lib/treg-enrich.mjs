// treg enrichment for Prospect Radar — adds Hunter email + Moz DA to prospects.
// Fails soft: returns empty object on any error so the pipeline continues.
//
// Used by prospect-score.mjs during --apply runs, and by enrich-prospects.mjs
// for standalone enrichment of cached fixtures.

import { hunterFindEmail, mozMetrics } from "./treg.mjs";

/**
 * Extract domain from a website URL.
 */
function extractDomain(website) {
  if (!website) return null;
  return String(website)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .trim();
}

/**
 * Enrich a prospect with treg data: Hunter email + Moz metrics.
 * Returns an object with whatever fields succeeded; empty on total failure.
 *
 * @param {object} p - prospect with at least { website }
 * @returns {Promise<object>} - { email, email_confidence, email_position, email_verified, domain_authority, page_authority, spam_score, linking_domains }
 */
export async function enrichWithTreg(p) {
  const domain = extractDomain(p.website);
  if (!domain) return {};

  const result = {};

  // Parallel calls for speed
  const [emailResult, mozResult] = await Promise.allSettled([
    hunterFindEmail(domain, 3),
    mozMetrics([domain]),
  ]);

  // Hunter email
  if (emailResult.status === "fulfilled" && emailResult.value?.emails?.[0]) {
    const top = emailResult.value.emails[0];
    result.email = top.value;
    result.email_confidence = top.confidence;
    result.email_position = top.position;
    result.email_verified = top.verification?.status === "valid";
  }

  // Moz metrics
  if (mozResult.status === "fulfilled" && mozResult.value?.[0]) {
    const moz = mozResult.value[0];
    result.domain_authority = moz.domain_authority;
    result.page_authority = moz.page_authority;
    result.spam_score = moz.spam_score;
    result.linking_domains = moz.root_domains_to_root_domain;
  }

  return result;
}
