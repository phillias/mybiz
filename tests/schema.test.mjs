import { describe, expect, it } from "vitest";
import { blogPostingSchema, faqSchema, organizationSchema, serviceSchema, websiteSchema } from "../src/lib/schema";

describe("organizationSchema", () => {
  it("names the Organization 'Phileas' with the codevex.app origin", () => {
    const org = organizationSchema();
    expect(org["@type"]).toBe("Organization");
    expect(org.name).toBe("Phileas");
    expect(org.url).toBe("https://codevex.app/");
    expect(org.logo).toBe("https://codevex.app/og-image.png");
    expect(org.email).toBe("admin@codevex.app");
  });
});

describe("websiteSchema", () => {
  it("references the Organization as publisher", () => {
    const site = websiteSchema();
    expect(site["@type"]).toBe("WebSite");
    expect(site.name).toBe("Phileas Fogg");
    expect(site.publisher["@id"]).toBe("https://codevex.app/#organization");
  });
});

describe("blogPostingSchema", () => {
  it("carries datePublished, author Person, headline, description, image", () => {
    const post = blogPostingSchema({
      title: "Local-first memory",
      description: "How agents remember.",
      path: "/articles/local-first-memory/",
      publishedAt: "2026-08-12",
      imagePath: "/articles/local-first-memory/img-1.png",
    });
    expect(post["@type"]).toBe("BlogPosting");
    expect(post.headline).toBe("Local-first memory");
    expect(post.description).toBe("How agents remember.");
    expect(post.datePublished).toBe("2026-08-12");
    expect(post.author).toMatchObject({ "@type": "Person", name: "Phileas Fogg" });
    expect(post.image).toBe("https://codevex.app/articles/local-first-memory/img-1.png");
    expect(post.mainEntityOfPage["@id"]).toBe("https://codevex.app/articles/local-first-memory/");
  });

  it("falls back to the site OG image when the article has none", () => {
    const post = blogPostingSchema({
      title: "T",
      description: "D",
      path: "/articles/t/",
      publishedAt: "2026-01-01",
    });
    expect(post.image).toBe("https://codevex.app/og-image.png");
  });
});

describe("faqSchema", () => {
  it("builds Question/acceptedAnswer pairs", () => {
    const faq = faqSchema([{ question: "Q?", answer: "A." }]);
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: "Q?",
      acceptedAnswer: { "@type": "Answer", text: "A." },
    });
  });

  it("returns null for an empty FAQ (dropped from the graph)", () => {
    expect(faqSchema([])).toBeNull();
  });
});

describe("serviceSchema (Core 30 pattern)", () => {
  it("builds a Service with provider and areaServed cities", () => {
    const service = serviceSchema({
      name: "Drain cleaning",
      description: "Drain cleaning in Alanson, Michigan.",
      path: "/services/drain-cleaning/",
      providerName: "Alanson Plumbing",
      serviceArea: ["Alanson", "Petoskey"],
    });
    expect(service["@type"]).toBe("Service");
    expect(service.provider).toEqual({ "@type": "Organization", name: "Alanson Plumbing" });
    expect(service.areaServed).toEqual([
      { "@type": "City", name: "Alanson" },
      { "@type": "City", name: "Petoskey" },
    ]);
  });

  it("omits areaServed when no service area is given", () => {
    const service = serviceSchema({
      name: "N",
      description: "D",
      path: "/services/n/",
      providerName: "P",
    });
    expect(service).not.toHaveProperty("areaServed");
  });
});
