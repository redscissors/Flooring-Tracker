// MOCKUP ONLY (2026-10-02) — proposed "Trim & accessories" tab for the Sheoga
// configurator + the Sheoga book's Markup / Price sheets tabs. Throwaway: the
// rail primitives below are copied from SheogaConfigurator.jsx so the look
// matches; nothing here is product code. ?view=book shows the book page.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { X, Plus, Upload, Download, FileSpreadsheet, Check, Link2, Unlink } from "lucide-react";
import "../../../src/index.css";
import { HelpTip, PriceLevelMenu, BasketButton, MorphSelect } from "../../../src/widgets.jsx";
import { BookTab } from "../../../src/pricebooklib.jsx";

// --- the 10/01/2026 accessory sheet, as the import would read it -------------
const SPECIES = ["Beech", "Cherry", "Maple", "Hickory", "Red Oak", "White Oak", "Walnut", "Q/R White Oak"];
const PROFILES = [
  { id: "nose35", name: 'Rabbeted nosing 3½"', short: 'Nosing 3½"', unit: "lf", prefin: 2.40, note: "lengths subject to inventory",
    p: [3.96, 3.97, 4.30, 4.51, 3.61, 5.86, 7.04, 7.62] },
  { id: "nose55", name: 'Rabbeted nosing 5½"', short: 'Nosing 5½"', unit: "lf", prefin: 3.75, note: "lengths subject to inventory",
    p: [5.98, 6.43, 6.89, 6.79, 5.43, 9.47, 11.36, 12.31] },
  { id: "shoe", name: 'Shoe mold ½" × ¾"', short: "Shoe mold", unit: "lf", prefin: 1.85, p: [0.83, 0.98, 1.07, 0.95, 0.75, 1.36, 1.63, 1.76] },
  { id: "reducer", name: 'Reducer ¾" × 2½"', short: "Reducer", unit: "pc", len: 8, prefin: 1.85, note: "8' lengths only", p: [1.84, 2.21, 2.39, 2.09, 1.67, 3.03, 3.63, 3.94] },
  { id: "tmold", name: 'T-mold ¾" × 2½"', short: "T-mold", unit: "pc", len: 8, prefin: 1.85, note: "8' lengths only", p: [1.28, 1.63, 1.67, 1.45, 1.16, 2.16, 2.59, 2.81] },
];
const SLIP = { price: 0.40, bundle: 50 };
const PLUGS = [['3/8" × 1/2"', 0.10], ['3/8" × 5/8"', 0.15], ['3/8" × 3/4"', 0.20], ['3/8" × 7/8"', 0.25]];
const STAINS = ["Natural", "Cattail", "Caramel", "Fresh Cut", "Toasted Acorn", "Nutmeg", "Buckeye", "Hickory Nut", "Frost", "Breeze", "Camo", "Dawn", "Drift", "Mist", "Prestige", "Silk"];

const fm = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmInt = (n) => "$" + Math.round(n).toLocaleString();
const r2 = (n) => Math.round(n * 100) / 100;

// The floor on the last-open floor tab, as "Match floor" would read it.
const FLOOR = { tab: "Unfinished & custom", sp: "White Oak", grade: "Character", w: '5¼"', prefin: true, stain: "Toasted Acorn", sheen: "30", tex: "Wire brushed" };

// --- rail primitives (copied look) -------------------------------------------
function Sect({ title, hint, tip, extra, children }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="ft-eyebrow text-[10px]">{title}</span>
        {tip && <HelpTip className="align-middle" w={280} tip={tip} />}
        {extra}
        {hint && <span className="ml-auto text-[10.5px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function Chips({ items, cur, onPick, locked }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const on = it.id === cur;
        return (
          <button key={it.id} disabled={locked && !on} onClick={() => onPick(it.id)}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-bold leading-tight text-center ${on ? "bg-slate-900 border-slate-900 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"} ${locked && !on ? "opacity-35 cursor-not-allowed" : ""}`}>
            {it.label}
            {it.sub != null && <span className={`block text-[10px] font-semibold ${on ? "text-white/70" : "text-slate-500"}`}>{it.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}
function Seg({ opts, cur, onPick, locked }) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
      {opts.map((o) => (
        <button key={o.id} disabled={locked && o.id !== cur} onClick={() => onPick(o.id)}
          className={`px-3.5 py-1.5 text-xs font-bold border-l first:border-l-0 border-slate-300 ${o.id === cur ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"} ${locked && o.id !== cur ? "opacity-40" : ""}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// One accessory line in the rail: a qty box that turns the row on.
function PieceRow({ label, sub, unit, per = "lf", qty, onQty, cost, sellOf, extra }) {
  const on = qty > 0;
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 bg-white border-t first:border-t-0 border-slate-100 ${on ? "" : ""}`}>
      <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-extrabold text-white shrink-0 ${on ? "bg-indigo-600" : "border-2 border-slate-300"}`}>{on ? "✓" : ""}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-semibold text-slate-800">{label}</span>
        {sub && <span className="block text-[10.5px] font-medium text-slate-400 mt-0.5">{sub}</span>}
      </span>
      {extra}
      <input type="number" min="0" value={qty || ""} placeholder="0" onChange={(e) => onQty(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        className="w-14 rounded-md border border-slate-300 px-1.5 py-1 text-right text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <span className="w-6 text-[10.5px] font-bold text-slate-500">{unit}</span>
      <span className={`w-[62px] text-right text-[11.5px] font-bold tabular-nums ${on ? "text-indigo-700" : "text-slate-500"}`}>{fm(sellOf(cost))}<span className="text-[9.5px] font-semibold text-slate-400">/{per}</span></span>
    </div>
  );
}

// --- the tab ------------------------------------------------------------------
function AccessoryTab() {
  const [match, setMatch] = useState(view !== "own");
  const [own, setOwn] = useState({ sp: "Red Oak", prefin: false, stain: "", sheen: "30" });
  const [markup, setMarkup] = useState(50);
  const [qty, setQty] = useState({ nose35: 12, nose55: 0, shoe: 180, reducer: 1, tmold: 2, slip: 0, plug: 0 });
  const [plug, setPlug] = useState(0);
  const f = match ? { sp: FLOOR.sp, prefin: FLOOR.prefin, stain: FLOOR.stain, sheen: FLOOR.sheen } : own;
  const set = (patch) => setOwn((o) => ({ ...o, ...patch }));
  const si = SPECIES.indexOf(f.sp);
  const sellOf = (c) => r2(c * (1 + markup / 100));
  const costLf = (pr) => pr.p[si] + (f.prefin ? pr.prefin : 0);
  const finishTxt = f.prefin ? `Prefinished ${f.stain}${f.sheen ? ` · ${f.sheen} sheen` : ""}` : "Unfinished";

  const lines = [
    ...PROFILES.filter((pr) => qty[pr.id] > 0).map((pr) => {
      const lf = pr.unit === "pc" ? qty[pr.id] * pr.len : qty[pr.id];
      return { desc: `${pr.name} · ${f.sp} · ${finishTxt}`, qtyTxt: pr.unit === "pc" ? `${qty[pr.id]} × 8' = ${lf} lf` : `${lf} lf`, cost: costLf(pr), per: "lf", n: lf,
        rows: [[`${pr.short} — ${f.sp}`, fm(pr.p[si]) + "/lf"], ...(f.prefin ? [["Prefinished charge", `+${fm(pr.prefin)}/lf`]] : [])] };
    }),
    ...(qty.slip > 0 ? [{ desc: "Slip tongue · 50 lf bundle", qtyTxt: `${qty.slip} bdl = ${qty.slip * SLIP.bundle} lf`, cost: SLIP.price, per: "lf", n: qty.slip * SLIP.bundle, rows: [["Slip tongue — any species", fm(SLIP.price) + "/lf"]] }] : []),
    ...(qty.plug > 0 ? [{ desc: `Plugs ${PLUGS[plug][0]} · ${f.sp}`, qtyTxt: `${qty.plug} ea`, cost: PLUGS[plug][1], per: "ea", n: qty.plug, rows: [[`Plug ${PLUGS[plug][0]}`, fm(PLUGS[plug][1]) + " ea"]] }] : []),
  ];
  const costTot = lines.reduce((a, l) => a + l.cost * l.n, 0);
  const sellTot = lines.reduce((a, l) => a + sellOf(l.cost) * l.n, 0);

  const rail = (<>
    <div className="mb-4 rounded-lg p-2.5" style={{ border: match ? "1px solid var(--ft-brand)" : "1px dashed var(--ft-brand)", background: "var(--ft-tint)" }}>
      <div className="flex items-center gap-2.5">
        <span className="flex-1 text-[11px] font-medium text-slate-600 leading-snug">
          {match
            ? <>Matching the floor on the <b>{FLOOR.tab}</b> tab — species and finish follow it.</>
            : <>Trim usually matches the floor — link it to the <b>{FLOOR.tab}</b> tab.</>}
        </span>
        <button onClick={() => setMatch(!match)} className="shrink-0 rounded-md border bg-white px-3 py-1.5 text-xs font-bold text-[color:var(--ft-brand-deep)] hover:bg-slate-50 inline-flex items-center gap-1.5" style={{ borderColor: "var(--ft-brand)" }}>
          {match ? <><Unlink size={12} /> Pick my own</> : <><Link2 size={12} /> Match floor</>}
        </button>
      </div>
      {match && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10.5px] font-bold">
          {[FLOOR.sp, `Prefinished ${FLOOR.stain}`, `${FLOOR.sheen} sheen`].map((t) => <span key={t} className="rounded bg-white border border-slate-200 px-1.5 py-0.5 text-slate-700">{t}</span>)}
          <span className="rounded px-1.5 py-0.5 text-amber-700 bg-amber-50 border border-amber-200">{FLOOR.tex} — trim ships smooth (no textured trim on the sheet)</span>
        </div>
      )}
    </div>
    <Sect title="Species" hint={match ? "from the floor" : "Maple · Live Sawn → White Oak"}>
      <Chips locked={match} cur={f.sp} onPick={(sp) => set({ sp })} items={SPECIES.map((sp) => ({ id: sp, label: sp }))} />
    </Sect>
    <Sect title="Finish" hint={f.prefin ? "flat charge per lf, any color" : ""}>
      <Seg locked={match} cur={f.prefin ? "pre" : "unf"} onPick={(id) => set({ prefin: id === "pre", stain: id === "pre" ? (own.stain || "Natural") : "" })}
        opts={[{ id: "unf", label: "Unfinished" }, { id: "pre", label: "Prefinished" }]} />
      {f.prefin && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <div className="ft-eyebrow text-[10px] mb-1">Stain color</div>
            {match ? <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600">{f.stain}</div>
              : <MorphSelect full bold value={f.stain} onChange={(stain) => set({ stain })} options={STAINS.map((c) => ({ v: c, label: c }))} />}
          </div>
          <div>
            <div className="ft-eyebrow text-[10px] mb-1">Sheen</div>
            {match ? <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600">{f.sheen}</div>
              : <MorphSelect full bold value={f.sheen} onChange={(sheen) => set({ sheen })} options={["30", "20", "15", "10", "5"].map((s) => ({ v: s, label: s }))} />}
          </div>
        </div>
      )}
    </Sect>
    <Sect title="Pieces" hint="sell price per lineal foot" tip={<>Every piece prices by the lineal foot off Sheoga's accessory sheet. Reducer and T-mold come in 8' lengths only, so they order by the piece. Nosing lengths depend on Sheoga's inventory.</>}>
      <div className="flex flex-col rounded-lg border border-slate-300 overflow-hidden">
        {PROFILES.map((pr) => (
          <PieceRow key={pr.id} label={pr.name} sub={pr.note} unit={pr.unit === "pc" ? "pcs" : "lf"} qty={qty[pr.id]} onQty={(n) => setQty((q) => ({ ...q, [pr.id]: n }))} cost={costLf(pr)} sellOf={sellOf} />
        ))}
      </div>
    </Sect>
    <Sect title="Also on the sheet">
      <div className="flex flex-col rounded-lg border border-slate-300 overflow-hidden">
        <PieceRow label="Slip tongue" sub="any species · 50 lf bundles · not prefinished" unit="bdl" qty={qty.slip} onQty={(n) => setQty((q) => ({ ...q, slip: n }))} cost={SLIP.price} sellOf={(c) => sellOf(c)} />
        <PieceRow label="Plugs" sub="species matches the trim" unit="ea" per="ea" qty={qty.plug} onQty={(n) => setQty((q) => ({ ...q, plug: n }))} cost={PLUGS[plug][1]} sellOf={sellOf}
          extra={<MorphSelect size="sm" value={String(plug)} onChange={(v) => setPlug(Number(v))} options={PLUGS.map(([s], i) => ({ v: String(i), label: s }))} />} />
      </div>
    </Sect>
  </>);

  const card = (
    <div className="rounded-lg border overflow-hidden bg-white" style={{ borderColor: "var(--ft-grid-line)" }}>
      <div className="flex items-center gap-2 px-3.5 py-2" style={{ background: "var(--ft-sand)" }}>
        <span className="w-5 h-5 rounded text-[10px] font-extrabold text-white flex items-center justify-center" style={{ background: "var(--ft-brand-deep)" }}>H</span>
        <span className="text-[13px] font-extrabold flex-1">Sheoga trim — {f.sp}</span>
        <span className="text-[9.5px] text-slate-500 font-semibold">priced from Sheoga accessory sheet · Oct ’26</span>
      </div>
      <div className="px-3.5 pt-2.5 pb-1 text-[15px] font-bold leading-snug">{f.sp} · {finishTxt}{match && <span className="ml-2 align-middle whitespace-nowrap rounded px-1.5 py-px text-[9.5px] font-bold" style={{ background: "var(--ft-tint)", color: "var(--ft-brand-deep)" }}>matches floor</span>}</div>
      <div className="px-3.5 pb-3">
        {lines.length === 0 && <div className="py-3 text-xs text-slate-400">Enter a quantity on the left to price a piece.</div>}
        {lines.map((l, i) => (
          <div key={i} className="py-2 border-t first:border-t-0 border-slate-100">
            <div className="flex items-baseline gap-2">
              <span className="flex-1 text-[12.5px] font-bold text-slate-800">{l.desc}</span>
              <span className="tabular-nums text-[12.5px] font-extrabold">{fmInt(sellOf(l.cost) * l.n)}</span>
            </div>
            {l.rows.map(([a, b], j) => (
              <div key={j} className="flex items-baseline gap-2 py-[1px] text-[11px] text-slate-500 font-medium"><span className="flex-1">{a}</span><span className="tabular-nums font-semibold text-slate-700">{b}</span></div>
            ))}
            <div className="flex items-baseline gap-2 py-[1px] text-[11px] text-slate-500 font-medium">
              <span className="flex-1">{l.qtyTxt}</span>
              <span className="tabular-nums font-semibold text-slate-700">{fm(l.cost)} → <span style={{ color: "var(--ft-brand-deep)" }}>{fm(sellOf(l.cost))}</span>/{l.per}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 px-3.5 py-2.5 border-t border-slate-300" style={{ background: "var(--ft-sand)" }}>
        <div className="leading-tight"><div className="ft-eyebrow text-[8.5px]">our cost</div><div className="text-base font-extrabold tabular-nums">{fm(costTot)}</div></div>
        <div className="text-xs text-slate-400">→ +{markup}% →</div>
        <div className="leading-tight"><div className="ft-eyebrow text-[8.5px]">sell</div><div className="text-xl font-extrabold tabular-nums" style={{ color: "var(--ft-brand-deep)" }}>{fm(sellTot)}</div></div>
        <div className="ml-auto text-right leading-tight"><div className="ft-eyebrow text-[8.5px]">{lines.length} line{lines.length === 1 ? "" : "s"}</div><div className="text-base font-extrabold tabular-nums">{fmInt(sellTot)}</div></div>
      </div>
      <div className="flex gap-2 px-3.5 py-2.5 border-t border-slate-200">
        <button className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"><Plus size={13} /> Add to basket</button>
        <button className="rounded-md bg-indigo-600 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5"><Plus size={13} /> Add {lines.length} product line{lines.length === 1 ? "" : "s"}</button>
      </div>
    </div>
  );

  return (
    <Frame tab="acc" footer={<>
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">Trim markup <input type="number" min="0" step="5" value={markup} onChange={(e) => setMarkup(Math.max(0, Number(e.target.value) || 0))}
        className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" /> %</label>
      <span className="text-[11px] text-slate-400">default from the Sheoga price book</span>
    </>}>
      <div className="w-[50%] max-w-[500px] shrink-0 border-r border-slate-300 overflow-y-auto p-4" style={{ scrollbarGutter: "stable" }}>{rail}</div>
      <div className="flex-1 min-w-0 overflow-y-auto p-4" style={{ background: "var(--ft-cream)" }}>{card}</div>
    </Frame>
  );
}

function Frame({ tab, children, footer }) {
  const TABS = [["floor", "Unfinished & custom"], ["stocked", "Stocked prefinished"], ["vent", "Wood vents"], ["damper", "Dampers"], ["acc", "Trim & accessories"]];
  return (
    <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(20,15,10,.55)" }}>
      <div className="bg-white flex flex-col overflow-hidden relative rounded-xl w-full max-w-[1060px] h-[min(820px,94vh)] border border-slate-300 shadow-2xl">
        <div className="flex items-center gap-3 px-3.5 pt-2">
          <h2 className="ft-serif text-xl leading-none">Sheoga Hardwood</h2>
          <HelpTip className="align-middle" w={300} tip="Mockup" />
          <div className="ml-auto flex items-center gap-2">
            <PriceLevelMenu value="retail" customPct="" onPick={() => {}} onPct={() => {}} bg="var(--ft-card)" />
            <BasketButton count={1} onClick={() => {}} />
            <button className="w-8 h-8 flex items-center justify-center text-slate-500"><X size={18} /></button>
          </div>
        </div>
        <div className="flex gap-0.5 px-4 pt-2.5 border-b border-slate-300">
          {TABS.map(([id, label]) => (
            <button key={id} className={`px-3.5 py-2 text-xs font-bold rounded-t-lg border border-b-0 -mb-px ${tab === id ? "bg-white border-slate-300 text-slate-900 relative z-10" : "bg-slate-100 border-slate-200 text-slate-500"}`}>{label}</button>
          ))}
        </div>
        <div className="flex-1 flex min-h-0">{children}</div>
        <div className="flex items-center gap-5 px-4 py-2.5 border-t border-slate-300" style={{ background: "var(--ft-cream)" }}>{footer}</div>
      </div>
    </div>
  );
}

// --- the Sheoga price book page ------------------------------------------------
const inp = "ft-field rounded-md border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const lbl = "block text-[11px] font-medium text-slate-500 mb-1";

function BookPage({ initialTab }) {
  const [tab, setTab] = useState(initialTab);
  const [mk, setMk] = useState({ flooring: "40", vents: "50", trim: "50" });
  const flip = (t) => setTab(tab === t ? null : t);
  const field = (k, label, ex, cost, per) => (
    <div>
      <label className={lbl}>{label}</label>
      <div className="flex items-center gap-2">
        <span className="text-slate-400">+</span>
        <input type="number" min="0" step="5" value={mk[k]} onChange={(e) => setMk((m) => ({ ...m, [k]: e.target.value }))} className={`${inp} w-20 text-right`} />
        <span className="text-slate-500">%</span>
      </div>
      <div className="mt-1 text-[11px] text-slate-400 tabular-nums">{ex}: {fm(cost)} → {fm(r2(cost * (1 + Number(mk[k]) / 100)))}{per}</div>
    </div>
  );
  return (
    <div className="min-h-screen p-8" style={{ background: "var(--ft-cream)" }}>
      <div className="max-w-[980px] mx-auto rounded-xl p-5" style={{ background: "var(--ft-card)", border: "1px solid var(--ft-border)" }}>
        <div className="text-[11px] text-slate-400 mb-1">Price books ›</div>
        <div className="flex items-center gap-2 flex-wrap">
          <input className={inp + " text-[15px] font-medium"} defaultValue="Sheoga Hardwood" />
          <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-slate-100 text-slate-500">Vendor · no items</span>
          <span className="text-xs text-slate-400">Priced by the Sheoga configurator</span>
        </div>
        <div className="mt-3">
          <div className="flex items-end gap-1" style={{ borderBottom: "1px solid var(--ft-border)" }}>
            <BookTab label="Markup" summary={`flooring ${mk.flooring}% · vents ${mk.vents}% · trim ${mk.trim}%`} active={tab === "markup"} onClick={() => flip("markup")} />
            <BookTab label="Price sheets" summary="accessories Oct ’26 · uploaded" tone="attn" active={tab === "sheets"} onClick={() => flip("sheets")} />
            <BookTab label="Freight" summary="none" active={tab === "freight"} onClick={() => flip("freight")} />
            <BookTab label="Brand" summary="Sheoga Hardwood" active={tab === "brand"} onClick={() => flip("brand")} />
            <BookTab label="Contacts" summary="rep · samples" active={tab === "contacts"} onClick={() => flip("contacts")} />
          </div>
          {tab && (
            <div className="rounded-b-md px-4 pb-4" style={{ border: "1px solid var(--ft-border)", borderTop: "none", background: "var(--ft-card)" }}>
              {tab === "markup" && (
                <div className="pt-3 max-w-3xl">
                  <div className="grid grid-cols-3 gap-4">
                    {field("flooring", "Flooring & stocked prefinished", 'White Oak Clear 5¼"', 6.45, " /sf")}
                    {field("vents", "Wood vents & dampers", "4×10 flush vent, group A", 18.13, "")}
                    {field("trim", "Trim & accessories", "White Oak T-mold, prefinished", 4.01, " /lf")}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 text-xs font-semibold">Save</button>
                    <span className="text-[11px] text-slate-400">New picks only — saved estimates keep their price.</span>
                  </div>
                </div>
              )}
              {tab === "sheets" && <SheetsCard />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SheetsCard() {
  const row = (name, src, when, live) => (
    <div className="flex items-center gap-3 py-2 border-t first:border-t-0 border-slate-100">
      <FileSpreadsheet size={16} className={live ? "text-[color:var(--ft-brand-deep)]" : "text-slate-300"} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-slate-800">{name}</div>
        <div className="text-[11px] text-slate-400">{src}</div>
      </div>
      <div className="text-[11px] text-slate-500 tabular-nums">{when}</div>
      {live ? (<>
        <button className="rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50 inline-flex items-center gap-1"><Download size={12} /> File</button>
        <button className="rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50 inline-flex items-center gap-1"><Upload size={12} /> Replace…</button>
      </>) : <span className="text-[10.5px] text-slate-400 w-[132px] text-right">built into the app</span>}
    </div>
  );
  const th = "px-2 py-1 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300 bg-slate-100 first:text-left";
  const td = "px-2 py-1 text-right tabular-nums text-xs first:text-left first:font-bold";
  return (
    <div className="pt-3">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="ft-eyebrow text-[10px]">Sheoga price sheets</span>
        <HelpTip className="align-middle" w={300} tip={<>An uploaded sheet prices its configurator tab directly. Replace it when Sheoga sends a new one — new picks use the new prices, saved estimates keep theirs.</>} />
      </div>
      <div className="rounded-md border border-slate-200 px-3">
        {row("Accessory pricing", "Sheoga_Accessory_Pricing_-_Distributor_-_20261001.xlsx · uploaded Oct 2, 2026", "sheet dated 10/01/26", true)}
        {row("Flooring & stocked prefinished", "Distributor Price List", "Jan ’26", false)}
        {row("Wood vents", "Vent price sheet", "Feb ’22", false)}
        {row("Dampers", "Damper sheet", "Jul ’26", false)}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11.5px] font-semibold" style={{ color: "var(--ft-brand-deep)" }}>
        <Check size={14} /> Read 40 species prices, 4 prefinish charges, slip tongue and 4 plug sizes — nothing missing.
      </div>
      <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full">
          <thead><tr><th className={th}>$ per lineal ft</th>{PROFILES.map((p) => <th key={p.id} className={th}>{p.short}</th>)}</tr></thead>
          <tbody>
            {SPECIES.map((sp, i) => (
              <tr key={sp} className="border-b border-slate-100">
                <td className={td}>{sp}</td>{PROFILES.map((p) => <td key={p.id} className={td}>{p.p[i].toFixed(2)}</td>)}
              </tr>
            ))}
            <tr style={{ background: "var(--ft-tint)" }}>
              <td className={td}>+ Prefinished</td>{PROFILES.map((p) => <td key={p.id} className={td}>{p.prefin.toFixed(2)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[11px] text-slate-500">Slip tongue $0.40/lf in 50 lf bundles · Plugs {PLUGS.map(([s, p]) => `${s} $${p.toFixed(2)}`).join(" · ")}</div>
    </div>
  );
}

const view = new URLSearchParams(location.search).get("view");
createRoot(document.getElementById("preview")).render(
  view === "markup" ? <BookPage initialTab="markup" /> : view === "sheets" ? <BookPage initialTab="sheets" /> : <AccessoryTab />,
);
