// THROWAWAY measurement — walks the raw snapshot with the spec's state machine and compares to WEDI_SO.
// Every figure in docs/superpowers/specs/2026-09-02-wedi-pricelist-book-design.md came from this.
// It is NOT the parser; src/wedibook.js is. Run from the repo root: node .scratch/120_wedi-pricelist-book/tools/measure-vs-so.mjs
import fs from "node:fs";
const d = JSON.parse(fs.readFileSync(".scratch/120_wedi-pricelist-book/pricelist-sheets.json", "utf8"));
const str = (v) => (v == null ? "" : String(v)).replace(/\s+/g, " ").trim();
const PART = /^(US\d{7,9}|\d{9})\*?$/;
const isCaption = (s) => /^(size|dimensions|drain location|product information|additional details|retail|distributor net|contractor|dealer|sheets\/package|ft2|sheet|product|part number|stock skus|volume|\(l\s*x|\(hx|size lxwxh|size \(|price)/i.test(s);
function parseSheet(sheet) {
  const out = [], warn = [];
  let section = "", cols = null, partCol = null;
  for (const raw of sheet.rows) {
    const row = raw || [];
    const cells = row.map(str);
    const partIdx = cells.findIndex((c) => PART.test(c));
    if (partIdx >= 0 && cols) {
      const us = cells[partIdx].replace(/\*$/, "");
      const num = (i) => (i != null && typeof row[i] === "number" ? row[i] : null);
      const retail = num(cols.retail), net = num(cols.net);
      out.push({ us, name: cells[partIdx + 1], size: cells[cols.size] ?? "", details: cells[cols.details] ?? "", retail: retail == null ? null : Math.round(retail * 100) / 100, net: net == null ? null : Math.round(net * 100) / 100, section, discount: retail && net != null ? Math.round((1 - net / retail) * 100) : null, erp: cols.erp != null ? cells[cols.erp] : "" });
      continue;
    }
    const nonEmpty = cells.map((c, i) => [c, i]).filter(([c]) => c);
    if (!nonEmpty.length) continue;
    const [first, firstIdx] = nonEmpty[0];
    const rest = nonEmpty.slice(1);
    const isHeader = cells.some((c) => /^part number$/i.test(c));
    const priceCaps = rest.filter(([c]) => /retail unit price|retail price|distributor net/i.test(c));
    if (isHeader || priceCaps.length) {
      // column map from captions
      const retailI = cells.findIndex((c) => /^retail (unit )?price/i.test(c));
      let netI = -1; cells.forEach((c, i) => { if (/distributor net/i.test(c)) netI = i; });
      const sizeI = cells.findIndex((c) => /^(size|dimensions|product information)/i.test(c));
      const detI = cells.findIndex((c) => /^(additional details|drain location)/i.test(c));
      const pnI = cells.findIndex((c) => /^part number$/i.test(c));
      const erpI = cells.findIndex((c) => /^stock skus$/i.test(c));
      cols = { retail: retailI, net: netI, size: sizeI >= 0 ? sizeI : (cols?.size ?? -1), details: detI >= 0 ? detI : -1, erp: erpI >= 0 ? erpI : (cols?.erp ?? null) };
      if (isHeader && pnI >= 0) partCol = pnI;
      if (!isHeader) section = first;        // a price-captioned row names the section
      else if (rest.every(([c]) => isCaption(c)) && !/^(stock skus|part number)$/i.test(first)) section = first;
      continue;
    }
    if (rest.length && rest.every(([c]) => isCaption(c))) { section = first; continue; } // unit-caption section row
    // else: title/note/terms line — skip
  }
  return { out, warn };
}
const all = [], seen = new Set();
for (const name of ["wedi Fundo", "wedi S-Dry"]) {
  const s = d.find((x) => x.name === name);
  const { out } = parseSheet(s);
  let dup = 0;
  for (const r of out) { if (seen.has(r.us)) { dup++; continue; } seen.add(r.us); all.push(r); }
  console.log(name, "rows", out.length, "dups dropped", dup);
}
console.log("total", all.length, "| empty section:", all.filter((r) => !r.section).length, "| null retail:", all.filter((r) => r.retail == null).length, "| null net:", all.filter((r) => r.net == null).length, "| retail<=0:", all.filter((r) => !(r.retail > 0)).length);
// compare to WEDI_SO
const src = fs.readFileSync("src/wedi.js", "utf8");
const a = src.indexOf("const WEDI_SO = ["), b = src.indexOf("\n];", a);
const so = JSON.parse(src.slice(a + "const WEDI_SO = ".length, b + 2)).filter((r) => !r.kitNote);
const byUs = Object.fromEntries(all.map((r) => [r.us, r]));
const F = ["name", "size", "details", "retail", "net", "section", "discount", "erp"];
let same = 0; const diffs = {};
for (const r of so) { const p = byUs[r.us]; if (!p) { (diffs.MISSING ||= []).push(r.us); continue; } let ok = true; for (const f of F) { if (String(p[f] ?? "") !== String(r[f] ?? "")) { ok = false; (diffs[f] ||= []).push([r.us, JSON.stringify(r[f]), JSON.stringify(p[f])]); } } if (ok) same++; }
console.log("WEDI_SO rows:", so.length, "identical on all 8 fields:", same);
for (const [f, v] of Object.entries(diffs)) { console.log("--", f, v.length); v.slice(0, 4).forEach((x) => console.log("   ", x.join(" | "))); }
console.log("sections:", [...new Set(all.map((r) => r.section))].length);
