#!/usr/bin/env node
// Render a Harbor draft (HTML fragment) into a committed Astro article page at
// src/pages/articles/<slug>.astro, wrapped in the site chrome via
// src/layouts/BaseLayout. This is the "publish" stage:
// draft -> page -> build -> Pages deploy.
//
//   node scripts/render-article.mjs --draft content/drafts/<file>.html
//   node scripts/render-article.mjs --draft <file> --slug my-slug --title "My title"
//   node scripts/render-article.mjs --draft <file> --description "..." --date 2026-08-12
//   node scripts/render-article.mjs --draft <file> --no-images   # skip image localization
//
// AEO upgrades (2026-08-24): meta description (explicit or first <p> trimmed
// to ~155 chars), publishedAt in frontmatter + BlogPosting schema, a visible
// "Last updated" stamp, FAQPage JSON-LD from the FAQ section, and image
// localization — remote (Convex storage) images are downloaded into
// public/articles/<slug>/, their src rewritten, and width/height stamped
// (fixes audit F17/F18).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import {
  buildArticlePage,
  extractDescription,
  extractFaq,
  extractImageUrls,
  extractTitle,
  imageDimensions,
  imageExtension,
} from "./lib/article-render.mjs";

function arg(name) {
  const args = process.argv.slice(2);
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

async function localizeImages(html, slug, { log = () => {} } = {}) {
  const urls = extractImageUrls(html);
  const replacements = [];
  let n = 0;
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get("content-type") || "";
      const ext = imageExtension(contentType);
      if (!ext) throw new Error(`not an image (${contentType || "no content-type"})`);
      const bytes = Buffer.from(await res.arrayBuffer());
      const dims = imageDimensions(bytes);
      n += 1;
      const fileName = `img-${n}.${ext}`;
      const publicPath = `/articles/${slug}/${fileName}`;
      const dest = `public${publicPath}`;
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, bytes);
      replacements.push({ url, publicPath, ...dims });
      log(`localized ${url} -> ${dest}${dims ? ` (${dims.width}x${dims.height})` : ""}`);
    } catch (err) {
      // Keep the remote src when a single asset fails — one broken image must
      // not block publishing the article.
      log(`kept remote src ${url} (${err.message})`);
    }
  }
  for (const { url, publicPath, width, height } of replacements) {
    html = html.replace(
      new RegExp(`(<img\\b[^>]*\\bsrc=")${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}("[^>]*>)`, "g"),
      (_m, before, after) => {
        let tag = `${before}${publicPath}${after}`;
        tag = tag.replace(/\s*(width|height|loading|decoding)="[^"]*"/g, "");
        const attrs = [];
        if (width && height) attrs.push(`width="${width}"`, `height="${height}"`);
        attrs.push(`loading="lazy"`, `decoding="async"`);
        return tag.replace(/<img\b/, `<img ${attrs.join(" ")}`);
      },
    );
  }
  const first = replacements[0] ?? null;
  return {
    html,
    imagePath: first?.publicPath ?? null,
    imageWidth: first?.width ?? null,
    imageHeight: first?.height ?? null,
  };
}

async function main() {
  const draft = arg("draft");
  if (!draft) {
    console.error("--draft <path> is required");
    process.exit(1);
  }
  let html = readFileSync(draft, "utf8");

  function sanitizeSlug(raw) {
    if (!raw) return "";
    return raw
      .replace(/[\\/]+/g, "-")
      .replace(/(^|-)\.+(?=(-|$))/g, "")
      .replace(/^-+|-+$/g, "");
  }

  const slug = sanitizeSlug(arg("slug")) || basename(draft).replace(/\.html?$/,"");
  const title = arg("title") || extractTitle(html) || slug;
  const description = arg("description") || extractDescription(html) || "";
  const today = new Date().toISOString().slice(0, 10);
  const publishedAt = arg("date") || today;
  const updatedAt = today;

  if (!arg("description") && description) {
    console.error(`derived description (${description.length} chars): ${description.slice(0, 70)}...`);
  }

  let imagePath = null;
  let result = null;
  if (!process.argv.includes("--no-images")) {
    result = await localizeImages(html, slug, { log: (m) => console.error(m) });
    html = result.html;
    imagePath = result.imagePath;
  }

  const faq = extractFaq(html);
  if (faq.length) console.error(`extracted ${faq.length} FAQ items for FAQPage schema`);

  const page = buildArticlePage({
    title,
    slug,
    description,
    publishedAt,
    updatedAt,
    imagePath,
    imageWidth: result.imageWidth,
    imageHeight: result.imageHeight,
    faq,
    html,
  });

  const dest = `src/pages/articles/${slug}.astro`;
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, page);
  console.log(`rendered ${dest} (title: ${title.slice(0, 60)}...)`);
}

try {
  await main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
