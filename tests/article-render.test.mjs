import { describe, expect, it } from "vitest";
import {
  buildArticlePage,
  extractDescription,
  extractFaq,
  extractImageUrls,
  extractTitle,
  htmlToText,
  imageDimensions,
  imageExtension,
} from "../scripts/lib/article-render.mjs";
import { blogPostingSchema, faqSchema } from "../src/lib/schema";

describe("htmlToText", () => {
  it("strips tags, decodes entities, collapses whitespace", () => {
    expect(htmlToText("<p>A &amp; B &nbsp; — <strong>C</strong></p>")).toBe("A & B — C");
  });
});

describe("extractTitle", () => {
  it("returns the first h1 text", () => {
    expect(extractTitle("<h1 class='x'>Hello <em>World</em></h1><h2>no</h2>")).toBe("Hello World");
  });
  it("returns null without an h1", () => {
    expect(extractTitle("<p>none</p>")).toBeNull();
  });
});

describe("extractDescription", () => {
  it("uses the first paragraph when under the limit", () => {
    const html = "<h1>T</h1><p>Short lead paragraph.</p><p>Second.</p>";
    expect(extractDescription(html)).toBe("Short lead paragraph.");
  });

  it("trims to ~155 chars on a word boundary with an ellipsis", () => {
    const long = "word ".repeat(60).trim(); // 300 chars
    const html = `<p>${long}</p>`;
    const out = extractDescription(html);
    expect(out.length).toBeLessThanOrEqual(156); // 155 + ellipsis
    expect(out.endsWith("…")).toBe(true);
    expect(out.slice(0, -1)).not.toMatch(/\s$/);
  });

  it("falls back to the next paragraph when the first is empty", () => {
    const html = "<p></p><p>Real content.</p>";
    expect(extractDescription(html)).toBe("Real content.");
  });

  it("returns null when there are no paragraphs", () => {
    expect(extractDescription("<h1>only a heading</h1>")).toBeNull();
  });
});

const FAQ_HTML = `
<h2>Why this matters</h2>
<h3>Ignored question?</h3><p>Ignored answer.</p>
<h2>Frequently Asked Questions</h2>
<h3>What is local-first memory?</h3><p>It is a memory layer close to home.</p>
<h3>How do I stop forgetting?</h3><p>Store decisions as structured memory.</p>
<h2>Conclusion</h2>
<h3>After the FAQ?</h3><p>Not included.</p>
`;

describe("extractFaq", () => {
  it("collects h3/p pairs after the FAQ heading, until the next h2", () => {
    const items = extractFaq(FAQ_HTML);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      question: "What is local-first memory?",
      answer: "It is a memory layer close to home.",
    });
    expect(items[1].question).toBe("How do I stop forgetting?");
  });

  it("returns [] when no FAQ section exists", () => {
    expect(extractFaq("<h2>Intro</h2><h3>Q?</h3><p>A.</p>")).toEqual([]);
  });
});

describe("extractImageUrls", () => {
  it("collects unique remote img srcs in order", () => {
    const html = `<img src="https://a.example/1.png" alt="x"><img src="/local.png"><img src="https://a.example/1.png"><img src="https://a.example/2.jpg">`;
    expect(extractImageUrls(html)).toEqual(["https://a.example/1.png", "https://a.example/2.jpg"]);
  });
});

describe("imageDimensions", () => {
  it("reads PNG IHDR dimensions", () => {
    const b = Buffer.alloc(24);
    b.write("\x89PNG\r\n\x1a\n", 0, "binary");
    b.writeUInt32BE(1376, 16);
    b.writeUInt32BE(768, 20);
    expect(imageDimensions(b)).toEqual({ width: 1376, height: 768 });
  });

  it("reads GIF dimensions", () => {
    const b = Buffer.alloc(10);
    b.write("GIF89a", 0, "binary");
    b.writeUInt16LE(64, 6);
    b.writeUInt16LE(32, 8);
    expect(imageDimensions(b)).toEqual({ width: 64, height: 32 });
  });

  it("returns null for unknown bytes", () => {
    expect(imageDimensions(Buffer.from("not an image at all...."))).toBeNull();
  });
});

describe("imageExtension", () => {
  it("maps content-types and rejects non-images", () => {
    expect(imageExtension("image/png")).toBe("png");
    expect(imageExtension("image/jpeg; charset=binary")).toBe("jpg");
    expect(imageExtension("image/webp")).toBe("webp");
    expect(imageExtension("text/html")).toBeNull();
    expect(imageExtension("")).toBeNull();
  });
});

describe("buildArticlePage", () => {
  function evalPageCode(source) {
    const m = source.match(/---\n([\s\S]*?)\n---/);
    if (!m) throw new Error("No code fence found");
    let code = m[1]
      .replace(/^import\s+.*?from\s+["'][^"']+["'];?\s*$/gm, "")
      .replace(/export\s+const\s+frontmatter\s*=/, "const frontmatter =");
    const fn = new Function(
      "blogPostingSchema", "faqSchema",
      code + "\nreturn { frontmatter, schemas, content, path };"
    );
    return fn(blogPostingSchema, faqSchema);
  }

  function getTemplate(source) {
    return source.split("---\n").slice(2).join("---\n");
  }

  it("produces frontmatter with all article metadata", () => {
    const page = buildArticlePage({
      title: "Test Article",
      slug: "test-article",
      description: "A test description.",
      publishedAt: "2026-08-12",
      updatedAt: "2026-08-24",
      imagePath: "/articles/test-article/img-1.png",
      faq: [{ question: "Q?", answer: "A." }],
      html: "<h1>Test Article</h1><p>Body.</p>",
    });
    const { frontmatter } = evalPageCode(page);
    expect(frontmatter).toEqual({
      title: "Test Article",
      slug: "test-article",
      description: "A test description.",
      publishedAt: "2026-08-12",
      updatedAt: "2026-08-24",
      image: "/articles/test-article/img-1.png",
      imageWidth: null,
      imageHeight: null,
      faq: [{ question: "Q?", answer: "A." }],
    });
  });

  it("emits BlogPosting JSON-LD with correct semantic fields", () => {
    const page = buildArticlePage({
      title: "Test Article",
      slug: "test-article",
      description: "A test description.",
      publishedAt: "2026-08-12",
      updatedAt: "2026-08-24",
      imagePath: "/articles/test-article/img-1.png",
      faq: [],
      html: "<p>Body.</p>",
    });
    const { schemas } = evalPageCode(page);
    expect(schemas).toHaveLength(1);
    expect(schemas[0]).toMatchObject({
      "@type": "BlogPosting",
      headline: "Test Article",
      description: "A test description.",
      datePublished: "2026-08-12",
      dateModified: "2026-08-24",
    });
    expect(schemas[0].author).toMatchObject({
      "@type": "Person",
      name: "Phileas Fogg",
    });
  });

  it("emits FAQPage JSON-LD when FAQ items are present", () => {
    const page = buildArticlePage({
      title: "T",
      slug: "t",
      description: "d",
      publishedAt: "2026-01-01",
      updatedAt: "2026-01-01",
      imagePath: null,
      faq: [
        { question: "Q1?", answer: "A1." },
        { question: "Q2?", answer: "A2." },
      ],
      html: "<p>x</p>",
    });
    const { schemas } = evalPageCode(page);
    expect(schemas).toHaveLength(2);
    expect(schemas[1]).toMatchObject({
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "Q1?" },
        { "@type": "Question", name: "Q2?" },
      ],
    });
  });

  it("falls back to publishedAt for dateModified when updatedAt is omitted", () => {
    const page = buildArticlePage({
      title: "T",
      slug: "t",
      description: "d",
      publishedAt: "2026-01-01",
      updatedAt: undefined,
      imagePath: null,
      faq: [],
      html: "<p>x</p>",
    });
    const { schemas } = evalPageCode(page);
    expect(schemas[0].dateModified).toBe("2026-01-01");
  });

  it("sets frontmatter image to null and falls back to OG image in schema when no image is localized", () => {
    const page = buildArticlePage({
      title: "T",
      slug: "t",
      description: "d",
      publishedAt: "2026-01-01",
      updatedAt: "2026-01-01",
      imagePath: null,
      faq: [],
      html: "<p>x</p>",
    });
    const { frontmatter, schemas } = evalPageCode(page);
    expect(frontmatter.image).toBeNull();
    expect(schemas[0].image).toBe("https://codevex.app/og-image.png");
  });

  it("embeds the body HTML in the rendered template", () => {
    const body = "<h1>Test Article</h1><p>Body.</p>";
    const page = buildArticlePage({
      title: "Test Article",
      slug: "test-article",
      description: "d",
      publishedAt: "2026-01-01",
      updatedAt: "2026-01-01",
      imagePath: null,
      faq: [],
      html: body,
    });
    const { content } = evalPageCode(page);
    expect(content).toBe(body);
  });

  it("includes a visible Last updated timestamp in the template", () => {
    const page = buildArticlePage({
      title: "T",
      slug: "t",
      description: "d",
      publishedAt: "2026-01-01",
      updatedAt: "2026-08-24",
      imagePath: null,
      faq: [],
      html: "<p>x</p>",
    });
    const { frontmatter } = evalPageCode(page);
    const template = getTemplate(page);
    const bylineMatch = template.match(/<p class="byline">([\s\S]*?)<\/p>/);
    expect(bylineMatch).toBeTruthy();
    const byline = bylineMatch[1];
    expect(byline).toContain("Last updated");
    expect(byline).toContain("{updatedAt}");
    expect(frontmatter.updatedAt).toBe("2026-08-24");
  });

  it("passes image dimensions through frontmatter and BaseLayout when provided", () => {
    const page = buildArticlePage({
      title: "T",
      slug: "t",
      description: "d",
      publishedAt: "2026-01-01",
      updatedAt: "2026-01-01",
      imagePath: "/articles/t/img-1.png",
      imageWidth: 1376,
      imageHeight: 768,
      faq: [],
      html: "<p>x</p>",
    });
    const { frontmatter } = evalPageCode(page);
    expect(frontmatter.imageWidth).toBe(1376);
    expect(frontmatter.imageHeight).toBe(768);
    expect(page).toContain("imageWidth={imageWidth}");
    expect(page).toContain("imageHeight={imageHeight}");
  });

  it("defaults imageWidth and imageHeight to null when omitted", () => {
    const page = buildArticlePage({
      title: "T",
      slug: "t",
      description: "d",
      publishedAt: "2026-01-01",
      updatedAt: "2026-01-01",
      imagePath: "/articles/t/img-1.png",
      faq: [],
      html: "<p>x</p>",
    });
    const { frontmatter } = evalPageCode(page);
    expect(frontmatter.imageWidth).toBeNull();
    expect(frontmatter.imageHeight).toBeNull();
  });
});
