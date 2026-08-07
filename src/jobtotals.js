import { num, ceilQty, getCarton, getGrout, getMortar, getUnderlay, getUnderlayInstall, getPieceCarton, groutBaseList, attachedList } from "./catalog.js";
import { miscQty } from "./model.js";
import { freightList, freightTotal, freightPrintRows } from "./freight.js";
import { printMatList, lineTotal, orderLineCost } from "./print.js";
import { specialOrderMargin } from "./orderbook.js";

// The job's money math, extracted from App.jsx so it can run per option scope
// (ADR 0031): callers pass a project whose `categories` are already filtered to
// the scope they want. `proj` is the TIERED view, `rawProj` the raw record —
// freight reads raw prices (ADR 0030). One scope in, one set of numbers out;
// nothing here knows what an option is.
export function jobTotals(proj, rawProj, tSet, wSet, settings, books) {
  let totalSqft = 0, orderedSqft = 0, flooringPrice = 0, groutCost = 0, caulkCost = 0, mortarCost = 0, underlayCost = 0, miscCost = 0; const gAgg = {}, mAgg = {}, uAgg = {}, cAgg = {};
  (proj?.categories || []).forEach((a) => a.products.forEach((p) => { if (p.type === "misc") { const PC = getPieceCarton(p); miscCost += num(p.priceSqft) * (PC ? PC.pieces : miscQty(p)); } else if (p.qtyType === "sqft") { const sf = num(p.qty); totalSqft += sf; const C = getCarton(p, tSet); orderedSqft += C ? C.order * C.sf : sf; flooringPrice += (C ? C.order * C.sf : sf) * num(p.priceSqft); } else { flooringPrice += num(p.qty) * num(p.priceSqft); } const G = getGrout(p, tSet); if (G) { groutCost += G.order * G.price; const k = G.product + "||" + (G.color || "—"); if (!gAgg[k]) gAgg[k] = { product: G.product, color: G.color || "—", exact: 0 }; Object.assign(gAgg[k], { unit: G.unit, price: G.price, pending: false, colorSku: gAgg[k].colorSku || p.grout.sku || "" }); gAgg[k].exact += G.exact; } else if (p.type === "tile" && p.grout?.checked) { const k = p.grout.product + "||" + (p.grout.color || "—"); if (!gAgg[k]) gAgg[k] = { product: p.grout.product, color: p.grout.color || "—", colorSku: p.grout.sku || "", unit: tSet.grouts[p.grout.product]?.unit || "units", price: num(tSet.grouts[p.grout.product]?.price), exact: 0, pending: true }; } if (p.type === "tile" && p.grout?.checked) { const ck = num(p.grout.caulk); if (ck > 0) { caulkCost += ck * num(p.grout.caulkPrice); const k = p.grout.product + "||" + (p.grout.color || "—"); if (!cAgg[k]) cAgg[k] = { product: p.grout.product, color: p.grout.color || "—", sku: "", unit: "tubes", price: 0, exact: 0 }; cAgg[k].sku = cAgg[k].sku || p.grout.caulkSku || ""; if (num(p.grout.caulkPrice) > 0) cAgg[k].price = num(p.grout.caulkPrice); cAgg[k].exact += ck; } } const M = getMortar(p, tSet); if (M) { mortarCost += M.order * M.price; const k = M.product; if (!mAgg[k]) mAgg[k] = { product: M.product, exact: 0 }; Object.assign(mAgg[k], { unit: M.unit, price: M.price, pending: false }); mAgg[k].exact += M.exact; } else if (p.type === "tile" && p.mortar?.checked) { const k = p.mortar.product; if (!mAgg[k]) mAgg[k] = { product: p.mortar.product, unit: tSet.mortars[p.mortar.product]?.unit || "units", price: num(tSet.mortars[p.mortar.product]?.price), exact: 0, pending: true }; } const U = getUnderlay(p, tSet); if (U && U.product) { underlayCost += U.order * U.price; const k = U.product; if (!uAgg[k]) uAgg[k] = { product: U.product, exact: 0 }; Object.assign(uAgg[k], { unit: U.unit, price: U.price, pending: false }); uAgg[k].exact += U.exact; } else if (p.type !== "misc" && p.underlay?.checked && p.underlay.product) { const k = p.underlay.product; if (!uAgg[k]) uAgg[k] = { product: p.underlay.product, unit: tSet.underlayments?.[p.underlay.product]?.unit || "units", price: num(tSet.underlayments?.[p.underlay.product]?.price), exact: 0, pending: true }; } const IN = getUnderlayInstall(p, tSet); if (IN) IN.forEach((m) => { if (m.kind === "mortar") { mortarCost += m.order * m.price; const k = m.name; if (!mAgg[k]) mAgg[k] = { product: m.name, unit: m.unit, price: m.price, exact: 0 }; mAgg[k].exact += m.exact; } else { underlayCost += m.order * m.price; const k = "install||" + m.name; if (!uAgg[k]) uAgg[k] = { product: m.name, itemSku: m.sku || "", unit: m.unit, price: m.price, exact: 0 }; uAgg[k].exact += m.exact; } }); }));
  // The color's own snapshotted SKU (ADR 0007) outranks the catalog product SKU.
  const gList = Object.values(gAgg).map((g) => { const order = ceilQty(g.exact); return { ...g, sku: g.colorSku || settings.grouts[g.product]?.sku || "", order, cost: order * num(g.price) }; });
  const mList = Object.values(mAgg).map((m) => { const order = ceilQty(m.exact); return { ...m, sku: settings.mortars[m.product]?.sku || "", order, cost: order * num(m.price) }; });
  const uList = Object.values(uAgg).map((u) => { const order = ceilQty(u.exact); return { ...u, sku: u.itemSku || settings.underlayments?.[u.product]?.sku || "", order, cost: order * num(u.price) }; });
  const cList = Object.values(cAgg).map((c) => { const order = ceilQty(c.exact); return { ...c, order, cost: order * num(c.price) }; });
  // Base units ride the CONSOLIDATED kit counts (ADR 0006), so they're derived
  // from gList — not per line — and their cost joins the grout family's.
  const bList = groutBaseList(gList, tSet);
  const baseCost = bList.reduce((t, b) => t + b.cost, 0);
  // Add-on categories (ADR 0016), aggregated once and shared by the order
  // summary, order sheet, and grand total. Grouped by category for the summary.
  const aList = attachedList(proj, tSet);
  const addonCost = aList.reduce((t, r) => t + r.cost, 0);
  // Vendor freight (ADR 0030), one line per special-order book whose program is
  // configured. Computed off the RAW project, not the tier view: freight is what
  // the vendor bills to ship, so a builder discount doesn't move it. It rides
  // beside materialsCost rather than inside it — the estimate names it
  // separately, and "materials" is the shop's own sundries.
  const fList = freightList(rawProj, wSet, books);
  const freightCost = freightTotal(fList);
  const aByCat = (settings.catalog.categories || []).map((cat) => ({ cat, rows: aList.filter((r) => r.categoryId === cat.id) })).filter((g) => g.rows.length > 0);
  // Every estimated material line, flattened and labeled. A line lands here
  // even at order 0 — a checked chip whose quantity can't be computed yet
  // (no footage, no tile thickness) still names a real material the desk has to
  // key, so the order-entry panel keys it as one (orderQty) rather than hiding
  // it. The printed order sheet keeps the quantified lines only: it's the sheet
  // the warehouse pulls from, where a "1" nobody measured is a wrong pull.
  const matAll = [
    ...mList.map((m) => ({ ...m, kind: "Mortar" })),
    ...gList.map((g) => ({ ...g, product: `${g.product}${g.color !== "—" ? ` — ${g.color}` : ""}`, kind: "Grout" })),
    ...bList.map((b) => ({ ...b, product: b.name, kind: "Grout base" })),
    ...cList.map((c) => ({ ...c, product: `${c.product}${c.color !== "—" ? ` — ${c.color}` : ""} matching caulk`, kind: "Caulk" })),
    ...uList.map((u) => ({ ...u, kind: "Underlayment" })),
    ...aList.map((r) => ({ ...r, kind: r.category })),
  ];
  const matLines = matAll.filter((m) => m.order > 0);
  const hasMat = gList.length > 0 || bList.length > 0 || mList.length > 0 || uList.length > 0 || cList.length > 0 || aList.length > 0; const materialsCost = groutCost + baseCost + caulkCost + mortarCost + underlayCost + addonCost; const grandTotal = flooringPrice + materialsCost + miscCost + freightCost;
  // Internal materials margin over the rows that carry a cost (ADR 0011 / 0009
  // §8.1): a price-book pick snapshots one, and the price cell's popup takes a
  // hand-typed one on a manual line. Each row's sell mirrors its flooring/misc
  // line total, so this margin is a subset of grandTotal. On screen only —
  // never printed.
  const soLines = [];
  (proj?.categories || []).forEach((a) => a.products.forEach((p) => {
    if (!(num(p.cost) > 0) && !(num(p.costSqft) > 0)) return;
    const C = getCarton(p, tSet);
    const PC = getPieceCarton(p);
    const sell = lineTotal(p, C, PC, num(p.priceSqft));
    if (sell > 0) soLines.push({ sell, cost: orderLineCost(p, tSet, sell), markupPct: num(p.markupPct) });
  }));
  const margin = specialOrderMargin(soLines);
  // Freight prints in the same breakdown band as the materials, as its own
  // trailing group (printMatList sorts known kinds first, and the band groups by
  // adjacency), so the sheet names the charge instead of burying it in a total.
  const pMats = [...printMatList(proj, tSet), ...freightPrintRows(fList)];
  return { totalSqft, orderedSqft, flooringPrice, miscCost, groutCost, caulkCost, mortarCost, underlayCost, baseCost, addonCost, materialsCost, freightCost, grandTotal, gList, mList, uList, cList, bList, aList, fList, aByCat, matAll, matLines, hasMat, margin, pMats };
}
