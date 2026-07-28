// Parser for the OVF "TrueTouch" account price list (issue 063) — the Wellmade
// TrueTouch program: EVOLV / MOMENTUM real-wood planks and the Hawaii / Tsunami
// waterproof lines — shipped as a text PDF.
//
// The sheet is the PDF twin of OVF's banded .xls flooring lists (ovfbook.js):
// each collection prints a warranty banner naming it, a construction/size prose
// line, a coverage line, a stacked trim-column header, then ONE price band —
// the floor's $/SF and $/CT plus a single per-piece price per trim column —
// and finally color rows carrying only SKUs (the floor's Item # and a strip of
// molding codes). Prices live in the band, not on the rows, and the leftmost
// cell is the color NAME, so the generic header-driven reader (pdfbook.js)
// finds no product rows here at all. Like Mannington (ADR 0012) this is a
// sanctioned dedicated-parser exception (ADR 0009 §4): the price band's own
// x-positions define the trim columns, and every SKU on a color row is matched
// to its column by x. A collection's banner and its grid can sit on different
// pages (Hawaii 4.5mm), so section state carries across pages.
//
// It emits the SAME { name, rows, mapping, warnings } contract the other
// dedicated parsers produce, feeding the mapped-import wizard unchanged. Each
// color row yields a floor (SKU = Item #, carton cost + SF/CT coverage so
// whole-carton ordering works; hardwood for the REAL WOOD lines, vinyl for the
// waterproof ones) plus its trims (SKU = the molding code, priced per piece
// from the band, flagged `trim`, stamped "fits {floor SKU}"). The honesty
// guarantee holds as everywhere: a row only becomes a product when its code
// cell looks like a SKU, so a re-organized sheet degrades to visible missing
// counts downstream, never garbage rows.

import { clusterRows } from "./pdfbook.js";

const str = (c) => (c == null ? "" : String(c).trim());
const num = (c) => { const n = parseFloat(str(c).replace(/[$,]/g, "")); return Number.isFinite(n) ? n : null; };

// The sheet never prints the brand — "TrueTouch" is what OVF titles the program
// and what the team calls it; it fronts the picked name like Hallmark/Tarkett.
const BRAND = "TrueTouch";

// Column geography: the color name, then the floor Item #, then the trim matrix.
const NAME_X = 150, TRIM_X = 240;

// A floor Item # is always letters + digits (EM815CEP, W88718, HW45HO409);
// prices, "N/A", "Item #" and prose all fail. A trim code can be letters-only
// (Hawaii's HWHOSTN / HWHOFSTN), so the trim matrix takes any alnum run — safe
// there because color names never reach the trim x-band.
const looksSku = (s) => { const v = str(s); return /^[A-Za-z0-9]{5,14}$/.test(v) && /[A-Za-z]/.test(v) && /\d/.test(v); };
const looksTrimSku = (s) => { const v = str(s); return /^[A-Za-z0-9]{5,14}$/.test(v) && /[A-Za-z]/.test(v); };

// "$3.70 /SF" · "$94.96 /CT" · "$21.49 /EA" · "N/A /PC" → { cost, unit }.
const priceTok = (s) => {
  const m = str(s).match(/^(\$\s*[\d,]+(?:\.\d+)?|N\/A)\s*\/\s*(SF|CT|EA|PC)$/i);
  return m ? { cost: /n/i.test(m[1]) ? null : num(m[1]), unit: m[2].toUpperCase() } : null;
};

// ALL-CAPS collection words read better title-cased (EVOLV → Evolv); mixed-case
// ("Hawaii 4.5mm") and short/size tokens are left alone.
const titleWord = (w) => (/^[A-Z]{4,}$/.test(w) ? w.charAt(0) + w.slice(1).toLowerCase() : w);

// Clean a stacked trim-column label down to its molding name: "T-Molding
// (94.5\")" → "T-Molding", "Round Stair / Tread 48\" / 3 ctn min" → "Round Stair
// Tread". The length annotations vary per collection and carry no product
// meaning; the carton-minimum note is kept separately.
function trimLabel(parts) {
  const s = parts.join(" ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+\s*ctn\s*min\b/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*["”]/g, " ")
    .replace(/["'”]/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ").trim();
  return s || "Trim";
}

// The trim columns for one section: each per-piece price in the band, paired by
// x with the stacked label text above it (and its "3 ctn min" note, if any).
function trimColumns(pageItems, priceRow, toks) {
  // The account line ("Prepared especially for …") can sit inside the band when
  // a section's grid opens a page (Hawaii on page 2) — it is never a label.
  const labelItems = pageItems.filter((i) =>
    i.y < priceRow.y - 3 && i.y > priceRow.y - 42 && i.x >= TRIM_X - 12 &&
    /[A-Za-z]/.test(str(i.str)) && !priceTok(i.str) && !/prepared especially/i.test(str(i.str)));
  return toks.filter((t) => (t.unit === "EA" || t.unit === "PC") && t.x >= TRIM_X).map((t) => {
    const parts = labelItems.filter((l) => Math.abs(l.x - t.x) < 30).sort((a, b) => a.y - b.y || a.x - b.x).map((l) => str(l.str));
    const note = parts.map((p) => p.match(/\d+\s*ctn\s*min/i)?.[0]).find(Boolean) || "";
    return { x: t.x, cost: t.cost, unit: t.unit, label: trimLabel(parts), note };
  });
}

// The collection's plank size out of the construction prose: the clause before
// the first "•" — either leading dimensions ('7" x 60"') or, on the real-wood
// lines, the "… PAD attached) x 7 11/16" x 24"/36"/60" RL" tail.
function specSize(line) {
  const seg = line.split("•")[0].trim();
  const lead = seg.match(/^(\d[\d\s/]*["”]\s*x\s*\d[\d\s/]*["”])/);
  if (lead) return lead[1].replace(/\s+/g, " ").trim();
  const after = seg.match(/\)\s*x\s+(.+)$/);
  return after ? after[1].replace(/\s+/g, " ").trim() : "";
}

const rowText = (row) => [...row.items].sort((a, b) => a.x - b.x).map((i) => str(i.str)).join(" ");

// True when the pages look like the OVF TrueTouch account list: an early page
// carries the "Prepared especially for …" account line (the OVF export
// signature) AND the grid's "Item Name | Item #" header — a pairing no other
// known PDF book prints (Glazzio/Mannington lead their headers differently).
export function isTrueTouch(pages) {
  let account = false, header = false;
  for (const page of (pages || []).slice(0, 4)) {
    const items = (page || []).filter((it) => str(it?.str) !== "");
    if (!items.length) continue;
    for (const row of clusterRows(items)) {
      const line = rowText(row);
      if (/^Prepared especially/i.test(line)) account = true;
      if (/\bItem Name\b/.test(line) && /\bItem #/.test(line)) header = true;
      if (account && header) return true;
    }
  }
  return false;
}

export function parseTrueTouchPages(pages, name = "TrueTouch price list") {
  const flooring = [];
  const trims = new Map(); // sku -> { sku, label, cost, unit, note, fits:Set, names:Set }
  const warnings = [];

  // Section state — carries ACROSS pages (Hawaii 4.5mm banners on page 1, its
  // grid opens page 2).
  let collection = "", type = "", size = "", coverage = null;
  let floorSf = null, floorCt = null, trimCols = [];

  for (let p = 0; p < (pages?.length || 0); p++) {
    const items = (pages[p] || []).filter((it) => str(it?.str) !== "");
    if (!items.length) continue;
    for (const row of clusterRows(items)) {
      const line = rowText(row);
      if (/^Prepared especially/i.test(line)) continue;
      if (/Pricing Effective|Page \d+ of \d+|^Printed\b/i.test(line)) continue;

      // Warranty banner — names the collection and starts a new section.
      if (/\bwarranty\b/i.test(line)) {
        const words = [...row.items].sort((a, b) => a.x - b.x)
          .filter((i) => !/warranty|residential|commercial/i.test(str(i.str)))
          .map((i) => str(i.str)).join(" ");
        collection = words.split(/\s+/).filter(Boolean).map(titleWord).join(" ");
        type = ""; size = ""; coverage = null; floorSf = null; floorCt = null; trimCols = [];
        continue;
      }

      // Construction prose — the plank size and what the floor IS: a REAL WOOD
      // veneer plank, or a waterproof vinyl-core one.
      if (/pad attached/i.test(line) || /wear layer/i.test(line)) {
        const sz = specSize(line);
        if (sz) size = sz;
        if (/real wood/i.test(line)) type = "hardwood";
        else if (/lvt|wpc|waterproof/i.test(line)) type = "vinyl";
        continue;
      }

      // Coverage prose: "25.68 SF/CT • 50 CT/PA • …".
      const cov = line.match(/(\d+(?:\.\d+)?)\s*SF\s*\/\s*CT/i);
      if (cov) { coverage = parseFloat(cov[1]); continue; }

      // The price band: the floor's $/SF (+$/CT) and one per-piece price per
      // trim column. Its x-positions ARE the section's column grid.
      const toks = row.items.map((i) => ({ x: i.x, ...priceTok(i.str) })).filter((t) => t.unit);
      if (toks.some((t) => t.unit === "SF")) {
        floorSf = toks.find((t) => t.unit === "SF")?.cost ?? null;
        floorCt = toks.find((t) => t.unit === "CT")?.cost ?? null;
        trimCols = trimColumns(items, row, toks);
        continue;
      }

      // Color row: the color name leads, the floor Item # sits in its band, and
      // each trim code matches a price column by x.
      const skuIt = row.items.find((i) => i.x >= NAME_X && i.x < TRIM_X && looksSku(i.str));
      const nameParts = row.items.filter((i) => i.x < NAME_X && /[A-Za-z]/.test(str(i.str)));
      if (!skuIt || !nameParts.length) continue;
      const color = nameParts.sort((a, b) => a.x - b.x).map((i) => str(i.str)).join(" ");
      const floorSku = str(skuIt.str);

      // Self-consistency: carton ÷ SF/carton must reconcile with the printed
      // $/SF; if not, the band was misread — quote the honest per-sq-ft cost.
      let cost = null, unit = "";
      if (floorCt != null && coverage && floorSf != null && Math.abs(floorCt / coverage - floorSf) / floorSf > 0.03) {
        cost = floorSf; unit = "SF";
      } else if (floorCt != null && coverage) { cost = floorCt; unit = "BX"; }
      else if (floorSf != null) { cost = floorSf; unit = "SF"; }
      else if (floorCt != null) { cost = floorCt; unit = "BX"; }

      flooring.push({ sku: floorSku, color, collection, size, coverage, cost, unit, type });

      for (const it of row.items) {
        if (it.x < TRIM_X - 10 || it === skuIt || !looksTrimSku(it.str)) continue;
        const col = trimCols.filter((c) => Math.abs(c.x - it.x) < 30).sort((a, b) => Math.abs(a.x - it.x) - Math.abs(b.x - it.x))[0];
        const tsku = str(it.str);
        const rec = trims.get(tsku) || {
          sku: tsku, label: col?.label || "Trim", cost: col?.cost ?? null, unit: col?.unit || "EA",
          note: col?.note || "", collection, fits: new Set(), names: new Set(),
        };
        if (rec.cost == null && col?.cost != null) { rec.cost = col.cost; rec.label = col.label; rec.unit = col.unit; }
        rec.fits.add(floorSku);
        if (color) rec.names.add(color);
        trims.set(tsku, rec);
      }
    }
  }

  const CANON = ["Item #", "Name", "Collection", "Color", "Size", "SF/Carton", "Cost", "Price U/M", "Type", "Kind", "Brand", "Fits"];
  const out = [CANON.slice()];
  for (const f of flooring) {
    out.push([f.sku, f.color, f.collection, f.color, f.size, f.coverage != null ? String(f.coverage) : "",
      f.cost != null ? String(f.cost) : "", f.unit, f.type, "", BRAND, ""]);
  }
  // Trim rows: per-piece cost from the band, `trim`-flagged so the book can mark
  // them up apart from the floors, and the parent floor code(s) both in the
  // structured `fits` column and in the description so a floor-code search
  // surfaces the trim in the picker. Trims keep their collection so "evolv
  // t-mold" finds them; the trim markup outranks the collection group
  // (orderbook resolveMarkup), so grouping is unaffected.
  for (const t of trims.values()) {
    const fits = [...t.fits].sort();
    const parent = [...t.names][0] || "";
    const label = t.note ? `${t.label} (${t.note})` : t.label;
    const desc = [parent ? `${parent} — ${label}` : label, fits.length && `· fits ${fits.join(" ")}`].filter(Boolean).join(" ");
    out.push([t.sku, desc, t.collection, "", "", "", t.cost != null ? String(t.cost) : "", t.unit, "", "trim", BRAND, fits.join(" ")]);
  }

  if (!flooring.length) warnings.push("No TrueTouch product rows were recognized — is this the OVF TrueTouch price sheet?");
  return { name, rows: out, mapping: { ...TRUETOUCH_MAPPING }, warnings, meta: { flooring: flooring.length, trims: trims.size } };
}

// Passthrough mapping, the same column plan as Hallmark/Tarkett: the parser has
// already resolved every column, so this is a straight column→field assignment.
export const TRUETOUCH_MAPPING = {
  columns: { 0: "sku", 1: "description", 2: "productLine", 3: "color", 4: "size", 5: "sfPerUnit", 6: "cost", 7: "priceUnit", 8: "type", 9: "trim", 10: "brand", 11: "fits" },
  headerRow: 0,
  // No digit requirement: Hawaii's stair-nose trim codes are letters-only
  // (HWHOSTN); a letter is still required so a bare number can't pass.
  skuPattern: "^(?=.*[A-Za-z])[A-Za-z0-9]{5,14}$",
  defaultType: "",
  groupBy: "productLine",
};
