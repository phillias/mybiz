// @ts-check
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import clerk from "@clerk/astro";

// Per-article lastmod: read each rendered article page's frontmatter
// (publishedAt) so the sitemap carries real content dates instead of a
// build-stamp on every URL (audit F12). Non-article pages fall back to the
// build date.
function articleLastmods() {
  const dir = fileURLToPath(new URL("./src/pages/articles", import.meta.url));
  const map = new Map();
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".astro") || file === "index.astro") continue;
      const src = readFileSync(`${dir}/${file}`, "utf8");
      const published = src.match(/publishedAt:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];
      if (published) map.set(`/articles/${file.replace(/\.astro$/, "")}`, published);
    }
  } catch {
    // No articles dir (or unreadable) — fall back to the build date below.
  }
  return map;
}

const articleLastmodMap = articleLastmods();

// https://astro.build/config
export default defineConfig({
  site: "https://codevex.app",
  output: "server",
  adapter: cloudflare(),
  vite: {
    plugins: [
      // @clerk/astro registers this virtual module via integration
      // `updateConfig`, which does not reach the client build environment on
      // Astro 7 (rolldown-vite) — the components barrel then fails to resolve
      // `virtual:@clerk/astro/config`. Registering the same module here
      // (mirroring upstream semantics for output:"server") keeps the barrel
      // importable.
      {
        name: "clerk-astro-config-virtual",
        resolveId(id) {
          if (id === "virtual:@clerk/astro/config") return "\0virtual:@clerk/astro/config";
        },
        load(id) {
          if (id !== "\0virtual:@clerk/astro/config") return;
          return `
            const configOutput = 'server';
            export function isStaticOutput(forceStatic) {
              if (configOutput === 'hybrid' && forceStatic === undefined) return true;
              if (forceStatic !== undefined) return forceStatic;
              return configOutput === 'static';
            }
          `;
        },
      },
    ],
  },
  integrations: [
    // Official Clerk Astro wiring: provides the client init scripts that
    // mount <SignIn/> on /sign-in (middleware alone only gates routes).
    clerk(),
    sitemap({
      // /app is auth-gated (302 to sign-in) and /sign-in is a thin auth page —
      // neither belongs in a crawler sitemap (audit F12/F13).
      filter: (page) => !page.includes("/app") && !page.includes("/sign-in"),
      lastmod: new Date(),
      serialize(item) {
        const pathname = new URL(item.url).pathname.replace(/\/$/, "");
        const published = articleLastmodMap.get(pathname);
        if (published) item.lastmod = published;
        return item;
      },
    }),
  ],
});
