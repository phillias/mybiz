// Exa AI search API wrapper for mybiz.
// Augments DataForSEO with neural search (embeddings) for entity/attribute
// retrieval. Does NOT replace DataForSEO for SERP/Maps data.
//
// Usage:
//   import { search, answer, companySearch } from "../lib/exa";
//
// Requires EXA_API_KEY in environment (.env).

import Exa from "exa-js";

let _client: any = null;

function getClient(): any {
  if (_client) return _client;
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error("EXA_API_KEY not set (add to .env)");
  _client = new Exa(apiKey);
  return _client;
}

export interface ExaSearchResult {
  url: string;
  title: string;
  text?: string;
  highlights?: string[];
  summary?: string;
  publishedDate?: string;
  author?: string;
}

export interface ExaSearchParams {
  query: string;
  numResults?: number;
  type?: "auto" | "fast" | "instant" | "deep-lite" | "deep" | "deep-reasoning";
  category?: "company" | "people" | "research paper" | "news" | "personal site" | "financial report";
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  highlights?: boolean;
  text?: boolean;
  summary?: boolean;
}

export async function search(params: ExaSearchParams): Promise<ExaSearchResult[]> {
  const exa = getClient();
  const {
    query,
    numResults = 10,
    type = "auto",
    category,
    includeDomains,
    excludeDomains,
    startPublishedDate,
    highlights = true,
    text = false,
    summary = false,
  } = params;

  const contents: Record<string, boolean | object> = {};
  if (highlights) contents.highlights = true;
  if (text) contents.text = { maxCharacters: 2000 };
  if (summary) contents.summary = true;

  const response = await exa.search(query, {
    numResults,
    type,
    ...(category ? { category } : {}),
    ...(includeDomains ? { includeDomains } : {}),
    ...(excludeDomains ? { excludeDomains } : {}),
    ...(startPublishedDate ? { startPublishedDate } : {}),
    contents: Object.keys(contents).length > 0 ? contents : undefined,
  });

  return (response.results || []).map((r: any) => ({
    url: r.url,
    title: r.title,
    ...(r.text ? { text: r.text } : {}),
    ...(r.highlights ? { highlights: r.highlights } : {}),
    ...(r.summary ? { summary: r.summary } : {}),
    ...(r.publishedDate ? { publishedDate: r.publishedDate } : {}),
    ...(r.author ? { author: r.author } : {}),
  }));
}

export interface ExaAnswerResult {
  content: string;
  citations: { url: string; title: string }[];
}

export async function answer(query: string, options?: {
  includeDomains?: string[];
}): Promise<ExaAnswerResult> {
  const exa = getClient();
  const response = await exa.answer(query, {
    ...(options?.includeDomains ? { includeDomains: options.includeDomains } : {}),
  });
  return {
    content: response.content || response.answer || "",
    citations: response.citations || [],
  };
}

/**
 * Search for company entities — useful for Prospect Radar enrichment.
 * Returns company pages with highlights for quick scanning.
 */
export async function companySearch(
  companyName: string,
  options?: { numResults?: number; text?: boolean }
): Promise<ExaSearchResult[]> {
  return search({
    query: companyName,
    category: "company",
    numResults: options?.numResults ?? 5,
    highlights: true,
    text: options?.text ?? false,
    ...options,
  });
}

/**
 * Search for research papers — useful for Harbor content research.
 */
export async function researchSearch(
  topic: string,
  options?: { numResults?: number; startPublishedDate?: string }
): Promise<ExaSearchResult[]> {
  return search({
    query: topic,
    category: "research paper",
    numResults: options?.numResults ?? 10,
    highlights: true,
    ...(options?.startPublishedDate ? { startPublishedDate: options.startPublishedDate } : {}),
  });
}

/**
 * Check if a domain is cited in Exa's answer to a query.
 * Returns the answer text plus whether the domain appeared in citations.
 */
export async function checkCitation(
  query: string,
  domain: string
): Promise<{ cited: boolean; answer: string; citations: { url: string; title: string }[] }> {
  const result = await answer(query);
  const cited = result.citations.some((c) => c.url.includes(domain));
  return { cited, answer: result.content, citations: result.citations };
}
