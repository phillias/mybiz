// Pure logic for scripts/render-article.mjs — kept dependency-free and
// side-effect-free so it is unit-testable (tests/article-render.test.ts).
// The CLI owns all I/O (fs, network); everything here takes strings in and
// returns strings/data out.

export const DESCRIPTION_LIMIT = 155;

/** Strip tags, decode common entities, collapse whitespace. */
export function htmlToText(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#8217;/g, "’")
    .replace(/\s+/g, " ")
    .trim();
}

/** First <h1> text, or null. */
export function extractTitle(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return m ? htmlToText(m[1]) : null;
}

/**
 * Meta description source: explicit prose wins; otherwise the first <p> of
 * the body, trimmed to ~155 chars on a word boundary (audit F17).
 */
export function extractDescription(html, { limit = DESCRIPTION_LIMIT } = {}) {
  const paras = html.match(/<p[^>]*>[\s\S]*?<\/p>/g) || [];
  for (const p of paras) {
    const text = htmlToText(p);
    if (!text) continue;
    if (text.length <= limit) return text;
    const cut = text.slice(0, limit);
    const lastSpace = cut.lastIndexOf(" ");
    return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
  }
  return null;
}

/**
 * FAQ pairs from the article's FAQ section: <h3>Question</h3> followed by its
 * first <p>answer</p>, collected after an <h2>Frequently Asked Questions</h2>
 * heading until the next <h2> (audit F20 — the sections already exist).
 */
export function extractFaq(html) {
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)];
  const faqHeading = h2s.find((m) => /frequently asked questions/i.test(htmlToText(m[1])));
  if (!faqHeading) return [];
  const start = faqHeading.index + faqHeading[0].length;
  const nextH2 = html.slice(start).search(/<h2[\s>]/);
  const section = nextH2 >= 0 ? html.slice(start, start + nextH2) : html.slice(start);

  const items = [];
  const headings = [...section.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)];
  for (const h of headings) {
    const after = section.slice(h.index + h[0].length);
    const p = after.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const question = htmlToText(h[1]);
    const answer = p ? htmlToText(p[1]) : "";
    if (question && answer) items.push({ question, answer });
  }
  return items;
}

/** Remote (http/https) image URLs referenced by <img> tags, in order. */
export function extractImageUrls(html) {
  const urls = [];
  for (const m of html.matchAll(/<img\b[^>]*\bsrc="(https?:\/\/[^"]+)"[^>]*>/g)) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }
  return urls;
}

/**
 * Parse intrinsic pixel dimensions from an image buffer header (PNG, GIF,
 * JPEG, WebP). Returns null when the format is unrecognized.
 */
export function imageDimensions(buffer) {
  const b = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (b.length < 10) return null;
  // PNG: 8-byte signature + IHDR
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    if (b.length < 24) return null;
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  // GIF: "GIF8" + dimensions little-endian at offset 6
  if (b.slice(0, 4).toString("ascii") === "GIF8") {
    return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  }
  // JPEG: scan segment markers for SOFn
  if (b[0] === 0xff && b[1] === 0xd8) {
    let off = 2;
    while (off + 9 < b.length) {
      if (b[off] !== 0xff) break;
      const marker = b[off + 1];
      const len = b.readUInt16BE(off + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: b.readUInt16BE(off + 5), width: b.readUInt16BE(off + 7) };
      }
      off += 2 + len;
    }
    return null;
  }
  // WebP: RIFF....WEBP + VP8/VP8L/VP8X chunk
  if (b.slice(0, 4).toString("ascii") === "RIFF" && b.slice(8, 12).toString("ascii") === "WEBP") {
    const chunk = b.slice(12, 16).toString("ascii");
    if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  }
  return null;
}

/** File extension for an image content-type (or null when not an image). */
export function imageExtension(contentType) {
  const type = (contentType || "").split(";")[0].trim().toLowerCase();
  return (
    {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg",
      "image/avif": "avif",
    }[type] || null
  );
}

/**
 * Rewrite the page template for a rendered article. Pure: frontmatter values
 * in, Astro source out.
 */
export function buildArticlePage({ title, slug, description, publishedAt, updatedAt, imagePath, faq, html }) {
  return `---
// Generated by scripts/render-article.mjs — do not edit by hand.
import BaseLayout from "../../layouts/BaseLayout.astro";
import { contactEmail } from "../../config/site";
import { blogPostingSchema, faqSchema } from "../../lib/schema";

export const frontmatter = {
  title: ${JSON.stringify(title)},
  slug: ${JSON.stringify(slug)},
  description: ${JSON.stringify(description)},
  publishedAt: ${JSON.stringify(publishedAt)},
  updatedAt: ${JSON.stringify(updatedAt)},
  image: ${JSON.stringify(imagePath)},
  faq: ${JSON.stringify(faq)},
};
const { title, slug, description, publishedAt, updatedAt, image, faq } = frontmatter;
const content = ${JSON.stringify(html)};
const path = \`/articles/\${slug}/\`;
const schemas = [
  blogPostingSchema({ title, description, path, publishedAt, imagePath: image }),
  faqSchema(faq),
].filter(Boolean);
---

<BaseLayout
  title={\`\${title} — Phileas Fogg\`}
  description={description}
  path={path}
  type="article"
  publishedTime={publishedAt}
  imagePath={image}
  jsonLd={schemas}
>
  <header class="site-header">
    <a class="wordmark" href="/">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6" /><ellipse cx="12" cy="12" rx="4" ry="9.5" fill="none" stroke="currentColor" stroke-width="1.1" /><line x1="2.5" y1="12" x2="21.5" y2="12" stroke="currentColor" stroke-width="1.1" /><circle cx="19" cy="6" r="2.2" fill="currentColor" /></svg>
      <span>Phileas&nbsp;Fogg</span>
    </a>
    <nav aria-label="Primary">
      <a href="/#route">The route</a>
      <a href="/#everywhere">Everywhere</a>
      <a href="/opt-in">SMS opt-in</a>
      <a href={\`mailto:\${contactEmail}\`}>Contact</a>
    </nav>
  </header>

  <main class="article">
    <article set:html={content} />
    <p class="byline">Written by Phileas Fogg. Last updated {updatedAt}.</p>
  </main>

  <footer class="site-footer">
    <span>© 2026 Phileas Fogg</span>
    <nav aria-label="Footer">
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href={\`mailto:\${contactEmail}\`}>Contact</a>
    </nav>
  </footer>

  <style is:global>
    :root {
      --ink: #0b1f33; --paper: #f6f2ea; --paper-2: #ece5d7; --text: #18222d;
      --muted: #5c6671; --accent: #e56b2b; --accent-strong: #b6480f; --line: rgba(11,31,51,0.14);
      --font-display: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
      --font-body: "Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: var(--font-body); color: var(--text); background: var(--paper); line-height: 1.75; -webkit-font-smoothing: antialiased; }
    a { color: var(--accent-strong); text-underline-offset: 3px; }
    :focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
    .site-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 5vw; background: rgba(246,242,234,0.92); border-bottom: 1px solid var(--line); position: sticky; top: 0; }
    .wordmark { display: inline-flex; align-items: center; gap: 0.5rem; font-family: var(--font-display); font-weight: 700; font-size: 1.15rem; color: var(--ink); text-decoration: none; }
    .wordmark svg { color: var(--accent); }
    .site-header nav, .site-footer nav { display: flex; gap: 1.4rem; align-items: center; }
    .site-header nav a { color: var(--ink); text-decoration: none; font-size: 0.95rem; font-weight: 500; }
    .site-header nav a:hover { color: var(--accent-strong); }
    .article { max-width: 760px; margin: 0 auto; padding: clamp(3rem, 8vw, 5rem) 1.25rem; }
    .article h1 { font-family: var(--font-display); font-weight: 800; font-size: clamp(2rem, 5vw, 3rem); line-height: 1.1; letter-spacing: -0.02em; color: var(--ink); margin: 0 0 1.4rem; }
    .article h2 { font-family: var(--font-display); font-weight: 700; font-size: 1.5rem; color: var(--ink); margin: 2.4rem 0 0.7rem; }
    .article h3 { font-family: var(--font-display); font-weight: 700; font-size: 1.2rem; color: var(--ink); margin: 1.8rem 0 0.5rem; }
    .article p, .article li { color: var(--text); font-size: 1.05rem; }
    .article img { max-width: 100%; height: auto; border-radius: 12px; margin: 1.2rem 0; }
    .article ul, .article ol { padding-left: 1.3rem; }
    .byline { margin-top: 2.6rem; padding-top: 1rem; border-top: 1px solid var(--line); color: var(--muted); font-size: 0.9rem; }
    .site-footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding: 1.4rem 5vw; background: var(--ink); color: rgba(246,242,234,0.7); font-size: 0.9rem; }
    .site-footer nav a { color: rgba(246,242,234,0.7); text-decoration: none; }
    .site-footer nav a:hover { color: var(--paper); }
    @media (max-width: 480px) { .site-header { flex-wrap: wrap; } }
  </style>
</BaseLayout>
`;
}
