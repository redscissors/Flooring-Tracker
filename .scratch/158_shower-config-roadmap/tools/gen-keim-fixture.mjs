// Regenerates src/keimwedifixture.js from Keim's wedi price sheet. Run by hand
// when a new sheet lands; never imported by src/. Mirrors src/fileread.js
// (header:1, defval:null) so the grid is exactly what the wizard sees.
//   node .scratch/158_shower-config-roadmap/tools/gen-keim-fixture.mjs "<path to NEW_Wedi_Price_Sheet.xlsx>"
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const file = process.argv[2];
if (!file) { console.error("usage: gen-keim-fixture.mjs <workbook.xlsx>"); process.exit(1); }
const wb = XLSX.read(fs.readFileSync(file), { type: "buffer" });
const trim = (rows) => {
  const out = rows.map((r) => { const a = (r || []).slice(); while (a.length && a[a.length - 1] == null) a.pop(); return a; });
  while (out.length && !out[out.length - 1].length) out.pop();
  return out;
};
// Every tab's name is kept (the parser must see and skip the Contractor ones),
// but only the two Retail tabs carry their rows — the Contractor tabs are
// never read, so their prices stay out of the repo.
const sheets = wb.SheetNames.map((name) => ({
  name, rows: /retail/i.test(name) ? trim(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null })) : [],
}));
const body = sheets.map((s) => `  { name: ${JSON.stringify(s.name)}, rows: [\n${s.rows.map((r) => "    " + JSON.stringify(r)).join(",\n")}\n  ] }`).join(",\n");
const header = `// test fixture — Keim's wedi price sheet (${path.basename(file)}), the two Retail\n`
  + "// tabs as the raw grid readXlsxSheets hands the wizard; the Contractor tabs are\n"
  + "// named but empty (never read). Parser INPUT for keimwedibook.test.js and the\n"
  + "// import-preview harness. Production never reads it. GENERATED — regenerate with\n"
  + "// .scratch/158_shower-config-roadmap/tools/gen-keim-fixture.mjs\n\n"
  + "export const KEIM_SHEETS = [\n";
fs.writeFileSync(path.resolve(import.meta.dirname, "../../../src/keimwedifixture.js"), header + body + "\n];\n");
console.error("wrote src/keimwedifixture.js");
