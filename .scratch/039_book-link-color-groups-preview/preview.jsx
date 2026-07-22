// Preview harness for the collection-first family-seed picker: the REAL
// SeriesSearch over miniature GLATI/TEC stock books, opening pre-filled with
// the grout's broken book name ("permacolor") the way the "New family from
// stock book…" button now seeds it. Picking the collection hands off to the
// REAL FamilyConfirm with the rule and name pre-derived — the whole
// Permacolor set arrives in one pick. Served by vite; never shipped.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { SeriesSearch } from "../../src/search.jsx";
import { FamilyConfirm } from "../../src/SettingsWorkspace.jsx";

const row = (sku, description, price) => ({ sku, description, price, unit: "EA", active: true, disabled: false, discontinued: false });

const GLATI = [
  row("PSC24", "PERMACOLOR SELECT COLOR KIT 24 NATURAL GREY", 21.75),
  row("PSC44", "PERMACOLOR SELECT COLOR KIT 44 BRIGHT WHITE", 21.75),
  row("PSC60", "PERMACOLOR SELECT COLOR KIT 60 DUSTY GREY", 21.75),
  row("PSC93", "PERMACOLOR SELECT COLOR KIT 93FOSSIL", 21.75), // the export's glued typo row
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
  row("SL-FULL", "0.8 GAL SPECTRALOCK PRO EPOXY GROUT FULL UNIT PART A&B", 210.0),
  row("SL-COMM", "3.2 GAL SPECTRALOCK PRO EPOXY GROUT COMMERCIAL UNIT PART A&B", 640.0),
  row("LAT85", "10.3 OZ LATASIL 85 ALMOND - 100% SILICONE CAULK", 12.25),
  row("LAT24", "10.3 OZ LATASIL 24 NATURAL GREY - 100% SILICONE CAULK", 12.25),
  row("LAT44", "10.3 OZ LATASIL 44 BRIGHT WHITE - 100% SILICONE CAULK", 12.25),
];
const TECBK = [
  row("TEC910", "10# Tec Power Grout - 910 Bright White", 18.0),
  row("TEC934", "10# Tec Power Grout - 934 Slate Gray/Del Gray", 18.0),
  row("TEC939", "10# Tec Power Grout - 939 Mist Gray", 18.0),
  row("TEC949", "10# Tec Power Grout - 949 Silverado", 18.0),
];

const bookStock = {
  glati: GLATI.map((it) => ({ ...it, bookId: "glati" })),
  tec: TECBK.map((it) => ({ ...it, bookId: "tec" })),
};
const books = [{ id: "glati", name: "GLATI" }, { id: "tec", name: "DOIT" }];
const bookName = (id) => books.find((b) => b.id === id)?.name || "book";
const bookItems = Object.values(bookStock).flat();

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";

function Preview() {
  const [seed, setSeed] = useState(null);
  const [saved, setSaved] = useState(null);
  return (
    <div className="min-h-screen p-8" style={{ background: "var(--ft-cream)" }}>
      <div className="bg-white rounded-2xl w-full max-w-xl p-5 border border-slate-200 mx-auto">
        <h3 className="ft-serif text-2xl mb-1">New color family</h3>
        <label className={lbl}>Pick a color collection — or a single row to seed one by hand</label>
        <SeriesSearch stock={bookItems} itemsByBook={bookStock} bookName={bookName} inp={inp}
          initialQuery="permacolor" placeholder='Search the stock books — "permacolor", "spectralock"…'
          onPickSeries={(s) => setSeed({ bookId: s.bookId, description: s.seedDescription, rule: s.rule, name: s.name })}
          onPickRow={(it) => setSeed({ bookId: it.bookId, description: it.description })} />
      </div>
      {seed && !saved && (
        <FamilyConfirm seed={seed} bookStock={bookStock} books={books} existingNames={[]} inp={inp} lbl={lbl}
          onSave={(fam) => setSaved(fam)} onClose={() => setSeed(null)} />
      )}
      {saved && (
        <div className="bg-white rounded-2xl w-full max-w-xl p-5 border border-slate-200 mx-auto mt-4 text-xs">
          <div className="font-medium mb-1">Saved family payload</div>
          <pre className="ft-mono whitespace-pre-wrap">{JSON.stringify(saved, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Preview />);
