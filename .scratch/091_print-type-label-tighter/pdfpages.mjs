// Authoritative PDF page count via pdfjs-dist (already a project dependency).
// Usage: node pdfpages.mjs <file.pdf> [...more]
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
for (const f of process.argv.slice(2)) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(f)) }).promise;
  console.log(f, "→", doc.numPages, "pages");
}
