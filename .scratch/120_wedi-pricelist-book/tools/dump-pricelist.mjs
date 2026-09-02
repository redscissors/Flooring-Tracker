// Dumps the owner's wedi distribution pricelist to a committed JSON snapshot,
// so 8b's parser can be developed anywhere — including a cloud container that
// has the repo but not the owner's OneDrive. 8a solved this with a committed
// FIXTURE, but a fixture is parser OUTPUT and 8b is the parser, so what gets
// committed here is the RAW sheet grid instead: exactly what readXlsxSheets
// hands the import wizard, and nothing interpreted.
//
//   node .scratch/120_wedi-pricelist-book/tools/dump-pricelist.mjs "<path to the pricelist .xlsx>"
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const file = process.argv[2];
if (!file) { console.error("usage: dump-pricelist.mjs <workbook.xlsx>"); process.exit(1); }

const wb = XLSX.read(fs.readFileSync(file), { type: "buffer" });
// Mirrors src/fileread.js exactly EXCEPT blankrows:false — a formatted vendor
// sheet is mostly empty rows, and the parser keys on the rows that carry data.
// If 8b turns out to need the blank runs (they may separate sections), set
// this back to the reader's own shape and regenerate.
const sheets = wb.SheetNames.map((name) => ({
  name,
  rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, blankrows: false }),
}));

const out = path.resolve(import.meta.dirname, "../pricelist-sheets.json");
fs.writeFileSync(out, JSON.stringify(sheets, null, 1));
console.error(`sheets: ${sheets.length}`);
sheets.forEach((s) => console.error(`   ${JSON.stringify(s.name)} rows: ${s.rows.length}`));
console.error(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
