// DataForSEO client for the Prospect Radar pipeline. The SERP gate is verified
// in production (mirrors convex/actions/checkNiche.ts). The Google Maps
// discovery endpoint uses the SERP Google Maps Advanced Live endpoint.
//
// Auth: DATAFORSEO_API_KEY is base64("email:password"), sent as the Basic
// header (per DataForSEO docs). Never printed; discovery never runs without
// --apply.

import { normalizeDomain } from "./scoring.mjs";

const DFS_SERP_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";
const DFS_MAPS_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/maps/live/advanced";

async function post(apiKey, endpoint, payload) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Basic ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${data.status_message ?? res.statusText}`);
  const task = (data.tasks ?? [])[0];
  if (task?.status_code !== 20000) {
    throw new Error(`DataForSEO task ${task?.status_code ?? "?"}: ${task?.status_message ?? "no result"}`);
  }
  return task;
}

// Live Google SERP gate — same endpoint/payload parsing as
// convex/actions/checkNiche.ts (sponsoredCount, mapPack, longTailClusters)
// plus the map-pack domains for per-business in-pack detection.
export async function fetchSerp({ apiKey, keyword }) {
  const task = await post(apiKey, DFS_SERP_ENDPOINT, [
    { keyword, location_code: 2840, language_code: "en", depth: 10 },
  ]);
  const items = ((task?.result ?? [])[0]?.items ?? []) ?? [];
  const sponsoredCount = items.filter((i) => i.type === "paid").length;
  const mapPack = items.some((i) => i.type === "local_pack");
  const longTailClusters = items
    .filter((i) => i.type === "related_searches")
    .reduce((n, i) => n + (Array.isArray(i.items) ? i.items.length : 0), 0);
  const packDomains = items
    .filter((i) => i.type === "local_pack")
    .flatMap((i) => (Array.isArray(i.items) ? i.items : []))
    .map((it) => normalizeDomain(it.domain ?? it.url ?? ""));
  return { sponsoredCount, mapPack, longTailClusters, packDomains };
}

export function inPack(packDomains, website) {
  const d = normalizeDomain(website);
  return d !== "" && packDomains.includes(d);
}

// Maps discovery (STUB) — requires --apply. Normalizes raw items into prospect
// records; the field names below are best-effort and must be re-verified
// against the TODO above.
export async function discoverBusinesses({ apiKey, category, city, limit = 20 }) {
  const task = await post(apiKey, DFS_MAPS_ENDPOINT, [
    { keyword: `${category} ${city}`, location_code: 2840, language_code: "en", depth: Math.min(limit, 20) },
  ]);
  const items = (((task?.result ?? [])[0]?.items ?? []) ?? []).slice(0, limit);
  return items.map((it) => ({
    name: it.title ?? it.name ?? "",
    address: it.address ?? "",
    phone: it.phone ?? "",
    website: it.url ?? it.website ?? "",
    reviewCount: it.rating_count ?? it.reviews ?? 0,
    rating: it.rating ?? undefined,
    businessStatus: it.business_status ?? "",
    category,
    city,
  }));
}
