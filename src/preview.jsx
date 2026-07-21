// Preview harness for the Sheoga vent/damper fix: per-each lines now land with
// their size in the row's SIZE FIELD (sizeText) and their pricing carried into
// every line total. Rows come from the REAL sheoga.lineItems(); the "grid row"
// strip prices them with the same math as App.jsx's lineTotal helper, and the
// order-entry section is the REAL OrderEntryPanel over the same payloads — so
// what shows here is the code path the app runs, without touching Supabase.
// Dev-only entry (preview.html); not part of the app build.
import { createRoot } from "react-dom/client";
import "./index.css";
import { OrderEntryPanel } from "./orderentry.jsx";
import { isSpecialOrder, orderCopyText, orderDescription } from "./orderentry.js";
import { lineItems, defaultConfig } from "./sheoga.js";

const num = (v) => parseFloat(v) || 0;
const money = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Same math as App.jsx's lineTotal: misc = pieces × each; flooring = cartons or
// sqft × per-sf — and a non-misc row counted each bills qty × price-each.
const lineTotal = (p) =>
  p.type === "misc" ? num(p.priceSqft) * (num(p.qty) || 1)
  : (num(p.cartonSf) > 0 && p.qtyType === "sqft" ? Math.ceil(num(p.qty) / num(p.cartonSf)) * num(p.cartonSf) : num(p.qty)) * num(p.priceSqft);

// One of each per-each program (vent + loose damper, at the 50% vent markup)
// plus a stocked floor line to show the sqft path unchanged (40% markup).
const ventLines = lineItems({ mode: "vent", cfg: { ...defaultConfig("vent"), sp: "Walnut", size: "4×12", cubed: true, qty: 6 } }, { sf: 0, markupPct: 50 });
const damperLines = lineItems({ mode: "damper", cfg: { size: "6×14", qty: 8 } }, { sf: 0, markupPct: 50 });
const floorLines = lineItems({ mode: "floor", cfg: { ...defaultConfig("floor"), sp: "White Oak", w: 5.25, grade: "char", cons: "solid", finish: "t1" } }, { sf: 900, markupPct: 40 });

const gridRows = [
  { ...ventLines[0], id: "v1" },
  { ...damperLines[0], id: "d1" },
  { ...floorLines[0], id: "f1" },
];

const toOrderRow = (p, limit) => {
  const each = p.qtyType === "count";
  const r = {
    id: p.id, special: isSpecialOrder(p), byDesc: !!p.sheoga && !p.sku, area: "Kitchen",
    tag: "", sizePlain: p.sizeText || "", name: String(p.brandColor || ""), sku: p.sku || "",
    sheoga: p.sheoga, coverage: num(p.cartonSf) > 0 ? `${p.cartonSf} SF/CT` : "",
    qty: num(p.qty), unitCode: each ? "PC" : "SF",
    qtyText: num(p.qty) > 0 ? `${p.qty} ${each ? "PC" : "SF"}` : "—",
    perCost: num(p.costSqft), perSell: num(p.priceSqft),
  };
  const desc = orderDescription(r, limit);
  return { ...r, desc, copy: orderCopyText({ ...r, desc }) };
};

function Preview() {
  const rows = gridRows.map((p) => toOrderRow(p, 30));
  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <div className="max-w-2xl relative z-[60]">
        <h1 className="text-lg font-semibold mb-1">Sheoga vents & dampers — size in the size field, pricing carried</h1>
        <p className="text-xs text-slate-500 mb-5 max-w-xl">
          Payloads from the real <code>lineItems()</code>. Per-each lines used to land with an empty size
          field (size buried in the description) and a $0 line total everywhere — the sqft math zeroed
          count rows. The size now snapshots to <code>sizeText</code> and totals bill qty × price-each.
        </p>

        <h2 className="ft-eyebrow text-[10px] tracking-[.12em] text-slate-500 mb-2">What lands on the product row (grid / estimate)</h2>
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden mb-6">
          <div className="grid text-[9px] font-extrabold uppercase tracking-wide text-slate-400 px-3 py-2 border-b border-slate-200" style={{ gridTemplateColumns: "70px 1fr 64px 84px 90px" }}>
            <span>Size</span><span>Product / Color</span><span className="text-right">Qty</span><span className="text-right">Price</span><span className="text-right">Line total</span>
          </div>
          {gridRows.map((p) => (
            <div key={p.id} className="grid items-baseline px-3 py-2 text-[12.5px] border-b border-slate-100 last:border-b-0" style={{ gridTemplateColumns: "70px 1fr 64px 84px 90px" }}>
              <span className="ft-mono font-bold" style={{ color: "var(--ft-brand-deep)" }}>{p.sizeText || "—"}</span>
              <span className="truncate pr-2">{p.brandColor}</span>
              <span className="ft-mono text-right">{p.qty} {p.qtyType === "count" ? "EA" : "SF"}</span>
              <span className="ft-mono text-right">{money(num(p.priceSqft))}{p.qtyType === "count" ? "/ea" : "/sf"}</span>
              <span className="ft-mono text-right font-bold">{money(lineTotal(p))}</span>
            </div>
          ))}
          <div className="px-3 py-1.5 text-[11px] text-slate-400 bg-slate-50">
            Before this fix the vent and damper rows read “—” size and a dash total; both now carry through
            the grid, estimate totals, print, and the special-order margin.
          </div>
        </div>
      </div>

      <OrderEntryPanel name="Preview — Sheoga vent fix" special={rows.filter((r) => r.special)}
        stock={rows.filter((r) => !r.special)} descLimit={30} onClose={() => {}} />
    </div>
  );
}

const el = document.getElementById("preview");
const root = (window.__previewRoot ||= createRoot(el));
root.render(<Preview />);
