// Dump each PDF page's first and last few text runs (top-to-bottom), to see
// exactly where Chrome breaks the pages. Usage: node pdftext.mjs <file.pdf>
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
const doc = await getDocument({ data: new Uint8Array(readFileSync(process.argv[2])) }).promise;
console.log(process.argv[2], "—", doc.numPages, "pages");
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  const items = tc.items.filter((i) => i.str.trim()).map((i) => ({ y: page.view[3] - i.transform[5], str: i.str.trim() }));
  items.sort((a, b) => a.y - b.y);
  const fmt = (i) => `[y${Math.round(i.y)}] ${i.str.slice(0, 60)}`;
  console.log(`\n— page ${p} (${items.length} runs) —`);
  items.slice(0, 4).forEach((i) => console.log("  first", fmt(i)));
  items.slice(-4).forEach((i) => console.log("  last ", fmt(i)));
}
