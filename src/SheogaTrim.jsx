// The Sheoga configurator's Trim & accessories tab (spec 2026-10-02 §3):
// rail, build card and the no-sheet state. Pricing lives in sheogatrim.js;
// the rail primitives come in through `kit` from SheogaConfigurator.jsx,
// which imports this file — importing them back would close a cycle.
import { X, Plus, Link2, Unlink } from "lucide-react";
import { MorphSelect } from "./widgets.jsx";
import { TEXTURES, STAIN_COLORS } from "./sheoga.js";
import { TRIM_PROFILES, TRIM_SPECIES, TRIM_LENGTHS, trimRates, trimUnitCost, trimSellTotal } from "./sheogatrim.js";
import { sheetMonth } from "./vendorbook.js";
import { TIER_COLOR, tierBadgeText } from "./uiconst.js";

const fm = (n) => "$" + n.toFixed(2);
const fmInt = (n) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const whole = (v) => Math.max(0, Math.round(Number(v) || 0));
const numCls = "w-14 rounded-md border border-slate-300 px-1.5 py-1 text-right text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500";
const textCls = "w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500";
const LEN_OPTS = [...TRIM_LENGTHS.map((l) => ({ v: String(l), label: `${l}' pieces` })), { v: "rl", label: "Random lengths" }];
const texLabel = (id) => (TEXTURES.find((t) => t.id === id) || TEXTURES[0]).name.replace(" (standard)", "");
const PIECES_TIP = <>Every piece prices by the lineal foot off Sheoga's accessory sheet. Stair nose and shoe mold order as pieces of a length you pick, or random lengths by the foot (Sheoga picks, subject to inventory). Reducer and T-mold come in 8' lengths only. Textured trim: stair nose takes the sheet's texture charge; shoe mold, reducer and T-mold can't be textured and ship smooth.</>;

const Sub = ({ children }) => <span className="block text-[10.5px] font-medium text-slate-400 mt-0.5">{children}</span>;
const SmoothNote = () => <Sub>smooth — can't be textured</Sub>;
const LfSell = ({ on, sell }) => (
  <span className={`text-[11.5px] font-bold tabular-nums ${on ? "text-indigo-700" : "text-slate-500"}`}>{fm(sell)}<span className="text-[9.5px] font-semibold text-slate-400">/lf</span></span>
);
export const Locked = ({ label, value }) => (
  <div>
    <div className="ft-eyebrow text-[10px] mb-1">{label}</div>
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600 truncate">{value || "—"}</div>
  </div>
);

// Stair nose / shoe mold: one or more "N pcs × L'" runs, or Random lengths in lf.
function RunRows({ p, runs, setRuns, lfCost, smooth, tsell }) {
  const on = runs.some((r) => whole(r.n) > 0);
  const upd = (i, patch) => setRuns(runs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="px-3 py-2 bg-white border-t first:border-t-0 border-slate-100" data-trim-row={p.id}>
      <div className="flex items-center gap-2.5">
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-slate-800">{p.name}</span>
          {p.id !== "shoe" && <Sub>lengths subject to inventory</Sub>}
          {smooth && <SmoothNote />}
        </span>
        <LfSell on={on} sell={tsell(lfCost)} />
      </div>
      <div className="mt-1.5 flex flex-col gap-1">
        {runs.map((r, i) => {
          const n = whole(r.n), rl = r.len === "rl";
          return (
            <div key={i} className="flex items-center gap-1.5">
              <input type="number" min="0" value={n || ""} placeholder="0" onChange={(e) => upd(i, { n: whole(e.target.value) })} className={numCls} />
              <span className="text-[10.5px] font-bold text-slate-500 w-[26px]">{rl ? "lf" : "pcs"}</span>
              {!rl && <span className="text-[10.5px] font-bold text-slate-400">×</span>}
              <div className="w-[108px] shrink-0">
                <MorphSelect size="sm" full bold value={String(r.len)} onChange={(v) => upd(i, { len: v === "rl" ? "rl" : Number(v) })} options={LEN_OPTS} />
              </div>
              <span className="hidden sm:inline text-[10.5px] text-slate-400 tabular-nums whitespace-nowrap">{rl ? "Sheoga picks" : `= ${n * r.len} lf`}</span>
              {n > 0 && !rl && <span className="ml-auto text-[11px] font-bold tabular-nums text-slate-600 whitespace-nowrap">{fm(tsell(trimUnitCost(lfCost, r.len)))}/pc</span>}
              {runs.length > 1 && <button onClick={() => setRuns(runs.filter((_, j) => j !== i))} className={`${n > 0 && !rl ? "" : "ml-auto"} text-slate-300 hover:text-slate-500`} aria-label="Remove length"><X size={13} /></button>}
            </div>
          );
        })}
        <button onClick={() => setRuns([...runs, { n: 0, len: 8 }])} className="self-start text-[10.5px] font-bold text-indigo-700 underline underline-offset-2">+ another length</button>
      </div>
    </div>
  );
}

// Reducer / T-mold (8' pieces) and slip tongue (bundles): one count box.
function PieceRow({ id, label, sub, smooth, unit, qty, onQty, lfSell, unitText }) {
  const on = whole(qty) > 0;
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 bg-white border-t first:border-t-0 border-slate-100" data-trim-row={id}>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-semibold text-slate-800">{label}</span>
        {sub && <Sub>{sub}</Sub>}
        {smooth && <SmoothNote />}
      </span>
      <input type="number" min="0" value={whole(qty) || ""} placeholder="0" onChange={(e) => onQty(whole(e.target.value))} className={numCls} />
      <span className="w-6 text-[10.5px] font-bold text-slate-500">{unit}</span>
      <span className="w-[92px] text-right leading-tight">
        <LfSell on={on} sell={lfSell} />
        <span className="block text-[9.5px] font-semibold text-slate-400 tabular-nums">{unitText}</span>
      </span>
    </div>
  );
}

// `cfg` is the tab's own state; `eff` the build it prices (the floor's values
// while Match floor is on). Pickers lock while matching.
export function TrimRail({ cfg, eff, set, srcLabel, trimBook, tsell, kit }) {
  const { Sect, Chips, Seg, SheenPicker, Dropdown } = kit;
  const match = !!cfg.match;
  const rates = trimRates(eff, trimBook);
  const pick = (patch) => set({ ...cfg, ...patch });
  const setRuns = (id, rs) => pick({ runs: { ...cfg.runs, [id]: rs } });
  const finishChip = eff.prefin ? `Prefinished${eff.stain ? " " + eff.stain : ""}` : "Unfinished";
  const zero = { lfCost: 0, smoothOnly: false };
  return (<>
    <div className="mb-4 rounded-lg p-2.5" style={{ border: `1px ${match ? "solid" : "dashed"} var(--ft-brand)`, background: "var(--ft-tint)" }} data-trim-match={match ? "on" : "off"}>
      <div className="flex items-center gap-2.5">
        <span className="flex-1 text-[11px] font-medium text-slate-600 leading-snug">
          {match
            ? <>Matching the floor on the <b>{srcLabel}</b> tab — species, finish and texture follow it.</>
            : <>Trim usually matches the floor — link it to the <b>{srcLabel}</b> tab.</>}
        </span>
        <button onClick={() => (match ? set(eff) : pick({ match: true }))} data-trim-matchbtn
          className="shrink-0 rounded-md border bg-white px-3 py-1.5 text-xs font-bold text-[color:var(--ft-brand-deep)] hover:bg-slate-50 inline-flex items-center gap-1.5" style={{ borderColor: "var(--ft-brand)" }}>
          {match ? <><Unlink size={12} /> Pick my own</> : <><Link2 size={12} /> Match floor</>}
        </button>
      </div>
      {match && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10.5px] font-bold">
          {[eff.sp, finishChip, eff.prefin && `${eff.sheen} sheen`, texLabel(eff.tex)].filter(Boolean).map((t) => (
            <span key={t} className="rounded bg-white border border-slate-200 px-1.5 py-0.5 text-slate-700">{t}</span>
          ))}
        </div>
      )}
    </div>
    <Sect title="Species" hint={match ? "from the floor" : "Live Sawn → White Oak"}>
      <Chips locked={match} cur={eff.sp} onPick={(sp) => pick({ sp })} items={TRIM_SPECIES.map((sp) => ({ id: sp, label: sp }))} />
    </Sect>
    <Sect title="Finish" hint={eff.prefin ? "flat charge per lf, any color" : ""}>
      <Seg locked={match} cur={eff.prefin ? "pre" : "unf"} onPick={(id) => pick({ prefin: id === "pre", ...(id === "pre" && !cfg.stain ? { stain: "Natural" } : {}) })}
        opts={[{ id: "unf", label: "Unfinished" }, { id: "pre", label: "Prefinished" }]} />
      <div className="mt-2 grid grid-cols-3 gap-2">
        {eff.prefin && (match ? <Locked label="Stain color" value={eff.stain} /> : (
          <div>
            <div className="ft-eyebrow text-[10px] mb-1">Stain color</div>
            <MorphSelect full bold placeholder="Pick color…" value={cfg.stainCustom ? "__c" : (STAIN_COLORS.includes(cfg.stain) ? cfg.stain : "")}
              onChange={(v) => (v === "__c" ? pick({ stainCustom: true }) : pick({ stainCustom: false, stain: v }))}
              options={[...STAIN_COLORS.map((c) => ({ v: c, label: c })), { v: "__c", label: "Custom…" }]} />
            {cfg.stainCustom && <input value={cfg.stain} onChange={(e) => pick({ stain: e.target.value })} placeholder="Custom color name" className={textCls + " mt-1.5"} />}
          </div>
        ))}
        {eff.prefin && (match ? <Locked label="Sheen" value={eff.sheen} /> : <SheenPicker cfg={cfg} set={set} />)}
        {match ? <Locked label="Texture" value={texLabel(eff.tex)} />
          : <Dropdown label="Texture" value={cfg.tex || "smooth"} onChange={(tex) => pick({ tex })}
              options={TEXTURES.map((t) => ({ id: t.id, label: texLabel(t.id) }))} />}
      </div>
    </Sect>
    <Sect title="Pieces" hint="sell price per lineal foot" tip={PIECES_TIP}>
      <div className="flex flex-col rounded-lg border border-slate-300 overflow-hidden">
        {TRIM_PROFILES.map((p) => {
          const r = rates?.[p.id] || zero;
          return p.fixedLen
            ? <PieceRow key={p.id} id={p.id} label={p.name} sub={`${p.fixedLen}' lengths only`} smooth={r.smoothOnly} unit="pcs" qty={cfg[p.id]} onQty={(n) => pick({ [p.id]: n })}
                lfSell={tsell(r.lfCost)} unitText={`${fm(tsell(trimUnitCost(r.lfCost, p.fixedLen)))}/${p.fixedLen}' pc`} />
            : <RunRows key={p.id} p={p} runs={cfg.runs?.[p.id] || []} setRuns={(rs) => setRuns(p.id, rs)} lfCost={r.lfCost} smooth={r.smoothOnly} tsell={tsell} />;
        })}
        {rates && (
          <PieceRow id="slip" label="Slip tongue" sub={`any species · ${rates.slip.bundleLf} lf bundles · not prefinished`} unit="bdl" qty={cfg.slip} onQty={(n) => pick({ slip: n })}
            lfSell={tsell(rates.slip.lfCost)} unitText={`${fm(tsell(rates.slip.unitCost))}/bdl`} />
        )}
      </div>
    </Sect>
  </>);
}

// The build card: one block per line, then cost → markup → sell.
export function TrimCard({ build, matched, trimBook, markupPct, tierId, pct, tierColor, tsell, onAdd, onAddBasket, showActions = true }) {
  const n = build.lines.length;
  const sellTot = trimSellTotal(build, tsell);
  const badge = tierBadgeText(tierId, pct);
  const lensLabel = tierId === "employee" ? "cost + 6% →" : pct > 0 ? `+${markupPct}% − ${pct}% →` : `→ +${markupPct}% →`;
  const month = sheetMonth(trimBook?.sheet?.sheetDate);
  const deep = tierColor || "var(--ft-brand-deep)";
  return (
    <div className="rounded-lg border overflow-hidden bg-white" style={{ borderColor: "var(--ft-grid-line)" }} data-trim-card>
      <div className="flex items-center gap-2 px-3.5 py-2" style={{ background: "var(--ft-sand)" }}>
        <span className="w-5 h-5 rounded text-[10px] font-extrabold text-white flex items-center justify-center" style={{ background: "var(--ft-brand-deep)" }}>H</span>
        <span className="text-[13px] font-extrabold flex-1">Sheoga trim — {build.sp}</span>
        <span className="text-[9.5px] text-slate-500 font-semibold">accessory sheet{month ? ` · ${month}` : ""}</span>
      </div>
      <div className="px-3.5 pt-2.5 pb-1 text-[15px] font-bold leading-snug">
        {build.sp} · {build.finishText}
        {matched && <span className="ml-2 align-middle whitespace-nowrap rounded px-1.5 py-px text-[9.5px] font-bold" style={{ background: "var(--ft-tint)", color: "var(--ft-brand-deep)" }}>matches floor</span>}
      </div>
      <div className="px-3.5 pb-3">
        {n === 0 && <div className="py-3 text-xs text-slate-400">Enter a quantity on the left to price a piece.</div>}
        {build.lines.map((l) => (
          <div key={l.key} className="py-2 border-t first:border-t-0 border-slate-100" data-trim-line={l.profile}>
            <div className="flex items-baseline gap-2">
              <span className="flex-1 text-[12.5px] font-bold text-slate-800">{l.desc}</span>
              <span className="tabular-nums text-[12.5px] font-extrabold" style={tierColor ? { color: tierColor } : undefined}>{fmInt(tsell(l.unitCost) * l.qty)}</span>
            </div>
            {l.rows.map(([a, b], j) => (
              <div key={j} className="flex items-baseline gap-2 py-[1px] text-[11px] text-slate-500 font-medium"><span className="flex-1">{a}</span><span className="tabular-nums font-semibold text-slate-700">{b}</span></div>
            ))}
            <div className="flex items-baseline gap-2 py-[1px] text-[11px] text-slate-500 font-medium">
              <span className="flex-1">{l.math}</span>
              <span className="tabular-nums font-semibold text-slate-700">{fm(l.unitCost)} → <span style={{ color: deep }}>{fm(tsell(l.unitCost))}</span>/{l.unit}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 px-3.5 py-2.5 border-t border-slate-300" style={{ background: "var(--ft-sand)" }}>
        <div className="leading-tight"><div className="ft-eyebrow text-[8.5px]">our cost</div><div className="text-base font-extrabold tabular-nums">{fm(build.costTotal)}</div></div>
        <div className="text-xs text-slate-400">{lensLabel}</div>
        <div className="leading-tight">
          <div className="ft-eyebrow text-[8.5px] flex items-center gap-1">sell{badge && <span className="rounded px-1 py-px text-[9px] font-bold normal-case tracking-normal" style={{ background: TIER_COLOR[tierId]?.soft, color: TIER_COLOR[tierId]?.main }}>{badge}</span>}</div>
          <div className="text-xl font-extrabold tabular-nums" style={{ color: deep }} data-sheoga-sell>{fm(sellTot)}</div>
        </div>
        <div className="ml-auto text-right leading-tight"><div className="ft-eyebrow text-[8.5px]">{n} line{n === 1 ? "" : "s"}</div><div className="text-base font-extrabold tabular-nums" style={tierColor ? { color: tierColor } : undefined}>{fmInt(sellTot)}</div></div>
      </div>
      {showActions && (
        <div className="flex gap-2 px-3.5 py-2.5 border-t border-slate-200">
          <button onClick={onAddBasket} disabled={!n} className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-40"><Plus size={13} /> Add to basket</button>
          <button onClick={onAdd} disabled={!n} className="rounded-md bg-indigo-600 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5 disabled:opacity-40" data-sheoga-add><Plus size={13} /> Add {n} product line{n === 1 ? "" : "s"}</button>
        </div>
      )}
    </div>
  );
}

export function TrimEmpty({ hasBook }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-5 text-sm text-slate-500 leading-relaxed" data-trim-empty={hasBook ? "sheet" : "book"}>
      {hasBook ? <>
        <div className="font-bold text-slate-800 mb-1">No accessory sheet yet</div>
        Upload Sheoga's accessory sheet on the Sheoga price book (Price books → Sheoga Hardwood → Price sheets).
      </> : <>
        <div className="font-bold text-slate-800 mb-1">No Sheoga price book yet</div>
        Create the Sheoga vendor book first (Price books → New book → Sheoga (vendor)), then upload Sheoga's accessory sheet on its Price sheets tab.
      </>}
    </div>
  );
}
