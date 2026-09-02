// THROWAWAY: canonical rows -> parseMapped -> bookItemData -> normBookItem, vs WEDI_SO
import fs from "node:fs";
import { parseMapped } from "../../../src/pricebook.js";
import { bookItemData, normBookItem } from "../../../src/orderbook.js";
const d = JSON.parse(fs.readFileSync(".scratch/120_wedi-pricelist-book/pricelist-sheets.json", "utf8"));
const str = (v) => (v == null ? "" : String(v)).replace(/\s+/g, " ").trim();
const PART = /^(US\d{7,9}|\d{9})\*?$/;
const isCaption = (s) => /^(size|dimensions|drain location|product information|additional details|retail|distributor net|contractor|dealer|sheets\/package|ft2|sheet|product|part number|stock skus|volume|price)/i.test(s);
function parseSheet(sheet) {
  const out = []; let section = "", cols = null;
  for (const raw of sheet.rows) {
    const row = raw || []; const cells = row.map(str);
    const pi = cells.findIndex((c) => PART.test(c));
    if (pi >= 0 && cols) {
      const num = (i) => (i != null && i >= 0 && typeof row[i] === "number" ? row[i] : null);
      const disc = /less\s*(\d+)\s*%/i.exec(cols.netCap || "");
      let size = cols.size >= 0 ? cells[cols.size] : (cells[pi + 2] || "");
      size = size.replace(/\bin\.\s+in\.$/, "in.");
      const sizeI = cols.size >= 0 ? cols.size : pi + 2; const details = (cols.details >= 0 && cells[cols.details]) || cells[sizeI + 1] || "";
      out.push({ us: cells[pi].replace(/\*$/, ""), name: cells[pi + 1], size, details, retail: num(cols.retail), net: num(cols.net), section, discount: disc ? +disc[1] : null, erp: cols.erp != null && cols.erp >= 0 ? cells[cols.erp] : "" });
      continue;
    }
    const ne = cells.map((c, i) => [c, i]).filter(([c]) => c); if (!ne.length) continue;
    const [first] = ne[0]; const rest = ne.slice(1);
    const isHeader = cells.some((c) => /^part number$/i.test(c));
    const priceCaps = rest.some(([c]) => /retail unit price|retail price|distributor net/i.test(c));
    if (isHeader || priceCaps) {
      const retailI = cells.findIndex((c) => /^retail (unit )?price/i.test(c));
      let netI = -1, netCap = ""; cells.forEach((c, i) => { if (/distributor net/i.test(c)) { netI = i; netCap = c; } });
      const sizeI = cells.findIndex((c) => /^(size|dimensions|product information)/i.test(c));
      const detI = cells.findIndex((c) => /^(additional details|drain location)/i.test(c));
      const erpI = cells.findIndex((c) => /^stock skus$/i.test(c));
      cols = { retail: retailI, net: netI, netCap, size: sizeI, details: detI, erp: erpI >= 0 ? erpI : (cols?.erp ?? -1) };
      if (!isHeader) section = first; else if (!/^(stock skus|part number)$/i.test(first)) section = first;
      continue;
    }
    if (rest.length && rest.every(([c]) => isCaption(c))) { section = first; continue; }
  }
  return out;
}
const rows = [], seen = new Set();
for (const n of ["wedi Fundo", "wedi S-Dry"]) for (const r of parseSheet(d.find((s) => s.name === n))) { if (seen.has(r.us)) continue; seen.add(r.us); rows.push(r); }
// canonical sheet
const CANON = ["Part Number", "Product", "Size", "Details", "Retail", "Net", "Section", "Stock SKU", "Discount"];
const grid = [CANON, ...rows.map((r) => [r.us, r.name, r.size, r.details, r.retail, r.net, r.section, r.erp, r.discount])];
const MAPPING = { columns: { 0: "sku", 1: "description", 2: "size", 3: "note", 4: "price", 5: "cost", 6: "section", 7: "vendorSku" }, headerRow: 0, skuPattern: "^(US\\d{7,9}|\\d{9})$", defaultType: "", groupBy: "section" };
const { items, warnings } = parseMapped(grid, MAPPING);
console.log("parseMapped items:", items.length, "of", rows.length, "| warnings:", warnings.length); warnings.slice(0, 6).forEach((w) => console.log("  W:", String(w).slice(0, 120)));
const live = items.map((it) => normBookItem({ sku: it.sku, active: true, data: bookItemData(it) }, "bk"));
const src = fs.readFileSync("src/wedi.js", "utf8"); const a = src.indexOf("const WEDI_SO = ["), b = src.indexOf("\n];", a);
const so = JSON.parse(src.slice(a + "const WEDI_SO = ".length, b + 2)).filter((r) => !r.kitNote);
const by = Object.fromEntries(live.map((it) => [it.sku, it]));
const diffs = {};
const cmp = (f, get) => { for (const r of so) { const it = by[r.us]; if (!it) { (diffs.MISSING ||= []).push(r.us); continue; } const g = get(it); if (String(g ?? "") !== String(r[f] ?? "")) (diffs[f] ||= []).push([r.us, JSON.stringify(r[f]).slice(0, 70), JSON.stringify(g).slice(0, 70)]); } };
cmp("name", (it) => it.description); cmp("size", (it) => it.size); cmp("details", (it) => it.note); cmp("retail", (it) => it.price); cmp("net", (it) => it.cost); cmp("section", (it) => it.section); cmp("erp", (it) => it.vendorSkus[0] || "");
for (const [f, v] of Object.entries(diffs)) { console.log("--", f, v.length); v.slice(0, 40).forEach((x) => console.log("   ", x.join(" | "))); }
console.log("sample item:", JSON.stringify(live[0]).slice(0, 400));
console.log("thickness/sfPerUnit set on:", live.filter((it) => it.thickness).length, live.filter((it) => it.sfPerUnit).length, "| type set:", live.filter((it) => it.type).length);
