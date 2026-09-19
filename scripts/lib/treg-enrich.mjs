// treg enrichment for Prospect Radar — adds Hunter email + Moz DA to prospects.
// Fails soft: returns empty object on any error so the pipeline continues.
//
// Used by prospect-score.mjs during --apply runs, and by enrich-prospects.mjs
// for standalone enrichment of cached fixtures.

import { hunterFindEmail, mozMetrics } from "./treg.mjs";

/**
 * Extract domain from a website URL using the URL constructor.
 * Returns null if the URL is invalid or empty.
 */
function extractDomain(website) {
  if (!website) return null;
  try {
    const url = new URL(String(website).trim());
    // URL constructor succeeds even for relative URLs; require a hostname
    if (!url.hostname) return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    // Fall back to raw string if it looks like a bare domain (no protocol)
    const raw = String(website).trim().toLowerCase();
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(raw)) {
      return raw.replace(/^www\./, "").replace(/\/.*$/, "");
    }
    return null;
  }
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
  if (emailResult.status === "rejected") {
    console.error(`[treg-enrich] Hunter failed for ${domain}: ${emailResult.reason?.message ?? emailResult.reason}`);
  } else if (emailResult.value?.emails?.[0]) {
    const top = emailResult.value.emails[0];
    result.email = top.value;
    result.email_confidence = top.confidence;
    result.email_position = top.position;
    result.email_verified = top.verification?.status === "valid";
  }

  // Moz metrics
  if (mozResult.status === "rejected") {
    console.error(`[treg-enrich] Moz failed for ${domain}: ${mozResult.reason?.message ?? mozResult.reason}`);
  } else if (mozResult.value?.[0]) {
    const moz = mozResult.value[0];
    result.domain_authority = moz.domain_authority;
    result.page_authority = moz.page_authority;
    result.spam_score = moz.spam_score;
    result.linking_domains = moz.root_domains_to_root_domain;
  }

  return result;
}
