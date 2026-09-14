// Merge-and-sort for the order-entry panel (owner 2026-09-14): ERP One keeps
// two pasted lines with one SKU as two lines, so the desk was combining them by
// hand. Pure functions over the row objects orderEntryRow / matOrderRow /
// freightOrderRow build; nothing here reads state or the catalog registries.

import { skuKeys } from "./orderbook.js";
import { item as wediItem, rowItemKey as wediRowKey } from "./wedi.js";
import { classify as schluterClassify } from "./schluter.js";
import { PRINT_KINDS } from "./print.js";

// One SKU in any skuKeys spelling: the last spelling is the most normalized
// (letters upper-cased, punctuation dropped, the SLR reseller prefix off).
const canonSku = (sku) => { const ks = skuKeys(sku); return ks.length ? ks[ks.length - 1] : ""; };
const cents = (n) => Math.round((Number(n) || 0) * 100);

// Lines that share a SKU (and side of the panel) merge when their sell unit
// agrees and, on the special side, their per-unit cost and sell agree too — a
// merged PO line carries one price. A group that disagrees stays apart and
// every line in it says why (`kept`: "unit" | "price"), so the desk sees the
// split instead of a silent pair. An assumed quantity (orderQty's 1) is a
// stand-in, not a count: real quantities sum and absorb it; only an all-assumed
// merge stays an assumed 1. Lines with no SKU (Sheoga by description, freight)
// never merge. A line left alone is returned as the same object.
export function mergeOrderLines(rows) {
  const groups = new Map();
  rows.forEach((r, i) => {
    const c = canonSku(r.sku);
    if (!c) return;
    const k = (r.special ? "s|" : "k|") + c;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  });
  const out = rows.slice();
  const drop = new Set();
  for (const [k, idxs] of groups) {
    if (idxs.length < 2) continue;
    const members = idxs.map((i) => rows[i]);
    const units = new Set(members.map((r) => String(r.unitCode || "")));
    const kept = units.size > 1 ? "unit"
      : members[0].special && new Set(members.map((r) => cents(r.perCost) + "|" + cents(r.perSell))).size > 1 ? "price"
      : "";
    const subKey = (r) => String(r.unitCode || "") + (r.special ? "|" + cents(r.perCost) + "|" + cents(r.perSell) : "");
    const subs = new Map();
    idxs.forEach((i) => { const s = subKey(rows[i]); if (!subs.has(s)) subs.set(s, []); subs.get(s).push(i); });
    for (const [s, sub] of subs) {
      if (sub.length < 2) { if (kept) out[sub[0]] = { ...rows[sub[0]], kept }; continue; }
      const src = sub.map((i) => rows[i]);
      const real = src.filter((r) => !r.qtyAssumed);
      const qty = real.length ? real.reduce((n, r) => n + (Number(r.qty) || 0), 0) : 1;
      const first = src[0];
      out[sub[0]] = {
        ...first,
        id: `merged|${k}|${s}`,
        qty, qtyAssumed: !real.length, qtyText: `${qty} ${first.unitCode || ""}`.trim(),
        from: src.map((r) => ({ id: r.id, area: r.area || "", qty: Number(r.qty) || 0, qtyAssumed: !!r.qtyAssumed })),
        ...(kept ? { kept } : {}),
      };
      sub.slice(1).forEach((i) => drop.add(i));
    }
  }
  return out.filter((_, i) => !drop.has(i));
}

// The desk's group order (owner 2026-09-14): wedi by catalog group — building
// panels right after curbs — then Schluter by family, Sheoga, book brands
// alphabetically, hand-entered lines, the estimated materials, freight.
const WEDI_GROUPS = [
  ["Pans", ["pan", "module"]],
  ["Drains", ["cover", "coverFrame", "drainKit"]],
  ["Curbs", ["curb"]],
  ["Building panels", ["panel"]],
  ["Extensions", ["extension", "cornerExt", "modExt", "ramp"]],
  ["Niches", ["niche", "shelf"]],
  ["Benches", ["bench", "seat"]],
  ["Sealant", ["sealant"]],
  ["Fasteners", ["fastener"]],
  ["Tapes", ["subliner"]],
  ["Tools", ["tool", "recess"]],
  ["Collars", ["collar"]],
  ["Kits", ["kit"]],
  ["S-Dry", ["sdry"]],
];
const SCHLUTER_FAMILIES = [
  ["Boards", "board"], ["Trays", "tray"], ["Drains", "drain"], ["Curbs", "curb"], ["Membrane", "membrane"],
  ["Seams & corners", "seam"], ["Niches & benches", "extra"], ["Sets", "set"], ["Kits", "kit"],
];
const V = { wedi: 0, schluter: 1, sheoga: 2, brand: 3, other: 4, materials: 5, freight: 6 };
const at = (vendor, sub, label) => ({ key: label, label, order: V[vendor] * 100 + sub });

export function lineGroup(r) {
  if (r.freight) return at("freight", 0, "Freight");
  if (r.kind) return at("materials", 0, "Materials");
  if (r.wedi) {
    const key = wediRowKey(r);
    const g = key ? wediItem(key)?.group : "";
    const i = WEDI_GROUPS.findIndex(([, gs]) => gs.includes(g));
    return i < 0 ? at("wedi", WEDI_GROUPS.length, "wedi") : at("wedi", i, `wedi · ${WEDI_GROUPS[i][0]}`);
  }
  if (r.schluter) {
    const m = r.schluter;
    const code = typeof m.part === "string" ? m.part : typeof m.key === "string" ? m.key : r.sku;
    const g = schluterClassify({ sku: code })?.g;
    const i = SCHLUTER_FAMILIES.findIndex(([, f]) => f === g);
    return i < 0 ? at("schluter", SCHLUTER_FAMILIES.length, "Schluter") : at("schluter", i, `Schluter · ${SCHLUTER_FAMILIES[i][0]}`);
  }
  if (r.sheoga) return at("sheoga", 0, "Sheoga");
  const brand = String(r.brand || "").trim();
  if (brand) return at("brand", 0, brand);
  return at("other", 0, "Other items");
}

const bySku = (a, b) => String(a.sku || "").localeCompare(String(b.sku || ""), undefined, { numeric: true }) || String(a.name || "").localeCompare(String(b.name || ""));
const kindRank = (k) => { const i = PRINT_KINDS.indexOf(k); return i < 0 ? PRINT_KINDS.length : i; };
const byMaterial = (a, b) => kindRank(a.kind) - kindRank(b.kind) || bySku(a, b);

// Rows → [{ key, label, rows }] in desk order; within a group by SKU (the
// materials by their print-sheet kind first). Every row lands in exactly one
// group.
export function groupOrderLines(rows) {
  const groups = new Map();
  rows.forEach((r, i) => {
    const g = lineGroup(r);
    if (!groups.has(g.key)) groups.set(g.key, { ...g, rows: [] });
    groups.get(g.key).rows.push({ r, i });
  });
  return [...groups.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map((g) => ({
      key: g.key, label: g.label,
      rows: g.rows.sort((a, b) => (g.label === "Materials" ? byMaterial(a.r, b.r) : bySku(a.r, b.r)) || a.i - b.i).map((x) => x.r),
    }));
}

// The sheet-order list, banded by consecutive area: the rows exactly as the
// panel listed them before merging, with the estimated materials and freight
// under their own bands.
const bandOf = (r) => (r.freight ? "Freight" : r.kind || !r.area || r.area === "all areas" ? "Materials" : r.area);
export function sheetBands(rows) {
  const bands = [];
  for (const r of rows) {
    const label = bandOf(r);
    const last = bands[bands.length - 1];
    if (last && last.label === label) last.rows.push(r);
    else bands.push({ label, rows: [r] });
  }
  return bands;
}
