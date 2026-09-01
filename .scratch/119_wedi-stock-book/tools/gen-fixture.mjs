// Regenerates src/wedifixture.js from the owner's workbook. Run by hand when a
// new export lands; never imported by src/. Mirrors src/fileread.js:8 exactly,
// including defval:null — the recognizer indexes by absolute column number.
//   node .scratch/119_wedi-stock-book/tools/gen-fixture.mjs "<path to WEDI 1.xlsx>"
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const { detectVendorSkuAnalysis, parseMapped } = await import("../../../src/pricebook.js");
const { bookItemData } = await import("../../../src/orderbook.js");

const file = process.argv[2];
if (!file) { console.error("usage: gen-fixture.mjs <workbook.xlsx>"); process.exit(1); }

const wb = XLSX.read(fs.readFileSync(file), { type: "buffer" });
const sheets = wb.SheetNames.map((name) => ({
  name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }),
}));
const mapping = detectVendorSkuAnalysis(sheets);
if (!mapping) { console.error("recognizer did not match — is this the Vendor SKU Analysis export?"); process.exit(1); }
const rows = sheets.find((s) => s.name === mapping.sheet).rows;
const { items, warnings } = parseMapped(rows, mapping);
console.error(`sheet: ${mapping.sheet} | items: ${items.length} | warnings: ${warnings.length}`);
warnings.forEach((w) => console.error("  WARN:", w));

const out = items.map((it) => ({ sku: it.sku, active: true, data: bookItemData(it) }));
const body = out.map((r) => " " + JSON.stringify(r)).join(",\n");
const header = `// test fixture — the ${new Date().toISOString().slice(0, 10)} wedi stock-export snapshot,\n`
  + "// as price_book_items rows (sku + active + the jsonb data payload). Production\n"
  + "// reads the live registry book, NEVER this file. Regenerate with\n"
  + "// .scratch/119_wedi-stock-book/tools/gen-fixture.mjs\n\n"
  + "export const FIXTURE_ROWS = [\n";
fs.writeFileSync(path.resolve(import.meta.dirname, "../../../src/wedifixture.js"), header + body + "\n];\n");
console.error("wrote src/wedifixture.js");
