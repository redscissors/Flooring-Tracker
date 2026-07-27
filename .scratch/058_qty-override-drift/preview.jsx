// Preview harness for the quantity-override drift chip (2026-07-27).
// Renders the REAL QtyDriftChip / QtyDriftNote from App.jsx over the REAL
// qtyDrift + getGrout / getCarton math — the auto figure each chip offers is
// computed the way the app computes it (the same getter re-run with the
// override lifted), not typed in here. Served by the vite dev server; never
// shipped (lives in .scratch).
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QtyDriftChip, QtyDriftNote } from "../../src/App.jsx";
import { normalizeSettings, qtyDrift, getGrout, getCarton } from "../../src/catalog.js";
import { newProduct } from "../../src/model.js";
import "../../src/index.css";

const s = normalizeSettings();
const GROUT = Object.keys(s.grouts)[0];

// A 12×24 tile row, grouted, sold 15.5 sf to the carton.
const tile = (over = {}) => ({
  ...newProduct(), type: "tile", sku: "ANA-1224", brandColor: "Anatolia Marlow Fog",
  L: "12", W: "24", thickness: "0.375", cartonSf: "15.5", priceSqft: "6.50", qtyType: "sqft",
  grout: { ...newProduct().grout, checked: true, product: GROUT, color: "Haystack", joint: "0.125" },
  ...over,
});

const groutAuto = (p) => getGrout({ ...p, grout: { ...p.grout, manual: "" } }, s)?.order;
const cartonAuto = (p) => getCarton({ ...p, cartonManual: "" }, s)?.order;

// The reported sequence: quote 240 sf, nudge a quantity, then the field measure
// comes back at 415 sf. Everything below is what the row shows at that moment.
const AFTER_MEASURE = "415";

function Case({ title, story, children }) {
  return (
    <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4" style={{ maxWidth: 760 }}>
      <div className="ft-eyebrow text-[10px] tracking-[.12em] text-slate-500">{title}</div>
      <div className="text-[12px] text-slate-500 mb-2.5">{story}</div>
      {children}
    </div>
  );
}

// The materials row's own shell, so the note sits where it really sits.
function MatRow({ label, order, unit, children }) {
  return (
    <div className="px-2.5 py-1.5 rounded" style={{ background: "var(--ft-prod)" }}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="ml-auto flex items-center gap-1 text-sm shrink-0">
          <input readOnly type="number" value={order}
            className="!w-12 text-right font-semibold rounded border border-slate-200 px-1 py-0.5 ft-field" />
          <span className="font-semibold">{unit}</span>
        </span>
        {children}
      </div>
    </div>
  );
}

function Demo() {
  // Live: clicking "Use N" clears the override, exactly as the app's handler does.
  const [gManual, setGManual] = useState("9");
  const [cManual, setCManual] = useState("17");

  const gRow = tile({ qty: AFTER_MEASURE, grout: { ...tile().grout, manual: gManual } });
  const cRow = tile({ qty: AFTER_MEASURE, cartonManual: cManual });
  const gDrift = gManual === "" ? null : qtyDrift(gManual, groutAuto(gRow));
  const cDrift = cManual === "" ? null : qtyDrift(cManual, cartonAuto(cRow));
  const gShown = getGrout(gRow, s), cShown = getCarton(cRow, s);
  const gUnit = gShown?.unit || "units";

  return (
    <div className="p-6" style={{ background: "var(--ft-paper, #faf8f4)" }}>
      <h1 className="ft-serif text-2xl mb-1">A typed quantity that the square footage has outgrown</h1>
      <p className="text-[13px] text-slate-500 mb-5" style={{ maxWidth: 760 }}>
        Quoted at 240 sq ft, a quantity gets nudged — one click of the carton ▲ is enough — and the field measure then
        comes back at <b>415 sq ft</b>. The typed number is a decision, so it still stands; the row just says so and
        offers the fresh figure. <b>The buttons work</b>: clicking one clears the override, and the row goes back to
        calculating.
      </p>

      <Case title="Carton count — in the row's chip strip"
        story="Sits beside the price-book drift chip, the same shape as “Price book now $X — Use new price”.">
        <div className="ft-noprint flex items-center gap-2 text-xs flex-wrap" style={{ padding: "2px 12px 4px 26px" }}>
          {cDrift
            ? <QtyDriftChip d={cDrift} unit={(cShown?.unit || "ct").toUpperCase()} what="row" onUse={() => setCManual("")} />
            : <span className="text-slate-400">No chip — the row is calculating {cShown?.order} CT from the square footage.</span>}
        </div>
        <div className="mt-1 text-[11px] text-slate-400">
          Line total follows the count: {cShown ? `${cShown.order} CT × 15.5 sf × $6.50 = $${(cShown.order * cShown.sf * 6.5).toFixed(2)}` : "—"}
        </div>
      </Case>

      <Case title="Grout — a full-width note under the materials row"
        story="The materials rows have no chip strip, so the same chip gets its own line beneath the controls.">
        <MatRow label="Grout" order={gShown ? gShown.order : ""} unit={gUnit}>
          {gDrift && <QtyDriftNote d={gDrift} unit={gUnit} onUse={() => setGManual("")} />}
        </MatRow>
      </Case>

      <Case title="Agreement is silent"
        story="No override, or a typed number the math agrees with — nothing renders at all.">
        <div className="text-[12px] ft-mono text-slate-500">
          qtyDrift("", 12) → {String(qtyDrift("", 12))}<br />
          qtyDrift("12", 12) → {String(qtyDrift("12", 12))}<br />
          qtyDrift("12", 0) → {String(qtyDrift("12", 0))} <span className="text-slate-400">// footage cleared — “calculates to 0” is noise, not news</span>
        </div>
      </Case>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Demo />);
