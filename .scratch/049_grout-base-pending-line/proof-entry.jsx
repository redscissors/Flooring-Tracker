// Preview proof (2026-07-25 grout base companion line): a two-part grout picked
// on a row with no square footage now lists its base as a pending companion —
// named, but with no quantity and no cost. Section 1 renders the REAL
// EstimatePaper; section 2 mirrors App.jsx's on-screen Grout column markup over
// live gList/groutBaseList values. Built by proof-vite.config.mjs, never shipped.
import { createRoot } from "react-dom/client";
import { EstimatePaper } from "../../src/EstimatePrint.jsx";
import { normalizeSettings, withProjWaste, getGrout, groutBaseList, ceilQty, num } from "../../src/catalog.js";
import { tierView } from "../../src/pricing.js";
import { printMatList, printProduct, u1 } from "../../src/print.js";
import { normC, newProject, newArea, newProduct, money } from "../../src/model.js";
import "../../src/index.css";

const settings = normalizeSettings({
  catalog: { companies: [{ name: "Laticrete", enabled: true, mortars: [{ name: "254 Platinum", tier1: 90, tier2: 70, tier3: 50, unit: "bags", price: 42, sku: "05077" }], underlayments: [], grouts: [
    { name: "PermaColor Color Kit", coverage: 110, unit: "kits", price: 5.39, sku: "05123", base: { sku: "1519065", name: "PermaColor Sanded Base", unit: "units", price: 24.75, per: 1 } },
    { name: "Spectralock Part C", coverage: 90, unit: "kits", price: 32.89, sku: "05140", base: { sku: "1518984", name: "SpectraLock Comm. Unit", unit: "units", price: 374.99, per: 4 } },
  ] }] },
});

const grout = (product, color, sku) => ({ ...newProduct().grout, checked: true, product, color, sku, joint: 0.125 });

// Sized row: 180 sf of 12×12 — the grout and its base compute as always.
const sized = {
  ...newProduct(),
  sku: "12480", brandColor: "Earth Ash Gray Matte", L: "12", W: "12", thickness: "0.375",
  priceSqft: "4.85", qty: "180", cartonSf: "15.5",
  grout: grout("PermaColor Color Kit", "Silverado", "05153"),
  mortar: { checked: true, product: "254 Platinum", manual: "" },
};
// The reported case: grout chosen, no square footage to figure it off of.
const unsized = {
  ...newProduct(),
  sku: "18820", brandColor: "Carrara Bianco Polished", L: "12", W: "24", thickness: "0.375",
  priceSqft: "6.20", qty: "",
  grout: grout("Spectralock Part C", "Silver Shadow", "05161"),
};

const proj = normC({
  ...newProject("c1", "Whole-house selections"),
  categories: [
    { ...newArea(), name: "Master Bath", products: [sized] },
    { ...newArea(), name: "Powder Room — SF not measured yet", products: [unsized] },
  ],
});
proj._full = true;

const wSet = withProjWaste(settings, proj);
const tv = tierView(proj, wSet);
const tSet = tv.settings;
const pMats = printMatList(tv.proj, tSet);
const materialsCost = pMats.reduce((t, m) => t + m.cost, 0);
const flooringPrice = tv.proj.categories.reduce((t, a) => t + a.products.reduce((s, p) => s + printProduct(p, tSet).line, 0), 0);
const orderedSqft = tv.proj.categories.reduce((t, a) => t + a.products.reduce((s, p) => s + printProduct(p, tSet).orderedSf, 0), 0);

createRoot(document.getElementById("paper")).render(
  <EstimatePaper sel={proj} people={[{ id: "c1", name: "Jane Householder", address: "123 Main St, Millersburg OH" }]}
    profile={{ name: "Marcus", phone: "", email: "" }} tv={tv} jobWaste={wSet.waste} pMats={pMats} tSet={tSet}
    materialsCost={materialsCost} flooringPrice={flooringPrice} miscCost={0}
    totalSqft={180} orderedSqft={orderedSqft} grandTotal={flooringPrice + materialsCost} />
);

// --- the on-screen Materials estimate's Grout column ---------------------------
// gAgg/gList mirror App.jsx: a grout that can't compute still aggregates, marked
// pending, and the base list rides the consolidated kit counts.
const gAgg = {};
tv.proj.categories.forEach((a) => a.products.forEach((p) => {
  const G = getGrout(p, tSet);
  const k = p.grout.product + "||" + (p.grout.color || "—");
  if (G) {
    if (!gAgg[k]) gAgg[k] = { product: G.product, color: G.color || "—", exact: 0 };
    Object.assign(gAgg[k], { unit: G.unit, price: G.price, pending: false, colorSku: gAgg[k].colorSku || p.grout.sku || "" });
    gAgg[k].exact += G.exact;
  } else if (p.type === "tile" && p.grout?.checked) {
    gAgg[k] = { product: p.grout.product, color: p.grout.color || "—", colorSku: p.grout.sku || "", unit: tSet.grouts[p.grout.product]?.unit || "units", price: num(tSet.grouts[p.grout.product]?.price), exact: 0, pending: true };
  }
}));
const gList = Object.values(gAgg).map((g) => { const order = ceilQty(g.exact); return { ...g, sku: g.colorSku || tSet.grouts[g.product]?.sku || "", order, cost: order * num(g.price) }; });
const bList = groutBaseList(gList, tSet);
const groutCost = gList.reduce((t, g) => t + g.cost, 0);
const baseCost = bList.reduce((t, b) => t + b.cost, 0);

// Markup mirrored from App.jsx's Materials estimate → Grout column.
function GroutColumn() {
  const rows = [...gList, ...bList.map((b) => ({ product: b.name, sku: b.sku, color: "—", order: b.order, unit: b.unit, cost: b.cost, price: b.price, pending: b.pending }))];
  return (
    <div className="bg-white border border-slate-200 rounded-lg" style={{ padding: 16, width: 300 }}>
      <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)", borderBottom: "1px solid var(--ft-row-line)", paddingBottom: 4, marginBottom: 8 }}>Grout</div>
      {rows.map((g, i) => (
        <div key={i} className="flex justify-between gap-2.5 py-1" style={{ fontSize: 12 }}>
          <span className="font-medium min-w-0">{g.product}{g.color !== "—" && <span className="text-slate-500 font-normal"> · {g.color}</span>}{g.sku && <span className="ft-mono block font-normal" style={{ fontSize: 9.5, color: "var(--ft-faint)" }}>{g.sku}</span>}</span>
          <span className="ft-mono text-slate-500 whitespace-nowrap text-right" style={{ fontSize: 11 }}>{g.pending ? "—" : <>{g.order} {g.unit}</>}{g.cost > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(g.cost)}</span> : g.pending && g.price > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(g.price)}/{u1(1, g.unit)}</span> : null}</span>
        </div>
      ))}
    </div>
  );
}
createRoot(document.getElementById("summary")).render(<GroutColumn />);

const cell = (t) => `<td>${t}</td>`;
document.getElementById("bases").innerHTML = bList
  .map((b) => `<tr>${cell(b.name)}${cell(String(b.pending))}${cell(b.order)}${cell(money(b.cost))}</tr>`).join("");
document.getElementById("totals").innerHTML = [
  ["grout", money(groutCost)], ["grout base", money(baseCost)],
  ["materials subtotal", money(materialsCost)], ["grand total", money(flooringPrice + materialsCost)],
].map(([k, v]) => `<tr>${cell(k)}${cell(v)}</tr>`).join("");
