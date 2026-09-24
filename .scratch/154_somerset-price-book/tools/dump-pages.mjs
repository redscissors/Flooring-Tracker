// Regenerates src/somersetfixture.js from a Somerset (Palmer Donavin) price PDF:
//   node .scratch/154_somerset-price-book/tools/dump-pages.mjs <sheet.pdf>
// Items are flattened exactly as fileread.js readPdfPages does in the browser.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pdfjs = await import(path.join(root, "node_modules/pdfjs-dist/legacy/build/pdf.mjs"));
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(process.argv[2])) }).promise;
const r1 = (n) => Math.round(n * 10) / 10;
const pages = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const vh = page.getViewport({ scale: 1 }).height;
  const content = await page.getTextContent();
  pages.push(content.items.filter((i) => i.str && i.str.trim()).map((i) => [i.str, r1(i.transform[4]), r1(vh - i.transform[5]), r1(i.width)]));
}
const body = pages.map((pg) => ` [\n${pg.map((i) => `  ${JSON.stringify(i)},`).join("\n")}\n ],`).join("\n");
fs.writeFileSync(path.join(root, "src/somersetfixture.js"), `// test fixture — Somerset Hardwood Flooring R35 price sheet (Palmer Donavin,
// 10/20/2025), as the positioned text items readPdfPages hands the import
// wizard: [str, x, y, w] per item, one array per page. Parser INPUT for
// somersetbook.test.js. Production never reads this file. GENERATED —
// regenerate with .scratch/154_somerset-price-book/tools/dump-pages.mjs.

const RAW = [
${body}
];

export const SOMERSET_PAGES = RAW.map((pg) => pg.map(([str, x, y, w]) => ({ str, x, y, w })));
`);
console.log(pages.map((p) => p.length).join(" "));
