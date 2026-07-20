// Preview harness for per-project waste (spec 2026-07-19). The control is the
// REAL WasteBar exported from App.jsx, the quantities come from the REAL
// catalog math (withProjWaste -> getCarton/getGrout), and the estimate wording
// is the REAL wasteNote/wasteMeta. Nothing here touches Supabase or signs in.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { normalizeSettings, withProjWaste, projWaste, getCarton, getGrout } from "../../src/catalog.js";
import { SegBar, WasteBar } from "../../src/widgets.jsx";
import { wasteNote, wasteMeta } from "../../src/model.js";
import { TIER_COLOR } from "../../src/uiconst.js";

const settings = normalizeSettings({ waste: { tile: 10, floor: 5 } });

const rows = [
  { id: "r1", type: "tile", name: "Carrara 12×24 — Bathroom floor", qtyType: "sqft", qty: "200", L: "12", W: "24", thickness: "0.375", cartonSf: "16", cartonUnit: "CT", cartonManual: "", priceSqft: "4.85",
    grout: { checked: true, product: "PermaColor Select", color: "Bright White", joint: 0.125, manual: "" }, mortar: { checked: false, product: "", manual: "" }, underlay: { checked: false }, attached: {} },
  { id: "r2", type: "hardwood", name: "White Oak 5\" — Great room", qtyType: "sqft", qty: "640", cartonSf: "23.5", cartonUnit: "CT", cartonManual: "", priceSqft: "7.20",
    grout: { checked: false }, mortar: { checked: false }, underlay: { checked: false }, attached: {} },
];

const n1 = (v) => (v == null ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }));

function Case({ title, note, children }) {
  return (
    <section className="mb-7">
      <h2 className="text-sm font-semibold mb-1">{title}</h2>
      {note && <p className="text-xs text-slate-500 mb-2">{note}</p>}
      {children}
    </section>
  );
}

// The header's column 1 at its real width, so the fit can be judged.
function HeaderCol({ w, onChange }) {
  return (
    <div className="rounded-lg border p-2.5" style={{ background: "var(--ft-band)", borderColor: "var(--ft-border)", width: 363 }}>
      <div className="flex flex-col gap-1.5" style={{ width: 341 }}>
        <SegBar value="retail" onChange={() => {}} inputValue="" onInput={() => {}}
          options={[
            { v: "retail", label: "Retail" }, { v: "builder", label: "Bldr", color: TIER_COLOR.builder.main },
            { v: "employee", label: "Emp", color: TIER_COLOR.employee.main }, { v: "sale", label: "Sale", color: TIER_COLOR.sale.main },
            { v: "custom", input: true, color: TIER_COLOR.custom.main },
          ]} />
        <div className="flex gap-1.5 min-w-0">
          <div className="flex-1 min-w-0">
            <SegBar value="full" onChange={() => {}}
              options={[{ v: "full", label: "All $" }, { v: "unit", label: "Unit $" }, { v: "none", label: "No $" }]} />
          </div>
          <WasteBar w={w} dflt={settings.waste} className="w-[134px]" onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

function Quantities({ w }) {
  const s = withProjWaste(settings, { waste: w });
  return (
    <table className="text-xs w-full max-w-xl">
      <thead>
        <tr className="text-left text-slate-500">
          <th className="font-medium py-1">Row</th><th className="font-medium">Measured</th>
          <th className="font-medium">Exact</th><th className="font-medium">Order</th><th className="font-medium">Grout</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => {
          const C = getCarton(p, s), G = getGrout(p, s);
          return (
            <tr key={p.id} className="border-t" style={{ borderColor: "var(--ft-row-line)" }}>
              <td className="py-1.5 pr-3">{p.name}</td>
              <td className="pr-3 tabular-nums">{p.qty} sf</td>
              <td className="pr-3 tabular-nums text-slate-500">{n1(C?.exact)}</td>
              <td className="pr-3 tabular-nums font-semibold">{C ? `${C.order} ${p.cartonUnit}` : "—"}</td>
              <td className="tabular-nums">{G ? `${G.order} ${G.unit}` : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Paperwork({ w }) {
  const note = wasteNote(w.tile || w.floor ? projWaste({ waste: w }, settings) : projWaste({ waste: w }, settings));
  const meta = wasteMeta(projWaste({ waste: w }, settings), "waste factor");
  return (
    <div className="rounded-lg border bg-white p-3 max-w-xl" style={{ borderColor: "var(--ft-border)" }}>
      <div className="text-[9px] uppercase tracking-widest text-slate-400">Estimate header meta</div>
      <div className="text-[12.5px] font-semibold mb-3">{["2 areas", meta].filter(Boolean).join("  ·  ") || <span className="text-slate-400">— nothing —</span>}</div>
      <div className="text-[9px] uppercase tracking-widest text-slate-400">Estimate disclaimer</div>
      <div className="text-[10.5px] text-slate-600">
        Quantities and prices are estimates{note ? `, incl. ${note}` : ""}. Confirm against product specs and final measurements before ordering.
      </div>
    </div>
  );
}

function Preview() {
  const [w, setW] = useState({ tile: 10, floor: 5, tileOn: false, floorOn: false });
  const patch = (p) => setW((prev) => ({ ...prev, ...p }));
  const legacy = projWaste({ name: "job from before the move" }, settings);
  return (
    <div className="min-h-screen p-8" style={{ background: "var(--ft-cream)", color: "var(--ft-text)" }}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-lg font-semibold mb-1">Waste moves onto the job</h1>
        <p className="text-xs text-slate-500 mb-6">
          Press a family to apply its waste; unlock the sliver to change the rate. The quantities and
          the estimate wording below are the real math and the real strings, recomputing live.
        </p>

        <Case title="The control, in the header column at its real width (341px)"
          note="Tier bar keeps the full row; printed pricing shares the bottom row with the toggles.">
          <HeaderCol w={w} onChange={patch} />
        </Case>

        <Case title="What the job orders" note="Both toggles off = raw measured footage, no overage.">
          <Quantities w={w} />
        </Case>

        <Case title="What the paperwork says" note="Only applied families are named; with both off the waste line disappears.">
          <Paperwork w={w} />
        </Case>

        <Case title="A project from before the move" note="No `waste` on the record — it keeps the shop rate with both families applied, so its quantities don't move.">
          <div className="text-xs text-slate-600">
            projWaste(oldJob) → tile <b>{legacy.tile}%</b>, flooring <b>{legacy.floor}%</b> — “{wasteNote(legacy)}”
          </div>
        </Case>
      </div>
    </div>
  );
}

const root = (window.__wasteRoot ||= createRoot(document.getElementById("root")));
root.render(<Preview />);
