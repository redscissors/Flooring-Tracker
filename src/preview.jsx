// Preview harness for vendor freight (ADR 0030): the REAL components — the
// book's freight card, the drawer row, the header switch, the order-entry
// panel's freight lines and the estimate paper's freight block — all driven by
// the REAL math (freight.js) off one mocked Glazzio book and one mocked job.
// No Supabase.
// Dev-only entry (preview.html); not part of the app build.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { FreightCard } from "./pricebooklib.jsx";
import { FreightMatRow, FreightColumn } from "./freightui.jsx";
import { OrderEntryPanel } from "./orderentry.jsx";
import { EstimatePaper } from "./EstimatePrint.jsx";
import { freightList, freightTotal, freightPrintRows, freightOrderRows } from "./freight.js";
import { printMatList, orderEntryRow, printAreaFloor } from "./print.js";
import { normalizeSettings } from "./catalog.js";
import { newProduct, newProject, money, areaLabel } from "./model.js";
import { tierView } from "./pricing.js";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";

// Glazzio's 2026 shipping program, read down the Ohio column.
const GLAZZIO_OHIO = {
  mode: "program", destination: "Ohio", effective: "2026", palletSf: 496,
  perSqft: 0.99, minCharge: 14.85, palletAt: 149, palletRate: 149,
  largeRate: 79, largeFormatIn: 15, perPiece: 0.33, pieceMin: 14.85,
};
const BOOK = { id: "glz", kind: "order", name: "Glazzio Tiles", active: true, data: { markups: { default: 45 }, freight: GLAZZIO_OHIO } };
const settings = normalizeSettings();

const row = (over) => ({ ...newProduct(), bookId: "glz", ...over });
const JOB = {
  ...newProject(null, "Weaver — kitchen & bath"), _full: true,
  categories: [{
    id: "a1", name: "Kitchen", note: "", products: [
      row({ L: "12", W: "24", qty: "620", priceSqft: "8.40", costSqft: "5.80", brandColor: "Sunset Glass — Alabaster", cartonSf: "15.5" }),
      row({ L: "12", W: "12", qty: "84", priceSqft: "22.40", costSqft: "15.45", brandColor: "Harmonic Mosaic — Pearl" }),
      row({ type: "misc", qtyType: "count", qty: "24", priceSqft: "18.00", costSqft: "12.40", brandColor: "Sunset chair rail", sizeText: '2" × 12"' }),
    ],
  }],
};

const linesFor = (job) => freightList(job, settings, [BOOK]);

function Case({ label, shot, children }) {
  return (
    <div data-shot={shot}>
      <p className="ft-eyebrow text-[10px] mb-1">{label}</p>
      {children}
    </div>
  );
}

function DrawerCase() {
  const [job, setJob] = useState(JOB);
  const products = job.categories[0].products;
  const setRow = (i, patch) => setJob((j) => ({
    ...j, categories: [{ ...j.categories[0], products: j.categories[0].products.map((p, n) => (n === i ? { ...p, ...patch } : p)) }],
  }));
  const lines = linesFor(job);
  const line = lines.find((l) => l.bookId === BOOK.id);
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1.5 shrink-0" style={{ width: 108 }}>
          <div className="ft-hcol flex-1">
            <div className="ft-hhead">Estimate shows</div>
            <button className="ft-hopt on bg-indigo-600">All prices</button>
            <button className="ft-hopt">Unit only</button>
            <button className="ft-hopt">No prices</button>
          </div>
          <FreightColumn on={job.freight !== false} amount={`$${Math.round(freightTotal(lines)).toLocaleString()}`} onSet={(v) => setJob((j) => ({ ...j, freight: v }))} />
        </div>
        <div className="text-[12px] text-slate-500 max-w-xs self-center">
          Freight sits under “Estimate shows” in the same column, as its own card with its own heading — one button, carrying the job’s total. Press it and every row below goes quiet.
        </div>
      </div>
      <div className="ft-mats rounded-lg border border-slate-200 max-w-2xl overflow-hidden" style={{ background: "var(--ft-cream)" }}>
        {products.map((p, i) => (
          <FreightMatRow key={p.id} book={BOOK} on={p.freight !== "off"} jobOff={job.freight === false} line={line}
            accent="var(--ft-brand)" rowTint="var(--ft-tint)" onToggle={() => setRow(i, { freight: p.freight === "off" ? "" : "off" })} />
        ))}
      </div>
      <p className="text-[12px] text-slate-500 max-w-2xl">
        Three rows, one charge: {line ? `${money(line.cost)}` : "none"}. Unchecking a row drops its footage out of the vendor’s pallet/minimum math — which is why every row shows the JOB’s number, not a share of it.
      </p>
    </div>
  );
}

function CardCase() {
  const [freight, setFreight] = useState(GLAZZIO_OHIO);
  return <FreightCard book={{ ...BOOK, data: { ...BOOK.data, freight } }} onSave={setFreight} inp={inp} lbl={lbl} />;
}

function Harness() {
  const lines = linesFor(JOB);
  const freightCost = freightTotal(lines);
  const tv = tierView(JOB, settings);
  const pMats = [...printMatList(JOB, settings), ...freightPrintRows(lines)];
  const special = [
    ...JOB.categories[0].products.map((p) => orderEntryRow(p, settings, areaLabel(JOB.categories[0], 0), 30, new Set())).filter((r) => r.special),
    ...lines.flatMap((l) => freightOrderRows(l, 30)),
  ];
  // The same line math the app runs, so the paper's lines and its total agree
  // (a carton-sold row bills its ordered cartons, not its measured footage).
  const flooringPrice = printAreaFloor(JOB.categories[0], settings);
  // The order-entry panel is a fixed overlay; it gets its own screenshot pass.
  const panel = typeof location !== "undefined" && location.hash === "#order";
  return (
    <div className="min-h-screen p-8" style={{ background: "var(--ft-cream)", color: "var(--ft-text)" }}>
      <div className="max-w-5xl space-y-8">
        <div>
          <h1 className="ft-serif" style={{ fontSize: 24 }}>Vendor freight — Glazzio, Ohio</h1>
          <p className="text-[12.5px] text-slate-500 mt-1">
            620 sf of 12×24 (large format, {money(79)}/pallet over 496 sf/pallet) · 84 sf of mosaic (small format, $0.99/sf) · 24 chair-rail pieces ($0.33 each, $14.85 minimum).
            Every number below is computed by <span className="ft-mono">freight.js</span>, not typed into this page.
          </p>
        </div>

        <Case shot="drawer" label="header master + the drawer row on each product (live — press them)"><DrawerCase /></Case>

        <Case shot="card" label="price book → the book's freight program (live — edit a rate and the worked example moves)"><CardCase /></Case>

        <Case shot="print" label="printed estimate — freight as its own group in the extras band">
          <div className="ft-light bg-white text-black rounded-sm shadow-lg" style={{ padding: 30 }}>
            <EstimatePaper sel={JOB} people={[]} profile={{ name: "Sam Weaver", phone: "", email: "" }} tv={tv}
              jobWaste={{ tile: 10, floor: 5 }} pMats={pMats} tSet={settings}
              materialsCost={0} freightCost={freightCost} flooringPrice={flooringPrice} miscCost={0}
              totalSqft={704} orderedSqft={766} grandTotal={flooringPrice + freightCost} />
          </div>
        </Case>

        {/* Fixed overlay — visit #order to shoot it on its own. */}
        {panel && <OrderEntryPanel name={JOB.name} special={special} stock={[]} descLimit={30} onClose={() => {}} />}
      </div>
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
