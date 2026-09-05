/**
 * Bundle the built app into one self-contained HTML file for publishing as a
 * prototype. Inlines the JS and CSS from `dist/`; leaves the Google Fonts
 * link in place, since that host is allowed where the prototype is served.
 *
 *   npm run build && node scripts/artifact.mjs <out.html>
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2];
if (!out) { console.error("usage: node scripts/artifact.mjs <out.html>"); process.exit(2); }

const dist = new URL("../dist/", import.meta.url).pathname;
let html = readFileSync(join(dist, "index.html"), "utf8");

// Every built asset is referenced once from index.html; inline each.
for (const file of readdirSync(join(dist, "assets"))) {
  const body = readFileSync(join(dist, "assets", file), "utf8");
  if (file.endsWith(".js")) {
    const tag = new RegExp(`<script[^>]*src="/assets/${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*></script>`);
    if (!tag.test(html)) throw new Error(`no script tag for ${file}`);
    // "</script>" inside the bundle would end the inline tag early.
    html = html.replace(tag, () => `<script type="module">${body.replace(/<\/script/gi, "<\\/script")}</script>`);
  } else if (file.endsWith(".css")) {
    const tag = new RegExp(`<link[^>]*href="/assets/${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`);
    if (!tag.test(html)) throw new Error(`no link tag for ${file}`);
    html = html.replace(tag, () => `<style>${body}</style>`);
  }
}

// Favicon as a data URI so nothing points back at a server.
const svg = readFileSync(new URL("../public/favicon.svg", import.meta.url), "utf8");
html = html.replace(/href="\/favicon\.svg"/, `href="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"`);

if (/src="\/assets\/|href="\/assets\//.test(html)) throw new Error("an asset reference survived inlining");
writeFileSync(out, html);
console.log(`${out}: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
