// Preview proof (2026-07-26): the price popup's markup buttons come from
// Settings → Price book. Both halves of this page are the REAL components over
// ONE settings object — the top is `PriceBookLibrary`'s landing header (where
// the new Quick markups card lives), the bottom is the real `GridPriceCell`.
// Editing the card re-renders the popup, so the screenshots are the actual
// wiring, not two mockups that agree by hand.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PriceBookLibrary } from "../../src/pricebooklib.jsx";
import { GridPriceCell, GRID_COLS } from "../../src/grid.jsx";
import { normalizeSettings, normPricing, num } from "../../src/catalog.js";
import { lineTotal } from "../../src/print.js";
import { newProduct, money } from "../../src/model.js";
import { TYPES, TLBL } from "../../src/uiconst.js";
import "../../src/index.css";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const lbl = "block text-[11px] font-semibold text-slate-500 mb-1";
const noop = () => {};
const never = () => Promise.resolve([]);

function Proof() {
  // One settings object, exactly as the app holds it: setSettings merges a
  // patch, normalizeSettings is what boot does to it.
  const [settings, setSettings] = useState(() => normalizeSettings());
  const patch = (p) => setSettings((s) => normalizeSettings({ ...s, ...p }));
  const markups = normPricing(settings.pricing).quickMarkups;

  const [p, setP] = useState(() => ({ ...newProduct(), type: "tile", L: "12", W: "24", brandColor: "Emser Fixture Matte Grey", qty: "180", priceSqft: "", costSqft: "", markupPct: "" }));
  const line = lineTotal(p, null, null, num(p.priceSqft));

  return (
    <>
      <h2>1 · Settings → Price book — the real library header, with the new card</h2>
      <p className="note">The card sits beside Price tiers and Sheoga markup, where the other percentages already live. Each chip is a number; × removes it, + Add appends one, six is the ceiling the popup&apos;s button row can show.</p>
      <div className="panel">
        <PriceBookLibrary
          books={[]} addBook={noop} updateBook={noop} delBook={noop}
          loadBookItems={never} applyBookImport={noop} loadBookVersions={never}
          loadBookVersionSnapshot={never} pinBookVersion={noop} updateBookItem={noop}
          setBookItemsDisabled={noop} reviewBookItemFlags={noop}
          settings={settings} setSettings={patch}
          inp={inp} lbl={lbl} types={TYPES} typeLabels={TLBL} />
      </div>

      <h2>2 · The same list, driving the real price-cell popup</h2>
      <p className="note">Nothing is passed by hand between the two — the popup reads <code>settings.pricing.quickMarkups</code> through the same <code>normPricing</code> the app uses. A list the shop edits above is the row of buttons below on the next render.</p>
      <div className="card">
        <div className="rowframe" style={{ display: "grid", gridTemplateColumns: GRID_COLS, fontSize: 11, fontWeight: 600 }}>
          <div className="gc">{p.L}×{p.W}</div>
          <div className="gc">{p.brandColor}</div>
          <div className="gc mono" />
          <div className="gc mono r">—</div>
          <div className="gc r">{p.qty}</div>
          <div className="gc" data-testid="price">
            <GridPriceCell p={p} tier="retail" tierPrice={null} noCost={false} unit="sf" tabIndex={0}
              markups={markups} onPatch={(x) => setP((cur) => ({ ...cur, ...x }))} title="Price per sq ft" />
          </div>
          <div className="gc r">{p.qty} sf</div>
          <div className="gc r b">{line > 0 ? money(line) : "—"}</div>
          <div className="gc" />
        </div>
        <div className="stored">
          buttons from settings → <code>[{markups.join(", ")}]</code> · stored on the row → <code>priceSqft {p.priceSqft || '""'}</code> · <code>costSqft {p.costSqft || '""'}</code> · <code>markupPct {p.markupPct || '""'}</code>
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(<Proof />);
