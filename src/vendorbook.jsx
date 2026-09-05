// The vendor-kind book page (spec 2026-09-05): no items, no import, no Source
// tab — just the slots a configurator-priced vendor needs. Tabs and cards are
// the order book's (pricebooklib.jsx), so the two pages stay one idiom.
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { BookTab, FreightCard, BrandCard, ContactsCard } from "./pricebooklib.jsx";
import { normFreight } from "./freight.js";
import { normVendorMarkups } from "./vendorbook.js";
import { sellOf, UNFINISHED, VENT_STD, SHEET_NOTE } from "./sheoga.js";

const ENGINE_META = { sheoga: { app: "Sheoga configurator", sheets: SHEET_NOTE.replace(/^priced from /, "tables from ") } };

export function VendorBookPage({ book, updateBook, delBook, onDeleted, inp, lbl }) {
  const [name, setName] = useState(book.name);
  const [tab, setTab] = useState("markup");
  const [confirmDel, setConfirmDel] = useState(false);
  const m = normVendorMarkups(book.data?.markups);
  const fr = normFreight(book.data?.freight);
  const frSummary = fr.mode === "program" ? `on${fr.destination ? ` — ${fr.destination}` : ""}` : "none";
  const brSummary = (book.data?.brandLabel || "").trim() || "none";
  const rep = book.data?.rep || {}, sampleC = book.data?.sampleContact || {};
  const who = (c) => (c.name || "").trim() || (c.email || "").trim();
  const contactSummary = [who(rep), who(sampleC) && `samples: ${who(sampleC)}`].filter(Boolean).join(" · ") || "none";
  const meta = ENGINE_META[book.data?.engine] || { app: "a configurator", sheets: "" };
  const flip = (t) => setTab(tab === t ? null : t);
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input className="ft-field rounded-md border border-slate-200 px-2 py-1 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() !== book.name && updateBook(book.id, { name: name.trim() })} />
        <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-slate-100 text-slate-500">Vendor · no items</span>
        <span className="text-xs text-slate-400">Priced by the {meta.app}{meta.sheets ? ` · ${meta.sheets}` : ""}</span>
        <span className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-500">
            <input type="checkbox" checked={book.active} onChange={(e) => updateBook(book.id, { active: e.target.checked })} /> Active
          </label>
          <button onClick={() => setConfirmDel(true)} title="Delete this book" className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
        </span>
      </div>

      {confirmDel && (
        <div className="mt-2 flex items-center gap-2 flex-wrap rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs">
          <span className="text-red-600 flex-1">Delete "{book.name || "Untitled"}" for everyone? Its markups, contacts and freight go with it; the configurator falls back to the Settings markups. Sample requests keep their vendor name.</span>
          <button onClick={() => { delBook(book.id); onDeleted?.(); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete book</button>
          <button onClick={() => setConfirmDel(false)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
        </div>
      )}

      <div className="mt-2">
        <div className="flex items-end gap-1" style={{ borderBottom: "1px solid var(--ft-border)" }}>
          <BookTab label="Markup" summary={`flooring ${m.flooring}% · vents ${m.vents}%`} active={tab === "markup"} onClick={() => flip("markup")} />
          <BookTab label="Freight" summary={frSummary} active={tab === "freight"} onClick={() => flip("freight")} />
          <BookTab label="Brand" summary={brSummary} active={tab === "brand"} onClick={() => flip("brand")} />
          <BookTab label="Contacts" summary={contactSummary} active={tab === "contacts"} onClick={() => flip("contacts")} />
        </div>
        {tab && (
          <div className="rounded-b-md px-4 pb-3" style={{ border: "1px solid var(--ft-border)", borderTop: "none", background: "var(--ft-card)" }}>
            {tab === "markup" && <VendorMarkupCard book={book} onSave={(mk) => updateBook(book.id, { dataPatch: { markups: mk } })} inp={inp} lbl={lbl} />}
            {tab === "freight" && <FreightCard embedded book={book} onSave={(f) => updateBook(book.id, { dataPatch: { freight: f } })} inp={inp} lbl={lbl} />}
            {tab === "brand" && <BrandCard book={book} items={[]} onSave={(v) => updateBook(book.id, { dataPatch: { brandLabel: v } })} inp={inp} lbl={lbl} />}
            {tab === "contacts" && <ContactsCard book={book} onSave={(patch) => updateBook(book.id, { dataPatch: patch })} inp={inp} lbl={lbl} />}
          </div>
        )}
      </div>
    </div>
  );
}

// Two default markups over Sheoga's distributor cost, each with a worked
// example off the transcribed tables so the number reads as a price.
const EX_FLOOR = { label: 'White Oak Clear 5¼" solid', cost: UNFINISHED["White Oak"].clear[3] };
const EX_VENT = { label: "4×10 flush vent, group A", cost: VENT_STD.find((r) => r[0] === "4×10")[1] };
const fm = (n) => "$" + n.toFixed(2);

export function VendorMarkupCard({ book, onSave, inp, lbl }) {   // exported for the preview harness
  const saved = normVendorMarkups(book.data?.markups);
  const [form, setForm] = useState({ flooring: String(saved.flooring), vents: String(saved.vents) });
  const next = normVendorMarkups(form);
  const dirty = next.flooring !== saved.flooring || next.vents !== saved.vents;
  const field = (k, label, ex, per) => (
    <div>
      <label className={lbl}>{label}</label>
      <div className="flex items-center gap-2">
        <span className="text-slate-400">+</span>
        <input type="number" min="0" step="5" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className={`${inp} w-20 text-right`} />
        <span className="text-slate-500">%</span>
        <span className="text-[11px] text-slate-400 tabular-nums">{ex.label}: {fm(ex.cost)} → {fm(sellOf(ex.cost, next[k]))}{per}</span>
      </div>
    </div>
  );
  return (
    <div className="pt-3 max-w-xl">
      <p className="text-[11px] text-slate-400 mb-3">Applied over Sheoga's distributor cost when a configurator line is added, and adjustable per configuration in the popup. Future picks only — saved estimates keep their price.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("flooring", "Flooring & stocked prefinished", EX_FLOOR, " /sf")}
        {field("vents", "Wood vents & dampers", EX_VENT, "")}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button disabled={!dirty} onClick={() => onSave(next)} className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 text-xs font-semibold disabled:opacity-40">Save</button>
        {dirty && <button onClick={() => setForm({ flooring: String(saved.flooring), vents: String(saved.vents) })} className="text-xs text-slate-500 hover:text-slate-700">Reset</button>}
      </div>
    </div>
  );
}
