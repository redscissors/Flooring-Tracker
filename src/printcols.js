// The material-columns selection sheet (spec 2026-09-30, owner pick "G3c"):
// the pure formatting behind EstimateColumns.jsx — what each product row,
// material cell and job-list line says. No React here, so it runs under node:test.
import { money, sf1, miscQty, rowBlank } from "./model.js";
import { num } from "./catalog.js";
import { u1 } from "./print.js";
import { isSpecialOrder, isSpecialMat } from "./orderentry.js";

const tighten = (t) => String(t || "").trim().replace(/(\d["”']?)\s*[x×]\s*(?=\d)/gi, "$1×");

// Tile thickness never prints on this sheet (owner 2026-09-30).
export const specSize = (p) => (p.type === "tile" ? (p.sizeText ? tighten(p.sizeText) : p.L && p.W ? `${p.L}"×${p.W}"` : "") : tighten(p.sizeText));

export function specParts(p, c) {
  const cov = c.C ? `${sf1(c.C.sf)} SF/${c.C.unit}` : c.PC ? `${c.PC.per} PC/${String(c.PC.unit).toUpperCase()}` : "";
  return [specSize(p), cov, p.sku ? `SKU ${p.sku}` : ""].filter(Boolean);
}
export const specLine = (p, c) => specParts(p, c).join(" · ");

// A row a wedi or Schluter configurator landed (ADR 0054): one dark line, the
// Size field verbatim then the name, and a muted tail — the shop SKU, or the
// vendor part number off the marker for a special-order line. Null for any
// other row, however wedi-looking its text.
// A row landed before ADR 0054 carries the old text (a dash lead, a brand
// mark, a spaced "36\" x 60\"" size, the book's "= 108 sf") — the standard
// treatment still fits it; the new one would print its size twice.
const LEGACY_TEXT = /[—®™×=]|\s[xX-]\s|^wedi US\d|^Schluter\s/;
export function brandRow(p) {
  const m = (p && (p.wedi || p.schluter)) || null;
  if (!m || typeof m !== "object") return null;
  if (LEGACY_TEXT.test(String(p.brandColor || "")) || LEGACY_TEXT.test(String(p.sizeText || ""))) return null;
  const lead = [p.sizeText, p.brandColor].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  const part = typeof m.key === "string" ? m.key : typeof m.part === "string" ? m.part : "";
  return { lead, tail: p.sku ? `SKU ${p.sku}` : part };
}

export function qtyCells(p, c) {
  if (c.C) return { top: `${c.C.order} ${c.C.unit}`, sub: `${sf1(c.orderedSf)} SF` };
  if (c.PC) return { top: `${c.PC.cartons} ${c.PC.unit}`, sub: "" };
  if (p.type === "misc") return { top: `${miscQty(p)} ${c.countUnit.toLowerCase()}`, sub: "" };
  if (p.qtyType === "count") return { top: num(p.qty) > 0 ? `${sf1(num(p.qty))} ${c.countUnit.toLowerCase()}` : "", sub: "" };
  return { top: num(p.qty) > 0 ? `${sf1(num(p.qty))} SF` : "", sub: "" };
}

export function priceCells(p, c) {
  const unit = num(p.priceSqft);
  if (p.type !== "misc" && p.qtyType === "sqft") {
    if (!(unit > 0)) return { top: "", sub: "" };
    return { top: `${money(unit)}/sf`, sub: c.C ? `${money(c.C.sf * unit)}/${c.C.unit}` : "" };
  }
  return { top: c.priceText || "", sub: "" };
}

export const COLS = [
  { key: "grout", label: "Grout", w: 102 },
  { key: "mortar", label: "Adhesive", w: 74 },
  { key: "underlay", label: "Underlay", w: 94 },
  { key: "other", label: "Other", w: 90 },
];

// Caulk rides the grout pick and install items ride the underlayment — both
// print only in the job list (owner 2026-09-30).
export function matColumn(m) {
  if (m.addon) return "other";
  if (m.kind === "Grout") return "grout";
  if (m.kind === "Mortar") return "mortar";
  if (m.kind === "Tile Backer" || m.kind === "Underlayment") return "underlay";
  return null;
}

export function lineCells(c) {
  const out = { grout: [], mortar: [], underlay: [], other: [] };
  for (const m of c.mats || []) { const k = matColumn(m); if (k) out[k].push(m); }
  return out;
}

// The rule between two lines runs across the whole material strip when any
// printed column has a material on either side, and not at all otherwise
// (owner 2026-10-01, issue 164).
export const stripRuled = (prev, cells, cols) => !!prev && cols.some((col) => prev[col.key].length > 0 || cells[col.key].length > 0);

// Column widths follow the materials (issue 164): wide enough that every
// name wraps to two lines at most — grout's name and its color · joint one
// line each — within a per-column clamp and a cap on the whole strip, so the
// product names keep their room and an outlier takes a third line instead.
// `slack` covers canvas measurement vs the printed glyphs; `pad` the cell's
// side padding and rule.
export const FIT = { min: 56, max: 150, total: 330, pad: 7, slack: 1.04 };

export function twoLineWidth(text, measure) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (words.length < 2) return words.length ? measure(words[0]) : 0;
  let best = Infinity;
  for (let k = 1; k < words.length; k++) best = Math.min(best, Math.max(measure(words.slice(0, k).join(" ")), measure(words.slice(k).join(" "))));
  return best;
}

// `measure(text, kind)` returns a printed width in px; kind is "cell", "label"
// (an add-on's kind line) or "head" (the column's header label). `gutter` is
// the amount column beside each name in full pricing.
export function fitColumns(cols, lines, measure, gutter = 0) {
  if (!measure) return cols;
  const need = (m) => {
    const t = cellParts(m);
    const text = t.sub ? Math.max(measure(t.name, "cell"), measure(t.sub, "cell")) : twoLineWidth(t.name, (x) => measure(x, "cell"));
    return Math.max(text + gutter, t.label ? measure(t.label, "label") : 0);
  };
  const ws = cols.map((col) => {
    let w = measure(col.label, "head");
    for (const c of lines) for (const m of c.mats || []) if (matColumn(m) === col.key) w = Math.max(w, need(m));
    return Math.min(FIT.max, Math.max(FIT.min, Math.ceil(w * FIT.slack + FIT.pad)));
  });
  const total = ws.reduce((a, b) => a + b, 0);
  const k = total > FIT.total ? FIT.total / total : 1;
  return cols.map((col, i) => ({ ...col, w: Math.max(FIT.min, Math.floor(ws[i] * k)) }));
}

export function columnsUsed(lines) {
  const used = new Set();
  for (const c of lines) for (const m of c.mats || []) { const k = matColumn(m); if (k) used.add(k); }
  return COLS.filter((col) => used.has(col.key));
}

export function needText(exact, unit) {
  if (!(exact > 0)) return "—";
  const r = Math.round(exact * 10) / 10;
  return `${r.toFixed(1)} ${u1(r, unit)}`;
}

// The ◆ says "can't be returned" to a customer, so it prints only once the stock
// books have loaded — before that every book pick would read as special order.
export function specialCheck(stockBookIds, stockSkus) {
  if (!stockBookIds) return { row: () => false, mat: () => false };
  return { row: (p) => isSpecialOrder(p, stockBookIds, stockSkus), mat: (m) => isSpecialMat(m, stockBookIds) };
}

// One line only when there's nothing for a second line to say: no material in
// any printed column and no ordered SF or bundle price to check the total by.
export const isOneLine = (cells, cols, q, pr) => cols.every((col) => cells[col.key].length === 0) && !q.sub && !pr.sub;

export function cellParts(m) {
  const r = Math.round((m.exact || 0) * 10) / 10;
  const color = m.kind === "Grout" ? m.spec || "" : "";
  const joint = m.kind === "Grout" ? String(m.detail || "").replace(/ joint\b/, "") : "";
  return {
    label: m.addon ? m.kind : "",
    name: m.name,
    sub: [color, joint].filter(Boolean).join(" · "),
    qty: m.exact > 0 ? r.toFixed(1) : "",
    unit: m.exact > 0 ? u1(r, m.unit) : "",
  };
}

// The product block's own grid; the material columns ride beside it as one
// strip so their boxes butt and close (issue 163).
export function gridSpec(pMode, cols) {
  const money = { qty: pMode !== "unit", price: pMode !== "none", total: pMode === "full" };
  const left = ["10px", "minmax(0,1fr)", money.qty && "34px", money.price && "50px", money.total && "58px"].filter(Boolean).join(" ");
  const matsW = cols.reduce((t, c) => t + c.w, 0);
  return { left, matsW, outer: cols.length ? `minmax(0,1fr) ${matsW}px` : "minmax(0,1fr)", money };
}

// A quote whose only printed area was never named prints no area header.
export function loneUnnamedArea(areas) {
  const printed = areas.filter((a) => a.products.some((p) => !rowBlank(p)));
  return printed.length === 1 && !(printed[0].name || "").trim();
}

const GROUP_ORDER = ["Grout color", "Grout base", "Caulk", "Adhesive", "Underlay", "Install"];
const groupOf = (m) => {
  if (m.kind === "Grout") return "Grout color";
  // Mortar is glue for hardwood and vinyl too (owner 2026-10-01).
  if (m.kind === "Mortar") return "Adhesive";
  if (m.kind === "Tile Backer" || m.kind === "Underlayment") return "Underlay";
  if (m.kind === "Install" || m.kind === "Install materials") return "Install";
  return m.kind;
};
const NO_NEED = new Set(["Grout base", "Caulk", "Freight"]);

// The job order list: one line per material, grouped under the sheet's labels.
// Built-in groups first, then add-on categories as they come, freight last.
export function jobListGroups(pMats) {
  const groups = new Map();
  for (const m of pMats || []) {
    const label = groupOf(m);
    const row = {
      name: (m.kind === "Grout" || m.kind === "Caulk") && m.spec ? `${m.name} · ${m.spec}` : m.name,
      sku: m.sku || "", needed: NO_NEED.has(m.kind) ? "" : needText(m.exact, m.unit),
      order: m.kind === "Freight" ? Math.round(m.order) : m.order, unit: m.unit, price: m.price, total: m.cost, bookId: m.bookId || "",
      detail: m.kind === "Freight" ? m.detail || "" : "",
    };
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(row);
  }
  const rank = (l) => (l === "Freight" ? 1e9 : GROUP_ORDER.includes(l) ? GROUP_ORDER.indexOf(l) : GROUP_ORDER.length);
  return [...groups.entries()].map(([label, rows]) => ({ label, rows })).sort((a, b) => rank(a.label) - rank(b.label));
}
