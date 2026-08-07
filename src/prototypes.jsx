// Prototype board: three compact layouts for the TOP of the price-book detail
// page (issue: the name/source/markup/freight stack burns ~650px before the
// items table starts, with the right half of a wide screen empty). Static
// mockups with just enough state to demo the fold/unfold — not wired to data.
// Patterns cribbed from Mobbin: Better Stack's one-line title + action strip,
// Workable's collapsed summary-rows-that-expand, Linear's title + properties.
// Dev-only entry (prototypes.html); not part of the app build.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ChevronDown, ChevronRight, Eye, FileText, Pencil, Percent, Plus, RotateCcw, Trash2, Truck, Upload } from "lucide-react";

// --- the mock book (matches the owner's screenshot) ---------------------------
const B = {
  name: "Home Collection",
  kind: "SPECIAL ORDER",
  items: 562,
  imported: "7/16/2026",
  by: "Marcus",
  sheet: "Home Collection EFT 26 02 19.xls",
  portal: "Virginia Tile connect24 · C28895MM",
  markup: { default: 50, groupBy: "Manufacturer", groups: [["VTC", 467], ["CTI", 95]] },
};

const chip = "text-[9px] uppercase tracking-wide rounded px-1.5 py-0.5";
const btn = "flex items-center gap-1.5 text-xs rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 py-1 text-slate-600";

// A stand-in for the items table so each variant shows how soon rows start.
function FakeTable() {
  return (
    <div className="mt-2 border border-slate-100 rounded-lg overflow-hidden">
      <div className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-400 px-2 py-1 flex gap-8">
        <span className="w-20">Size / Type</span><span className="flex-1">Product / Color</span><span className="w-24">SKU</span>
        <span className="w-16 text-right">Cov.</span><span className="w-12">U/M</span><span className="w-14 text-right">Cost</span><span className="w-20 text-right">Price</span>
      </div>
      {[
        ["12×24", "tile", "Aniston Silver 12X24 Polished", "HC1224AS", "15.5 SF/CT", "SF→CT", "$3.19", "$4.79/sf"],
        ["3×12", "trim", "Bullnose 3X12 Silver", "HCBN312", "—", "PC→CT", "$27.99", "$41.99/ct"],
      ].map(([size, type, name, sku, cov, um, cost, price]) => (
        <div key={sku} className="border-t border-slate-100 px-2 py-1 flex gap-8 text-[11px] items-center">
          <span className="w-20"><span className="block text-[8.5px] uppercase text-slate-400">{type}</span>{size}</span>
          <span className="flex-1">{name}</span><span className="w-24 font-mono text-[10px]">{sku}</span>
          <span className="w-16 text-right tabular-nums">{cov}</span><span className="w-12 text-[10px]">{um}</span>
          <span className="w-14 text-right tabular-nums text-[10px]">{cost}</span><span className="w-20 text-right tabular-nums">{price}</span>
        </div>
      ))}
    </div>
  );
}

// The one-line title row all three variants share: back · name · badge · counts
// · right-aligned actions. Delete retreats into the ⋯ the real page would get.
function TitleRow({ dense }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button className="text-slate-400 hover:text-slate-600 text-xs">‹ All books</button>
      <input className="ft-field rounded-md border border-transparent hover:border-slate-200 px-1.5 py-0.5 text-[15px] font-medium focus:outline-none w-44" defaultValue={B.name} />
      <span className={`${chip} bg-slate-100 text-slate-500`}>{B.kind}</span>
      <span className="text-[11px] text-slate-400">{B.items} active · imported {B.imported} by {B.by}</span>
      <span className="ml-auto flex items-center gap-1.5">
        {!dense && <label className="flex items-center gap-1 text-[11px] text-slate-500"><input type="checkbox" defaultChecked /> Active</label>}
        <button className={btn}><Upload size={12} /> Import…</button>
        <button className={btn}><Plus size={12} /> Add a file…</button>
        <button className="text-slate-400 hover:text-slate-600 px-1" title="Active · Delete · Flag stale after · Hide costs">⋯</button>
      </span>
    </div>
  );
}

// One collapsed config row (Workable pattern): icon · label · live summary ·
// chevron. Expanding swaps in today's full editor, unchanged.
function FoldRow({ icon, label, summary, warn, open0 = false, children }) {
  const [open, setOpen] = useState(open0);
  return (
    <div className="border border-slate-100 rounded-md bg-white">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left">
        {icon}
        <span className="text-[11.5px] font-medium text-slate-600">{label}</span>
        <span className={`text-[11px] ${warn ? "text-amber-600" : "text-slate-400"}`}>{summary}</span>
        <span className="ml-auto text-slate-300">{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
      </button>
      {open && <div className="px-3 pb-2.5 text-[11px] text-slate-500 border-t border-slate-50 pt-2">{children}</div>}
    </div>
  );
}

const markupSummary = `${B.markup.default}% default · by ${B.markup.groupBy} · no overrides`;
const MarkupBody = () => (
  <div className="flex items-end gap-6 flex-wrap">
    <label className="block"><span className="ft-eyebrow text-[9px] block mb-0.5">Default %</span><input className="ft-field border border-slate-200 rounded px-2 py-1 w-20" defaultValue="50" /></label>
    <label className="block"><span className="ft-eyebrow text-[9px] block mb-0.5">Trim %</span><input className="ft-field border border-slate-200 rounded px-2 py-1 w-20" placeholder="50" /></label>
    <label className="block"><span className="ft-eyebrow text-[9px] block mb-0.5">Group by</span><select className="ft-field border border-slate-200 rounded px-2 py-1"><option>Manufacturer</option></select></label>
    {B.markup.groups.map(([g, n]) => (
      <label key={g} className="block"><span className="ft-eyebrow text-[9px] block mb-0.5">{g} <span className="text-slate-300">({n})</span></span><input className="ft-field border border-slate-200 rounded px-2 py-1 w-16" placeholder="50" /></label>
    ))}
    <span className="text-[10px] text-slate-400 pb-1.5">$10 cost → $15.00 sell</span>
  </div>
);

// --- Variant A: one bar + source pill + fold rows -----------------------------
function VariantA() {
  return (
    <div className="rounded-lg p-3" style={{ background: "var(--ft-card)", border: "1px solid var(--ft-border)" }}>
      <TitleRow />
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {/* the source sheet folded into one slim pill; "added by hand" is a
            link only when the book actually declares one */}
        <span className="flex items-center gap-1.5 rounded-full border border-slate-200 pl-2 pr-1 py-0.5 text-[11px] text-slate-500">
          <FileText size={11} className="text-slate-400" />
          {B.sheet} <span className="text-slate-300">· {B.portal} · {B.imported}</span>
          <button className="flex items-center gap-1 rounded-full bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600"><RotateCcw size={9} /> Refresh</button>
        </span>
        <button className="text-[11px] text-slate-400 hover:text-slate-600">+ needs a hand-added file?</button>
      </div>
      <div className="grid gap-1.5 mt-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* #a-open pre-expands Markup for the screenshot pass */}
        <FoldRow icon={<Percent size={12} className="text-slate-400" />} label="Markup" summary={markupSummary} open0={typeof location !== "undefined" && location.hash === "#a-open"}><MarkupBody /></FoldRow>
        <FoldRow icon={<Truck size={12} className="text-slate-400" />} label="Freight" summary="none — no freight chip on jobs" warn>Freight program editor unchanged, revealed here.</FoldRow>
      </div>
      <FakeTable />
    </div>
  );
}

// --- Variant B: stat strip (Better Stack) -------------------------------------
function Stat({ k, v, warn, action }) {
  return (
    <button className="text-left px-3 py-1 hover:bg-slate-50 rounded" title={action}>
      <span className="ft-eyebrow text-[8.5px] block">{k}</span>
      <span className={`text-[11.5px] ${warn ? "text-amber-600" : "text-slate-600"}`}>{v} {action && <Pencil size={9} className="inline text-slate-300" />}</span>
    </button>
  );
}
function VariantB() {
  return (
    <div className="rounded-lg p-3" style={{ background: "var(--ft-card)", border: "1px solid var(--ft-border)" }}>
      <TitleRow dense />
      {/* everything below the title is ONE strip of stats; markup / freight /
          source expand a popover (not shown) when clicked */}
      <div className="flex items-stretch gap-1 mt-1.5 -mx-1 border-y border-slate-100 divide-x divide-slate-100">
        <Stat k="Source" v={`connect24 · ${B.imported}`} action="Refresh / manage files" />
        <Stat k="Markup" v="50% · by Manufacturer" action="Edit" />
        <Stat k="Trim %" v="default" action="Edit" />
        <Stat k="Freight" v="none" warn action="Edit" />
        <Stat k="Flagged" v="6 open" action="Review" />
        <Stat k="Disabled" v="1" action="Show" />
        <Stat k="Claude bucket" v="2" action="Open" />
      </div>
      <FakeTable />
    </div>
  );
}

// --- Variant C: table-first + right config rail -------------------------------
function VariantC() {
  return (
    <div className="rounded-lg p-3" style={{ background: "var(--ft-card)", border: "1px solid var(--ft-border)" }}>
      <TitleRow />
      <div className="flex gap-3 mt-2 items-start">
        <div className="flex-1 min-w-0">
          <FakeTable />
        </div>
        {/* the config that used to sit ABOVE the table stacks in a rail on the
            empty right half of the screen; table starts immediately */}
        <div className="w-64 shrink-0 space-y-1.5">
          <div className="border border-slate-100 rounded-md p-2">
            <span className="ft-eyebrow text-[8.5px] block mb-1">Source</span>
            <div className="text-[10.5px] text-slate-500 leading-snug">{B.sheet}<br /><span className="text-slate-400">{B.portal} · {B.imported}</span></div>
            <button className={`${btn} mt-1.5 text-[10px] px-2 py-0.5`}><RotateCcw size={10} /> Refresh</button>
          </div>
          <div className="border border-slate-100 rounded-md p-2">
            <span className="ft-eyebrow text-[8.5px] block mb-1">Markup</span>
            <div className="text-[10.5px] text-slate-500">{markupSummary} <button className="text-slate-400 hover:text-slate-600"><Pencil size={9} className="inline" /></button></div>
          </div>
          <div className="border border-slate-100 rounded-md p-2">
            <span className="ft-eyebrow text-[8.5px] block mb-1">Freight</span>
            <div className="text-[10.5px] text-amber-600">none — no freight chip on jobs <button className="text-slate-400"><Pencil size={9} className="inline" /></button></div>
          </div>
          <div className="border border-slate-100 rounded-md p-2">
            <span className="ft-eyebrow text-[8.5px] block mb-1">Import history</span>
            <div className="text-[10.5px] text-slate-500">7/16 by Marcus · 562 items<br />6/02 by Marcus · 559 items</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Board() {
  return (
    <div className="min-h-screen p-8" style={{ background: "var(--ft-cream)", color: "var(--ft-text)" }}>
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="ft-serif" style={{ fontSize: 24 }}>Price book header — three compact prototypes</h1>
          <p className="text-[12.5px] text-slate-500 mt-1 max-w-3xl">
            Today the name / source / markup / freight stack spends ~650px before the first item row. All three fold the page
            chrome (stale threshold, hide costs, delete) into ⋯ and put Import beside the title.
          </p>
        </div>
        <div data-shot="a">
          <p className="ft-eyebrow text-[10px] mb-1">A — fold rows: markup &amp; freight collapse to one-line summaries (click to expand)</p>
          <VariantA />
        </div>
        <div data-shot="b">
          <p className="ft-eyebrow text-[10px] mb-1">B — stat strip: the whole config reads as one row of stats, each opening a popover</p>
          <VariantB />
        </div>
        <div data-shot="c">
          <p className="ft-eyebrow text-[10px] mb-1">C — table first: config moves to a right rail on the screen's empty half</p>
          <VariantC />
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("prototypes")).render(<Board />);
