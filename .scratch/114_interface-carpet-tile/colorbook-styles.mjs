// Step 1 of the color-book refresh: parse the dealer price list PDF with the
// app's own parser and emit the style list the scraper joins against.
//
//   node colorbook-styles.mjs <price-list.pdf> > styles.json
//
// Run from the repo root (pdfjs-dist resolves from node_modules).
import { readFileSync } from "fs";
import { resolve } from "path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseInterfacePages } from "../../src/interfacebook.js";

const file = process.argv[2];
if (!file) { console.error("usage: node colorbook-styles.mjs <price-list.pdf>"); process.exit(1); }

const data = new Uint8Array(readFileSync(resolve(file)));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
const pages = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const vh = page.getViewport({ scale: 1 }).height; // pdf y is bottom-up; flip like fileread.js does
  const tc = await page.getTextContent();
  pages.push(tc.items.filter((i) => i.str && i.str.trim()).map((i) => ({ str: i.str, x: i.transform[4], y: vh - i.transform[5], w: i.width })));
}
// An empty color table keeps the emit at one row per style — the scraper only
// needs the style identities.
const res = parseInterfacePages(pages, "styles", {});
console.error(JSON.stringify(res.meta));
const out = [];
for (const r of res.rows.slice(1)) out.push({ sku: r[0], type: r[10], thickness: r[4] });
console.log(JSON.stringify(out, null, 1));
