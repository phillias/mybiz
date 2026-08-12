"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * U3 niche-validation gate: query the live Google SERP via DataForSEO and
 * write a nicheScore row. Verdict rules (schema.ts):
 *   sponsoredCount === 0 && mapPack === false && longTailClusters >= 3 → PASS
 *   otherwise FAIL; API/account failure → PENDING (never blocks).
 *
 * Auth: `DATAFORSEO_API_KEY` is base64("email:password"), sent as the Basic
 * header (per DataForSEO docs). Set on the Convex deployment via
 * `npx convex env set DATAFORSEO_API_KEY <base64> --prod`.
 *
 * longTailClusters is currently a proxy for the number of related searches the
 * SERP returns; refine to true low-competition long-tail clusters if the gate
 * proves too loose.
 */

const DFS_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";

/** DataForSEO's live endpoint intermittently returns empty results for the same
 *  query — retry a few times before giving up to PENDING. */
async function fetchSerp(apiKey: string, keyword: string): Promise<{
  items: Array<Record<string, unknown>>;
}> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(DFS_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Basic ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([{ keyword, location_code: 2840, language_code: "en", depth: 10 }]),
    });
    const data = await res.json();
    const task = (data.tasks ?? [])[0];
    const result = (task?.result ?? [])[0];
    const items = (result?.items ?? []) as Array<Record<string, unknown>>;
    if (res.ok && result && items.length > 0) return { items };
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return { items: [] };
}

export const checkNiche = action({
  args: {
    keyword: v.string(),
  },
  handler: async (
    ctx,
    { keyword },
  ): Promise<{
    keyword: string;
    sponsoredCount: number;
    mapPack: boolean;
    top10AuthorityMedian?: number;
    longTailClusters: number;
    verdict: "PASS" | "FAIL" | "PENDING";
  }> => {
    const apiKey = process.env.DATAFORSEO_API_KEY;
    if (!apiKey) throw new Error("DATAFORSEO_API_KEY not set on the Convex deployment");

    const { items } = await fetchSerp(apiKey, keyword);

    if (items.length === 0) {
      await ctx.runMutation(internal.nicheScoreWrite.upsert, {
        keyword,
        sponsoredCount: 0,
        mapPack: false,
        longTailClusters: 0,
        verdict: "PENDING",
        source: `dataforseo ${new Date().toISOString().slice(0, 10)}`,
      });
      return {
        keyword,
        sponsoredCount: 0,
        mapPack: false,
        longTailClusters: 0,
        verdict: "PENDING",
      };
    }

    const sponsoredCount = items.filter((i) => i.type === "paid").length;
    const mapPack = items.some((i) => i.type === "local_pack");
    // The advanced SERP endpoint returns no authority metric per result — leave
    // top10AuthorityMedian unset unless a backlinks/domain-rank source is added.
    const top10AuthorityMedian = undefined;
    // Google's related searches arrive as items of type `related_searches`,
    // each carrying a list of phrase entries (low-competition long-tail proxies).
    const longTailClusters = items
      .filter((i) => i.type === "related_searches")
      .reduce((n, i) => n + (Array.isArray(i.items) ? i.items.length : 0), 0);

    const verdict =
      sponsoredCount === 0 && !mapPack && longTailClusters >= 3
        ? "PASS"
        : "FAIL";

    await ctx.runMutation(internal.nicheScoreWrite.upsert, {
      keyword,
      sponsoredCount,
      mapPack,
      top10AuthorityMedian,
      longTailClusters,
      verdict,
      source: `dataforseo ${new Date().toISOString().slice(0, 10)}`,
    });

    return {
      keyword,
      sponsoredCount,
      mapPack,
      top10AuthorityMedian,
      longTailClusters,
      verdict,
    };
  },
});
