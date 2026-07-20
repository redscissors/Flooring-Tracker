import { num, ceilQty, getGrout, getMortar, groutBaseList, getCarton, getPieceCarton, getUnderlay, getUnderlayInstall, getAttached } from "./catalog.js";
import { JOINTS, THICK, underlayLabel } from "./uiconst.js";
import { money, miscQty, sf1 } from "./model.js";
import { isSpecialOrder, orderCopyText, orderDescription } from "./orderentry.js";

// Extended line total at `unit` (the row's per-sf or per-each price): pieces
// for misc, whole-carton footage when carton-sold, otherwise the entered qty —
// which on a non-misc row counted each (a Sheoga vent, a row toggled to EA) is
// the count itself, not square footage.
export const lineTotal = (p, C, PC, unit) => (p.type === "misc" ? unit * (PC ? PC.pieces : miscQty(p)) : (C ? C.order * C.sf : num(p.qty)) * unit);

// One product row -> everything the print layouts render for it. Materials
// carry a `kind` + aggregation `key`; `inline` rows print under the product
// (label · qty · name), install extras only reach the bottom breakdown.
export function printProduct(p, s) {
  const G = getGrout(p, s), M = getMortar(p, s), U = getUnderlay(p, s), IN = getUnderlayInstall(p, s) || [];
  const sf = p.qtyType === "sqft" ? num(p.qty) : 0;
  const C = p.type === "misc" ? null : getCarton(p, s);
  // A carton-sold count line (cartonPc) bills every piece in the rounded-up
  // cartons, price per piece (ADR 0013 amendment).
  const PC = getPieceCarton(p);
  const line = lineTotal(p, C, PC, num(p.priceSqft));
  const j = JOINTS.find((x) => x.v === num(p.grout?.joint))?.label;
  const mats = [];
  if (p.type === "tile" && p.grout?.checked) {
    // Show selected grout even when the quantity can't be computed (e.g. tile
    // thickness/joint not entered) so it prints like mortar/backer instead of
    // silently vanishing; blank order/price when uncomputed.
    mats.push({ kind: "Grout", key: `g|${p.grout.product}|${p.grout.color || ""}`, name: p.grout.product, spec: p.grout.color || "", sku: p.grout.sku || "", detail: [j ? `${j} joint` : "", G && G.round ? "penny round" : ""].filter(Boolean).join(" · "), inline: true, order: G ? G.order : 0, unit: G ? G.unit : "", exact: G ? G.exact : 0, price: G ? G.price : num(s.grouts[p.grout.product]?.price), cost: G && G.price > 0 ? G.order * G.price : 0 });
    const ck = num(p.grout.caulk);
    if (ck > 0) mats.push({ kind: "Caulk", key: `c|${p.grout.product}|${p.grout.color || ""}`, name: `${p.grout.product} matching caulk`, spec: p.grout.color || "", sku: p.grout.caulkSku || "", detail: "", inline: true, order: ck, unit: "tubes", exact: ck, price: num(p.grout.caulkPrice), cost: ck * num(p.grout.caulkPrice) });
  }
  if (M) mats.push({ kind: "Mortar", key: `m|${M.product}`, name: M.product, spec: "", detail: "", inline: true, order: M.order, unit: M.unit, exact: M.exact, price: M.price, cost: M.price > 0 ? M.order * M.price : 0 });
  if (U && U.product) mats.push({ kind: underlayLabel(p.type), key: `u|${U.product}`, name: U.product, spec: "", detail: IN.length ? "+ install materials" : "", inline: true, order: U.order, unit: U.unit, exact: U.exact, price: U.price, cost: U.price > 0 ? U.order * U.price : 0 });
  IN.forEach((m) => mats.push(m.kind === "mortar"
    ? { kind: "Mortar", key: `m|${m.name}`, name: m.name, spec: "", detail: "", inline: false, order: m.order, unit: m.unit, exact: m.exact, price: m.price, cost: m.price > 0 ? m.order * m.price : 0 }
    : { kind: "Install", key: `i|${m.name}`, name: m.name, spec: U?.product ? `installs ${U.product}` : "", sku: m.sku || "", detail: "", inline: false, order: m.order, unit: m.unit, exact: m.exact, price: m.price, cost: m.price > 0 ? m.order * m.price : 0 }));
  // Add-on categories (ADR 0016) print inline under the product and roll into
  // the bottom breakdown, keyed by category + product name; the category name
  // is the material "kind" (no fixed KSHORT — labels fall back to it).
  for (const cat of (s.catalog?.categories || [])) {
    const A = getAttached(p, s, cat); if (!A) continue;
    mats.push({ kind: cat.name, addon: true, key: `x|${cat.id}|${A.product}`, name: A.product, spec: "", sku: s.attached?.[cat.id]?.[A.product]?.sku || "", detail: "", inline: true, order: A.order, unit: A.unit, exact: A.exact, price: A.price, cost: A.price > 0 ? A.order * A.price : 0 });
  }
  const thickSuffix = p.type === "tile" && p.thickness ? ` × ${THICK.find((t) => t.v === String(p.thickness))?.label || p.thickness + '"'}` : "";
  const size = p.type === "tile" ? (p.sizeText ? `${p.sizeText}${thickSuffix}` : `${p.L}" × ${p.W}"${thickSuffix}`) : (p.sizeText || "");
  const qtyText = p.type === "misc" ? (PC ? `${PC.pieces} pcs (${PC.cartons} ${PC.unit})` : String(miscQty(p))) : C ? (C.order > 0 ? `${C.order} ${C.unit}` : "") : num(p.qty) > 0 ? `${p.qty} ${p.qtyType === "sqft" ? "sf" : "units"}` : "";
  const priceText = num(p.priceSqft) > 0 ? (p.type === "misc" ? money(num(p.priceSqft)) + ((PC ? PC.pieces : miscQty(p)) !== 1 ? "/ea" : "") : `${money(num(p.priceSqft))}/${p.qtyType === "count" ? "ea" : "sf"}`) : "";
  return { size, C, PC, line, mats, qtyText, priceText, orderedSf: p.type === "misc" ? 0 : C ? C.order * C.sf : sf };
}
// The honest extended vendor cost of a special-order line: the snapshotted
// per-unit cost (costSqft, parallel to priceSqft) carried through the SAME
// quantity math as its sell (printProduct.line), so hand-editing the sale price
// moves the margin, not the cost. Rows saved before costSqft existed fall back
// to deriving the cost from the markup — the prior behavior, correct until the
// price is edited. `sell` is the line's extended sell (printProduct.line).
export function orderLineCost(p, s, sell) {
  if (String(p.costSqft ?? "").trim() !== "") return lineTotal(p, getCarton(p, s), getPieceCarton(p), num(p.costSqft));
  const pct = num(p.markupPct);
  return pct > 0 ? sell / (1 + pct / 100) : sell;
}
// Estimate area headers show the flooring subtotal only — material costs live
// in the bottom "Setting materials & sundries" breakdown.
export const printAreaFloor = (a, s) => a.products.reduce((t, p) => t + printProduct(p, s).line, 0);
export const PRINT_KINDS = ["Grout", "Grout base", "Caulk", "Mortar", "Tile Backer", "Underlayment", "Install"];
// Kiln #8b estimate sheet: the 9-column product grid and the muted em dash
// empty cells render (the Color column is a dash for now — the data model
// keeps brand+color in one brandColor field).
export const PRINT_COLS = "0.95fr 2.5fr 1fr 0.55fr 0.5fr 0.6fr 0.8fr 0.8fr";
// Print-pricing variants (spec 2026-07-16): "unit" drops the Total column,
// "none" drops Price too — quantities/SKUs keep the sheet a selection document.
export const PRINT_COLS_UNIT = "0.95fr 2.5fr 1fr 0.55fr 0.5fr 0.6fr 0.8fr";
export const PRINT_COLS_NONE = "0.95fr 2.5fr 1fr 0.55fr 0.5fr 0.8fr";
export const KSHORT = { Grout: "Grout", "Grout base": "Base", Caulk: "Caulk", Mortar: "Mortar", "Tile Backer": "Backer", Underlayment: "Underlay", Install: "Install" };
// Estimate print layout. "cards" is the 2026-07 receipt-card redesign; flip to
// "classic" to restore the prior 8-column table sheet (kept intact in
// renderEstimatePaperClassic) if the new one ever needs to be pulled.
export const ESTIMATE_PRINT_LAYOUT = "cards";
export const u1 = (order, unit) => (order === 1 ? String(unit || "").replace(/s$/, "") : unit);
// The catalog SKU a breakdown row carries (materials resolve by name — the SKU
// is display-only, per ADR 0006).
export const matSku = (kind, name, s) =>
  kind === "Grout" ? s.grouts[name]?.sku || ""
    : kind === "Mortar" ? s.mortars[name]?.sku || ""
      : kind === "Tile Backer" || kind === "Underlayment" ? s.underlayments?.[name]?.sku || "" : "";
// Whole-job materials for the estimate's bottom breakdown: aggregate exact
// quantities per item (ceil once at the end, like the on-screen totals) and
// sum the per-line costs so the breakdown reconciles with the grand total.
// Base units derive from the aggregated grout kit counts (ADR 0006) via the
// same groutBaseList the on-screen summary uses.
export function printMatList(cust, s) {
  const agg = new Map();
  (cust.categories || []).forEach((a) => a.products.forEach((p) => printProduct(p, s).mats.forEach((m) => {
    const e = agg.get(m.key) || { kind: m.kind, name: m.name, spec: m.spec, detail: m.detail || "", sku: "", unit: m.unit, price: m.price, exact: 0, cost: 0 };
    e.exact += m.exact; e.cost += m.cost; e.sku = e.sku || m.sku || ""; e.detail = e.detail || m.detail || ""; agg.set(m.key, e);
  })));
  // A selection-snapshotted SKU (the grout color's own SKU, ADR 0007) outranks
  // the catalog product's SKU; the catalog SKU is the fallback.
  const rows = [...agg.values()].map((m) => ({ ...m, sku: m.sku || matSku(m.kind, m.name, s), order: ceilQty(m.exact) }));
  const bases = groutBaseList(rows.filter((m) => m.kind === "Grout").map((m) => ({ product: m.name, order: m.order })), s)
    .map((b) => ({ kind: "Grout base", name: b.name, spec: "", sku: b.sku, unit: b.unit, price: b.price, exact: b.exact, order: b.order, cost: b.cost }));
  // Built-in kinds sort by PRINT_KINDS; add-on categories (unknown kinds) sort
  // after them, grouped so each category gets one breakdown heading.
  const rank = (k) => { const i = PRINT_KINDS.indexOf(k); return i < 0 ? PRINT_KINDS.length : i; };
  return [...rows, ...bases].sort((x, y) => rank(x.kind) - rank(y.kind));
}

// Display unit codes for the order-entry panel. The order unit ("ct"/"sh" for
// carton/sheet-billed rows, "units" for a piece count, "ea" for misc, "sf" for
// square-foot flooring) becomes a short uppercase code shown on the qty and the
// per-unit cost/sell — so a line always reads in the unit it's bought and sold.
export const ORDER_UNIT_CODE = { ct: "CT", sh: "SH", sf: "SF", units: "PC", ea: "EA" };

// One product row → the fields the order-entry panel shows. Special-order rows
// (bookId set) carry a snapshotted cost; the sell is the row's line total, and
// the cost is the honest vendor cost carried through the same quantity math
// (orderLineCost) — so a hand-edited sale price moves the margin, not the cost.
// Per-unit values are the extended totals ÷ ordered qty, so they read in the
// sell unit (per carton / sheet / piece / sf). The item text
// splits at the SKU: size + color on top, SKU + coverage beneath — thickness
// dropped, spaces only. Carton/sheet rows lead with a CT/SH tag (also in the
// copied text) since the order-entry system can't be switched off "each".
// Read-only; no math is mutated.
export function orderEntryRow(p, s, area, descLimit) {
  const c = printProduct(p, s);
  const isMisc = p.type === "misc";
  // A carton-sold count line orders in CARTONS (the vendor's sell unit) — the
  // desk keys the order in cartons even though the row quotes per piece.
  const qty = isMisc ? (c.PC ? c.PC.cartons : miscQty(p)) : (c.C ? c.C.order : num(p.qty));
  const rawUnit = isMisc ? (c.PC ? c.PC.unit : "ea") : (c.C ? c.C.unit : (p.qtyType === "sqft" ? "sf" : "units"));
  const unitCode = ORDER_UNIT_CODE[rawUnit] || String(rawUnit || "").toUpperCase();
  // Only carton/sheet-billed lines flag a non-"each" order unit.
  const tag = c.C || c.PC ? unitCode : "";
  const sizePlain = p.type === "tile" ? (p.sizeText || `${p.L}" × ${p.W}"`) : (p.sizeText || "");
  const coverage = num(p.cartonSf) > 0 ? `${sf1(num(p.cartonSf))} SF/${unitCode}` : c.PC ? `${c.PC.per} PC/${unitCode}` : "";
  const extSell = c.line;
  const extCost = orderLineCost(p, s, extSell);
  // A Mannington trim's name carries a "· fits APX020 …" note (manningtonbook.js)
  // that helps the picker surface it under a floor-code search; it's noise once
  // the trim is on the order, so drop it from the panel's name and copied text.
  const name = String(p.brandColor || "").replace(/\s*·\s*fits\b.*$/i, "").trim();
  // Sheoga sells by description, not SKU — the description IS the order.
  const byDesc = !!p.sheoga && !p.sku;
  const r = {
    id: p.id, special: isSpecialOrder(p), byDesc, area,
    tag, sizePlain, name, sku: p.sku, coverage, sheoga: p.sheoga,
    qty, unitCode, qtyText: qty > 0 ? `${qty} ${unitCode}` : "—",
    perCost: qty > 0 ? extCost / qty : 0,
    perSell: qty > 0 ? extSell / qty : 0,
  };
  const desc = orderDescription(r, descLimit);
  return { ...r, desc, copy: orderCopyText({ ...r, desc }) };
}
