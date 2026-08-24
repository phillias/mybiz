// JSON-LD (schema.org) builders for AEO/GEO readiness — audit F14 (zero
// structured data sitewide). Every builder returns a plain object graph;
// BaseLayout injects them via a single <script type="application/ld+json">.
//
// Entity model (captain decision 2026-08-24): Organization name is "Phileas"
// (the corporate entity); the site brand "Phileas Fogg" is the WebSite name.
// No sameAs/social links are emitted — none exist yet (audit §3.4), and
// fabricating them would poison entity resolution.
import { absoluteUrl, contactEmail, ogImagePath, organizationName, siteName, siteUrl } from "../config/site";

type JsonLdObject = Record<string, unknown>;

export interface FaqItem {
  question: string;
  answer: string;
}

export function organizationSchema(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: organizationName,
    alternateName: siteName,
    url: absoluteUrl("/"),
    logo: absoluteUrl(ogImagePath),
    email: contactEmail,
  };
}

export function websiteSchema(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: siteName,
    url: absoluteUrl("/"),
    publisher: { "@id": `${siteUrl}/#organization` },
  };
}

export interface BlogPostingInput {
  title: string;
  description: string;
  /** Site-relative path with trailing slash, e.g. "/articles/my-slug/". */
  path: string;
  /** ISO date (YYYY-MM-DD) the article was published. */
  publishedAt: string;
  /** Site-relative path of the article's lead image, or null for the site OG image. */
  imagePath?: string | null;
}

export function blogPostingSchema(input: BlogPostingInput): JsonLdObject {
  const image = absoluteUrl(input.imagePath || ogImagePath);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": absoluteUrl(input.path),
    headline: input.title,
    description: input.description,
    datePublished: input.publishedAt,
    dateModified: input.publishedAt,
    image,
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(input.path) },
    author: {
      "@type": "Person",
      name: siteName,
      url: absoluteUrl("/"),
    },
    publisher: { "@id": `${siteUrl}/#organization` },
  };
}

export function faqSchema(items: FaqItem[]): JsonLdObject | null {
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * Service/LocalBusiness schema pattern reserved for Core 30 pages — the page
 * blueprints already carry `schemaType` (content/blueprints/core30-sample.json).
 * Unspecified fields stay undefined (not fabricated) so the generator fills
 * them from the client's Google Business Profile data at render time.
 */
export interface ServiceSchemaInput {
  name: string;
  description: string;
  path: string;
  providerName: string;
  serviceArea?: string[];
}

export function serviceSchema(input: ServiceSchemaInput): JsonLdObject {
  const area: string[] | undefined = input.serviceArea?.length ? input.serviceArea : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": absoluteUrl(input.path),
    name: input.name,
    description: input.description,
    provider: { "@type": "Organization", name: input.providerName },
    ...(area ? { areaServed: area.map((city) => ({ "@type": "City", name: city })) } : {}),
  };
}
