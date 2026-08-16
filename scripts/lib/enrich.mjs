// Free (non-billing) enrichment for the Prospect Radar pipeline: homepage
// crawl for site thinness and Google PageSpeed Insights. Both fail soft —
// callers keep the signal neutral on error.

const UA = "harbor-prospect-radar/0.1";

function toUrl(site) {
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}

export async function crawlWebsite(website) {
  const u = toUrl(website);
  const res = await fetch(u, { headers: { "user-agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`crawl ${res.status} for ${website}`);
  const html = await res.text();
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const meta =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ??
    "";
  const words = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  let pages;
  try {
    const smUrl = html.match(/<link[^>]+rel=["']sitemap["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? new URL("/sitemap.xml", u).href;
    const smRes = await fetch(smUrl, { headers: { "user-agent": UA }, redirect: "follow" });
    if (smRes.ok) {
      const sm = await smRes.text();
      const count = (sm.match(/<url>/g) ?? []).length;
      if (count > 0) pages = count;
    }
  } catch {}
  return { title, meta, words, pages };
}

export async function fetchPageSpeed(website) {
  const key = process.env.PSI_API_KEY ? `&key=${encodeURIComponent(process.env.PSI_API_KEY)}` : "";
  const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(toUrl(website))}&strategy=mobile${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PSI ${res.status} for ${website}`);
  const data = await res.json();
  const score = data?.lighthouseResult?.categories?.performance?.score;
  if (typeof score !== "number") throw new Error(`PSI no score for ${website}`);
  return Math.round(score * 100);
}
