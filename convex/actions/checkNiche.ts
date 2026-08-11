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

function median(nums: number[]): number | undefined {
  if (nums.length === 0) return undefined;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
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

    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
    const res = await fetch(DFS_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Basic ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([{ url: googleUrl, location_code: 2840, language_code: "en" }]),
    });
    const data = await res.json();

    const task = (data.tasks ?? [])[0];
    const result = (task?.result ?? [])[0];
    const items = (result?.items ?? []) as Array<Record<string, unknown>>;

    if (!res.ok || !result || items.length === 0) {
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
    const organic = items.filter((i) => i.type === "organic").slice(0, 10);
    const authorities = organic
      .map((i) => (typeof i.referred_domains === "number" ? i.referred_domains : undefined))
      .filter((n): n is number => typeof n === "number");
    const top10AuthorityMedian = median(authorities);
    const related = result.related_results;
    const longTailClusters = Array.isArray(related) ? related.length : 0;

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
