// The material-columns selection sheet (spec 2026-09-30, owner pick "G3c"):
// the pure formatting behind EstimateColumns.jsx — what each product row,
// material cell and job-list line says. No React here, so it runs under node:test.
import { money, sf1, miscQty } from "./model.js";
import { num } from "./catalog.js";
import { u1 } from "./print.js";
import { isSpecialOrder, isSpecialMat } from "./orderentry.js";

const tighten = (t) => String(t || "").trim().replace(/(\d["”']?)\s*[x×]\s*(?=\d)/gi, "$1×");

// Tile thickness never prints on this sheet (owner 2026-09-30).
export const specSize = (p) => (p.type === "tile" ? (p.sizeText ? tighten(p.sizeText) : p.L && p.W ? `${p.L}"×${p.W}"` : "") : tighten(p.sizeText));

export function specLine(p, c) {
  const cov = c.C ? `${sf1(c.C.sf)} SF/${c.C.unit}` : c.PC ? `${c.PC.per} PC/${String(c.PC.unit).toUpperCase()}` : "";
  return [specSize(p), cov, p.sku ? `SKU ${p.sku}` : ""].filter(Boolean).join(" · ");
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
  { key: "grout", label: "Grout", w: 88 },
  { key: "mortar", label: "Mortar", w: 82 },
  { key: "underlay", label: "Underlay", w: 100 },
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
  return {
    label: m.addon ? m.kind : "",
    name: m.name,
    color: m.kind === "Grout" ? m.spec || "" : "",
    left: m.kind === "Grout" ? String(m.detail || "").replace(/ joint\b/, "") : "",
    amount: needText(m.exact, m.unit),
  };
}

export function gridSpec(pMode, cols) {
  const money = { qty: pMode !== "unit", price: pMode !== "none", total: pMode === "full" };
  const template = ["10px", "minmax(0,1fr)", money.qty && "38px", money.price && "60px", money.total && "58px", ...cols.map((c) => `${c.w}px`)].filter(Boolean).join(" ");
  return { template, money };
}

const GROUP_ORDER = ["Grout color", "Grout base", "Caulk", "Mortar", "Underlay", "Install"];
const groupOf = (m) => {
  if (m.kind === "Grout") return "Grout color";
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
