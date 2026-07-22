// Faithful repro of the Settings famSeed flow: the REAL Modal wrapping the
// REAL SeriesSearch, hand-off to the REAL FamilyConfirm — the exact state
// machine SettingsWorkspace runs, to chase the "picked the collection and no
// confirm appeared" report. Served by vite; never shipped.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { Modal } from "../../src/widgets.jsx";
import { SeriesSearch } from "../../src/search.jsx";
import { FamilyConfirm } from "../../src/SettingsWorkspace.jsx";

const row = (sku, description, price) => ({ sku, description, price, unit: "EA", active: true, disabled: false, discontinued: false });
const GLATI = [
  row("PSC24", "PERMACOLOR SELECT COLOR KIT 24 NATURAL GREY", 21.75),
  row("PSC44", "PERMACOLOR SELECT COLOR KIT 44 BRIGHT WHITE", 21.75),
  row("PSC60", "PERMACOLOR SELECT COLOR KIT 60 DUSTY GREY", 21.75),
  row("PSC93", "PERMACOLOR SELECT COLOR KIT 93FOSSIL", 21.75),
  row("PSC52", "PERMACOLOR SELECT COLOR KIT 52TOASTED ALMOND", 21.75),
  row("PSC35", "PERMACOLOR SELECT COLOR KIT 35 MOCHA", 21.75),
  row("PSC22", "PERMACOLOR SELECT COLOR KIT 22 MIDNIGHT BLACK", 21.75),
  row("PSC39", "PERMACOLOR SELECT COLOR KIT 39 MUSHROOM", 21.75),
  row("PSB-S", "25LB PERMACOLOR SELECT BASE SANDED", 27.5),
  row("PSB-NS", "PERMACOLOR SELECT NS BASE UNSANDED", 31.0),
  row("PC85", "9LB SPECTRALOCK PRO 85 ALMOND PART C", 42.5),
  row("PC24", "9LB SPECTRALOCK PRO 24 NATURAL GREY PART C", 42.5),
  row("PC53", "9LB SPECTRALOCK PRO 53 TWILIGHT BLUE PART C", 44.0),
  row("PC-CLR", "9LB SPECTRALOCK PRO CLEAR PART C", 40.0),
  row("1518983", "0.8 GAL SPECTRALOCK PRO EPOXY GROUT FULL UNIT PART A&B", 132.99),
  row("1518984", "3.2 GAL SPECTRALOCK PRO EPOXY GROUT COMMERCIAL UNIT PART A&B", 374.99),
];
// CEG-Lite, verbatim from the real OHIVA export (field file 2026-07-22): the
// only shared lead-in is "Custom", the real frame is the SUFFIX, unrelated
// Custom rows sit beside the colorants, and one row glues "Custom165".
const OHIVA = [
  row("1516863", "Custom 545 Bleached Wood Part A - Ceg-Lite Colorant", 33.29),
  row("28865", "1G Custom CEG-Lite Part B Base - Epoxy Grout Need Part A", 97.64),
  row("93774", "Custom 642 Ash Part A - Ceg-Lite Colorant", 33.29),
  row("93776", "Custom 10 Antique White Part A - Ceg-Lite Colorant", 33.29),
  row("93778", "Custom 544 Rolling Fog Part A - Ceg-Lite Colorant", 33.29),
  row("93784", "Custom165 Delorean Gray Part A - Ceg-Lite Colorant", 33.29),
  row("93798", "Custom 60 Charcoal Part A - Ceg-Lite Colorant", 33.29),
  row("29193", "Custom MBP Bonding Primer - CUSCPMBP1", 45.0),
  row("29505", "Custom Redgard Uncoupling Mat - 322 SF per Roll", 610.0),
];
const bookStock = { glati: GLATI.map((it) => ({ ...it, bookId: "glati" })), ohiva: OHIVA.map((it) => ({ ...it, bookId: "ohiva" })) };
const books = [{ id: "glati", name: "GLATI" }, { id: "ohiva", name: "OHIVA" }];
const bookName = (id) => books.find((b) => b.id === id)?.name || "book";
const bookItems = Object.values(bookStock).flat();

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";

function Repro() {
  const [famSeed, setFamSeed] = useState(null);
  const [saved, setSaved] = useState(null);
  const [log, setLog] = useState([]);
  const note = (m) => setLog((l) => [...l, m]);
  return (
    <div className="min-h-screen p-8" style={{ background: "var(--ft-cream)" }}>
      {/* the exact failing seed from the field report: the retired workbook's
          family name carries "Laticrete", which no ERP description prints */}
      <button id="open" onClick={() => { setFamSeed({ pick: true, query: "Laticrete Permacolor Color Kit", forProduct: { coId: "co1", gId: "g1" } }); note("opened pick modal"); }}
        className="text-xs text-indigo-600 font-medium">New family from stock book…</button>
      <div id="log" className="mt-4 text-xs ft-mono whitespace-pre-wrap">{log.join("\n")}</div>
      {saved && <div id="saved" className="text-xs mt-2">SAVED: {saved.name} · {saved.cache.length} colors</div>}
      {famSeed?.pick && (
        <Modal title="New color family" onClose={() => { setFamSeed(null); note("pick modal onClose fired"); }}>
          <label className={lbl}>Pick a color collection — or a single row to seed one by hand</label>
          <SeriesSearch stock={bookItems} itemsByBook={bookStock} bookName={bookName} inp={inp}
            initialQuery={famSeed.query || ""} placeholder='Search the stock books — "permacolor", "spectralock"…'
            onPickSeries={(s) => { setFamSeed({ bookId: s.bookId, description: s.seedDescription, rule: s.rule, name: s.name, forProduct: famSeed.forProduct }); note("picked series " + s.name); }}
            onPickRow={(it) => { setFamSeed({ bookId: it.bookId, description: it.description, forProduct: famSeed.forProduct }); note("picked row " + it.sku); }} />
        </Modal>
      )}
      {famSeed?.description && (
        <FamilyConfirm seed={famSeed} bookStock={bookStock} books={books} existingNames={[]} inp={inp} lbl={lbl}
          onClose={() => { setFamSeed(null); note("FamilyConfirm onClose fired"); }}
          onSave={(fam) => { setSaved(fam); setFamSeed(null); note("saved family " + fam.name); }} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Repro />);
