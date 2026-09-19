// treg client — unified tool catalog API (2,600+ endpoints across 85+ providers).
// "OpenRouter for agent tools" — single token, pay per call.
//
// Usage:
//   import { call, catalog } from "../lib/treg";
//   
//   // Call by endpoint id
//   const email = await call("hunter.email.find", { domain: "example.com" });
//   
//   // Call by full URL (credential injection)
//   const stripe = await call("https://api.stripe.com/v1/charges");
//   
//   // Search catalog
//   const tools = await catalog.search("backlinks for a domain");
//
// Requires TREG_TOKEN in environment.

const TREG_BASE_URL = "https://treg.to";

function getToken(): string {
  const key = process.env.TREG_TOKEN;
  if (!key) {
    throw new Error("TREG_TOKEN not set in environment");
  }
  return key;
}

export interface CallOptions {
  query?: Record<string, string | number | boolean>;
  body?: object;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  idempotencyKey?: string;
  meta?: Record<string, string>;
}

/**
 * Call a treg catalog endpoint or proxy a URL with credential injection.
 * Retries on 429/5xx with exponential backoff.
 * 
 * @param endpoint - Either a catalog id (e.g., "hunter.email.find") or a full URL to proxy
 * @param options - Query params, body, method, idempotency key, meta tags
 * @returns The upstream response as-is
 */
export async function call(endpoint: string, options: CallOptions = {}): Promise<any> {
  const token = getToken();
  
  // Build URL
  const url = new URL(`${TREG_BASE_URL}/call/${endpoint}`);
  
  // Add query params
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      url.searchParams.append(k, String(v));
    }
  }
  
  // Build headers
  const headers: Record<string, string> = {
    "X-Treg-Token": token,
    "Content-Type": "application/json",
  };
  
  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }
  
  // Add meta tags (up to 5 key=value pairs for billing attribution)
  if (options.meta) {
    const metaStr = Object.entries(options.meta)
      .slice(0, 5)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    headers["X-Treg-Meta"] = metaStr;
  }
  
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: options.method ?? (options.body ? "POST" : "GET"),
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (err: any) {
      // Network error — retry with backoff
      if (attempt < maxRetries) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      throw new Error(`treg network error: ${err.message}`);
    }

    // Retry on 429 and 5xx
    if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
      const retryAfter = response.headers.get("Retry-After");
      const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2 ** attempt * 1000;
      await sleep(delay);
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`treg API error ${response.status}: ${text}`);
    }
    
    return response.json();
  }

  // Unreachable — loop either returns or throws — but TS needs it
  throw new Error("treg: exhausted retries without response");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call Hunter company email finder.
 * 
 * @param domain - Company domain
 * @param limit - Max emails to return (default 10)
 * @returns Email addresses found for the domain
 */
export async function hunterFindEmail(
  domain: string,
  limit = 5
): Promise<{
  domain: string;
  pattern: string;
  emails: Array<{
    value: string;
    type: string;
    confidence: number;
    position: string;
    seniority: string;
    department: string;
    verification?: { status: string };
  }>;
}> {
  const result = await call("hunter.companies.emails", { 
    query: { domain, limit } 
  });
  return result.data;
}

/**
 * Call Moz URL metrics (DA/PA/spam).
 * 
 * @param targets - Array of domains or URLs to analyze (max 50)
 * @returns Domain/Page authority, spam score, link counts
 */
export async function mozMetrics(targets: string[]): Promise<Array<{
  page: string;
  domain_authority: number;
  page_authority: number;
  spam_score: number;
  root_domains_to_root_domain: number;
  pages_to_root_domain: number;
}>> {
  const result = await call("moz.web.url.metrics", {
    method: "POST",
    body: { targets },
  });
  return result.results;
}

/**
 * Call Moz backlinks summary.
 * 
 * @param target - Domain to analyze backlinks for
 * @returns Aggregate backlink profile + histograms
 */
export async function mozBacklinksSummary(target: string): Promise<{
  backlinks: number;
  referring_domains: number;
  backlinks_histogram: Record<string, number>;
  referring_domains_histogram: Record<string, number>;
}> {
  return call("moz.web.backlinks.summary", { query: { target } });
}

/**
 * Search treg catalog by capability.
 */
export async function catalogSearch(query: string): Promise<Array<{
  id: string;
  description: string;
  price_per_call: number;
  success_rate: number;
  avg_latency_ms: number;
}>> {
  const token = getToken();
  
  const response = await fetch(`${TREG_BASE_URL}/catalog/search?q=${encodeURIComponent(query)}`, {
    headers: { "X-Treg-Token": token },
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`treg catalog error ${response.status}: ${text}`);
  }
  
  return response.json();
}

/**
 * Get catalog endpoint details.
 */
export async function catalogGet(endpointId: string): Promise<{
  id: string;
  platform: string;
  description: string;
  parameters: Record<string, { type: string; required: boolean; description: string }>;
  price_per_call: number;
  price_provenance: string;
  success_rate: number;
  avg_latency_ms: number;
}> {
  const token = getToken();
  
  const response = await fetch(`${TREG_BASE_URL}/catalog/${endpointId}`, {
    headers: { "X-Treg-Token": token },
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`treg catalog error ${response.status}: ${text}`);
  }
  
  return response.json();
}

/**
 * Check balance and usage.
 */
export async function balance(): Promise<{
  balance_usd: number;
  calls_in_flight: number;
  spent_today_usd: number;
  spent_this_month_usd: number;
}> {
  const token = getToken();
  
  const response = await fetch(`${TREG_BASE_URL}/balance`, {
    headers: { "X-Treg-Token": token },
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`treg balance error ${response.status}: ${text}`);
  }
  
  return response.json();
}

// Catalog namespace for discoverability
export const catalog = {
  search: catalogSearch,
  get: catalogGet,
};
