// treg enrichment for Prospect Radar — adds Hunter email + Moz DA to prospects.
// Fails soft: returns empty object on any error so the pipeline continues.
//
// Used by prospect-score.mjs during --apply runs, and by enrich-prospects.mjs
// for standalone enrichment of cached fixtures.

import { hunterFindEmail, mozMetrics } from "./treg.mjs";

/**
 * Extract domain from a website URL using the URL constructor.
 * Returns null if the URL is invalid or empty.
 *
 * Prepending a default scheme lets the URL constructor strip ports,
 * paths, and query strings that a bare hostname would keep ("example.com:8443"
 * stays glued in the URL-less fallback, producing an invalid Hunter domain).
 */
function extractDomain(website) {
  if (!website) return null;
  const raw = String(website).trim();
  try {
    const url = new URL(/^\w+:\/\//.test(raw) ? raw : `https://${raw}`);
    // URL constructor succeeds even for relative URLs; require a hostname
    if (!url.hostname) return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    // Fall back to raw string if it looks like a bare domain (no protocol)
    const bare = raw.toLowerCase();
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(bare)) {
      return bare.replace(/^www\./, "").replace(/\/.*$/, "");
    }
    // Malformed input (URL parse failed AND bare-domain regex failed) —
    // log at debug so operators can distinguish "no website" from "bad value".
    if (process.env.DEBUG) {
      console.error(`[treg-enrich] extractDomain: malformed website value ${JSON.stringify(raw)}`);
    }
    return null;
  }
}

/**
 * Enrich a prospect with treg data: Hunter email + Moz metrics.
 * Returns an object with whatever fields succeeded; empty on total failure.
 * Rejected sub-requests keep enrichment soft-fail but are surfaced under
 * `errors` so callers can distinguish "no data" from "endpoint failed"
 * (prospect-score.mjs previously read both as `no enrichment`).
 *
 * @param {object} p - prospect with at least { website }
 * @returns {Promise<object>} - { email, email_confidence, email_position, email_verified, domain_authority, page_authority, spam_score, linking_domains, errors? }
 */
export async function enrichWithTreg(p) {
  const domain = extractDomain(p.website);
  if (!domain) return {};

  const result = {};
  const errors = {};

  // Parallel calls for speed
  const [emailResult, mozResult] = await Promise.allSettled([
    hunterFindEmail(domain, 3),
    mozMetrics([domain]),
  ]);

  // Hunter email
  if (emailResult.status === "rejected") {
    errors.hunter = emailResult.reason?.message ?? String(emailResult.reason);
    console.error(`[treg-enrich] Hunter failed for ${domain}: ${errors.hunter}`);
  } else if (emailResult.value?.emails?.[0]) {
    const top = emailResult.value.emails[0];
    result.email = top.value;
    result.email_confidence = top.confidence;
    result.email_position = top.position;
    result.email_verified = top.verification?.status === "valid";
  }

  // Moz metrics
  if (mozResult.status === "rejected") {
    errors.moz = mozResult.reason?.message ?? String(mozResult.reason);
    console.error(`[treg-enrich] Moz failed for ${domain}: ${errors.moz}`);
  } else if (mozResult.value?.[0]) {
    const moz = mozResult.value[0];
    result.domain_authority = moz.domain_authority;
    result.page_authority = moz.page_authority;
    result.spam_score = moz.spam_score;
    result.linking_domains = moz.root_domains_to_root_domain;
  }

  if (Object.keys(errors).length > 0) {
    result.errors = errors;
  }

  return result;
}
