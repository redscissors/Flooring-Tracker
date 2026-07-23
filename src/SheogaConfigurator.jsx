// Sheoga vendor configurator popup (issue 023, prototype A "option board"):
// every option group on one card, live build + sell price on the right, no
// steps. All pricing comes from src/sheoga.js — this file is presentation only.
// "Add to product line" hands the lineItems() payloads back to the caller; the
// row keeps the raw configuration (product.sheoga) so Reconfigure reopens here.
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Grid3X3, Plus, ChevronUp } from "lucide-react";
import { useEscClose } from "./widgets.jsx";
import {
  MODES, defaultConfig, calcConfig, calcFloor, calcStocked, calcHerringbone, calcVent,
  floorBase, floorWidths, WIDTHS, WIDTH_LABEL, LIVE_SAWN_SP, SPECIES,
  TEXTURES, EDGES, LENGTHS, FINISHES, NO_SAP, CUSTOM_FINISHES,
  STOCKED, STOCKED_WIDTHS, stockedItem, HERRINGBONE, CHEVRON_ADD,
  hbBandForLen, hbSlatLen,
  STAIN_COLORS, SHEENS, SHEEN_FEE,
  VENT_GROUP, VENT_CATS, VENT_PREFIN, VENT_TEX, VENT_CUBED, DAMPER_ATTACH, DAMPERS, ventFromFloor, hbFromFloor, ventScrape, ventDims,
  DEFAULT_MARKUP, DEFAULT_VENT_MARKUP, sellOf, cartonize, lineItems, frameLineal, SHEET_NOTE,
  redistributeShares, multiWidthBuild, multiWidthLineItems, normBasketEntry,
} from "./sheoga.js";

const fm = (n) => "$" + n.toFixed(2);
const fmInt = (n) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

// --- small option controls ----------------------------------------------------

function Sect({ title, hint, extra, children }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="ft-eyebrow text-[10px]">{title}</span>
        {extra}
        {hint && <span className="ml-auto text-[10.5px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// An item may carry `bg` (a light fill applied only when it isn't the selected
// chip) — used to shade the vent sizes by duct width so groups read at a glance.
function Chips({ items, cur, onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const on = it.id === cur;
        const tinted = !on && it.bg;
        return (
          <button key={String(it.id)} disabled={it.dis} onClick={() => onPick(it.id)}
            style={tinted ? { background: it.bg } : undefined}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-bold leading-tight text-center ${on ? "bg-slate-900 border-slate-900 text-white" : tinted ? "border-slate-300 text-slate-800 hover:brightness-95" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"} ${it.dis ? "opacity-30 cursor-not-allowed line-through" : ""}`}>
            {it.label}
            {it.sub != null && <span className={`block text-[10px] font-semibold no-underline ${on ? "text-white/70" : "text-slate-500"}`}>{it.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Width row: single-select chips (unchanged behavior) that can flip into
// multi-select checkboxes + a job-size-split stepper via the Multi chip.
function WidthRow({ items, cur, multi, selected, onPick, onToggle, onMultiToggle, onStep, count }) {
  return (<>
    <div className="flex flex-wrap gap-1.5 items-start">
      {items.map((it) => {
        const on = multi ? selected.includes(it.id) : it.id === cur;
        return (
          <button key={it.id} disabled={it.dis} onClick={() => (multi ? onToggle(it.id) : onPick(it.id))}
            className={`relative rounded-md border px-2.5 py-1.5 text-xs font-bold leading-tight text-center ${multi ? "pl-6" : ""} ${on ? "bg-slate-900 border-slate-900 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"} ${it.dis ? "opacity-30 cursor-not-allowed line-through" : ""}`}>
            {multi && <span className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-[3px] border ${on ? "bg-white/90 border-white/90 text-slate-900" : "border-slate-300"} flex items-center justify-center text-[8px] font-black`}>{on ? "✓" : ""}</span>}
            {it.label}{it.sub != null && !multi && <span className={`block text-[10px] font-semibold ${on ? "text-white/70" : "text-slate-400"}`}>{it.sub}</span>}
          </button>);
      })}
      <button onClick={onMultiToggle}
        className={`rounded-md border px-2.5 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 ${multi ? "text-white" : "text-[color:var(--ft-brand-deep)]"}`}
        style={multi ? { background: "var(--ft-brand)", borderColor: "var(--ft-brand)" } : { borderColor: "var(--ft-brand)", borderStyle: "dashed" }}>
        ◨ Multi{multi ? " ✓" : ""}
      </button>
    </div>
    {multi && (
      <div className="mt-2.5 rounded-lg p-3" style={{ border: "1px solid var(--ft-tint-border)", background: "var(--ft-tint)" }}>
        <div className="flex items-center gap-2.5">
          <span className="ft-eyebrow text-[10px]">Multi-width</span>
          <span className="text-[11px] font-semibold text-slate-500">How many widths?</span>
          <div className="inline-flex rounded-md border border-slate-300 overflow-hidden bg-white">
            <button onClick={() => onStep(-1)} className="w-7 h-7 text-base font-bold">−</button>
            <span className="w-8 text-center font-bold text-[13px] leading-7">{count}</span>
            <button onClick={() => onStep(1)} className="w-7 h-7 text-base font-bold">+</button>
          </div>
          <span className="ml-auto text-[10.5px] text-slate-400 font-medium">split ∝ width · editable →</span>
        </div>
        <div className="mt-1.5 text-[11px] text-slate-500 font-medium">Tick the widths above; job size splits proportionally to plank width. Adjust each share on the right.</div>
      </div>
    )}
  </>);
}

function Seg({ opts, cur, onPick }) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
      {opts.map((o) => (
        <button key={o.id} disabled={o.dis} onClick={() => onPick(o.id)}
          className={`px-3.5 py-1.5 text-xs font-bold border-l first:border-l-0 border-slate-300 ${o.id === cur ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"} ${o.dis ? "opacity-40" : ""}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RadioList({ items, cur, onPick }) {
  return (
    <div className="flex flex-col rounded-lg border border-slate-300 overflow-hidden">
      {items.map((it) => {
        const on = it.id === cur;
        return (
          <button key={String(it.id)} onClick={() => onPick(it.id)}
            className="flex items-center gap-2.5 px-3 py-2 bg-white text-left text-xs font-semibold text-slate-800 border-t first:border-t-0 border-slate-100 hover:bg-slate-50">
            <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 relative ${on ? "border-indigo-600" : "border-slate-300"}`}>
              {on && <span className="absolute inset-[2px] rounded-full bg-indigo-600" />}
            </span>
            <span className="flex-1 min-w-0">
              {it.label}
              {it.sub && <span className="block text-[10.5px] font-medium text-slate-400 mt-0.5">{it.sub}</span>}
            </span>
            {it.add && <span className={`shrink-0 text-[11.5px] font-bold tabular-nums ${on ? "text-indigo-700" : "text-slate-500"}`}>{it.add}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ label, on, onClick, add }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 mt-1.5 first:mt-0">
      <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-extrabold text-white shrink-0 ${on ? "bg-indigo-600" : "border-2 border-slate-300"}`}>{on ? "✓" : ""}</span>
      <span className="flex-1">{label}</span>
      {add && <span className="text-[11.5px] font-bold text-slate-500 tabular-nums">{add}</span>}
    </button>
  );
}

const QtyInput = ({ value, onChange }) => (
  <input type="number" min="1" value={value} onChange={(e) => onChange(Math.max(1, Math.round(Number(e.target.value) || 1)))}
    className="w-24 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
);

const selectCls = "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";
const textCls = "w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500";

// Labeled dropdown for the compact floor rail (texture / edge / lengths /
// finishing). Options are { id, label, dis? }.
function Dropdown({ label, hint, value, options, onChange }) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5 mb-1"><span className="ft-eyebrow text-[10px]">{label}</span>{hint && <span className="text-[9.5px] text-slate-400 font-medium">{hint}</span>}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
        {options.map((o) => <option key={String(o.id)} value={o.id} disabled={o.dis}>{o.label}</option>)}
      </select>
    </div>
  );
}

// The "full price grid" trigger — a real button, shared by both rails.
function GridButton({ onClick }) {
  return (
    <button onClick={onClick} className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
      <Grid3X3 size={13} /> Price grid
    </button>
  );
}

// Stain color — the mode follows the Finishing selection, not a toggle. An
// established stain shows the program's standard colors (dropdown); a custom-
// color finish (T-1/T-2/T-3) shows a free-typed color only, no dropdown.
function StainPicker({ cfg, set, custom }) {
  return (
    <div>
      <div className="ft-eyebrow text-[10px] mb-1">Stain color</div>
      {custom ? (
        <input value={cfg.stain} onChange={(e) => set({ ...cfg, stain: e.target.value })} placeholder="Custom color name (optional)" className={textCls} />
      ) : (
        <select value={STAIN_COLORS.includes(cfg.stain) ? cfg.stain : ""} onChange={(e) => set({ ...cfg, stain: e.target.value })} className={selectCls}>
          <option value="">Pick color…</option>
          {STAIN_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
    </div>
  );
}

// Sheen: 30/20/15/10/5 + custom. `note` (e.g. the $250 hint) shows beside the
// label; `warn` renders under the control when a fee applies.
function SheenPicker({ cfg, set, note, warn }) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5 mb-1"><span className="ft-eyebrow text-[10px]">Sheen</span>{note && <span className="text-[9.5px] text-slate-400 font-medium">{note}</span>}</div>
      <select value={cfg.sheenCustom ? "__c" : cfg.sheen} onChange={(e) => { const v = e.target.value; if (v === "__c") set({ ...cfg, sheenCustom: true }); else set({ ...cfg, sheenCustom: false, sheen: v }); }} className={selectCls}>
        {SHEENS.map((s) => <option key={s} value={s}>{s}-sheen</option>)}
        <option value="__c">Custom…</option>
      </select>
      {cfg.sheenCustom && (
        <input type="number" min="0" value={cfg.sheen} onChange={(e) => set({ ...cfg, sheen: e.target.value })} placeholder="e.g. 25" className={textCls + " mt-1.5"} />
      )}
      {warn && <div className="mt-1.5 text-[11px] font-bold text-amber-700">⚠ {warn}</div>}
    </div>
  );
}

// --- per-mode option rails ----------------------------------------------------

// A species/grade/construction change can land on a width the new combo doesn't
// offer — snap to the first offered one so the build never goes dead silently.
const snapFloorW = (f) => {
  if (floorBase(f) != null) return f;
  const w = floorWidths(f).find((w2) => floorBase({ ...f, w: w2 }) != null);
  return w != null ? { ...f, w } : f;
};

function FloorRail({ f, set, sf, markup, onGrid, multi, mwWidths, onMultiToggle, onMwWidth, onStep }) {
  const sell = (c) => (c ? fm(sellOf(c.cost, markup)) + "/sf" : "—");
  const custom = CUSTOM_FINISHES.includes(f.finish);
  const established = f.finish === "est";
  const prefin = f.finish !== "unf";
  const stained = established || custom;
  return (<>
    <Sect title="Species" hint="sell $/sf at current options">
      <Chips cur={f.sp} onPick={(sp) => set(snapFloorW({ ...f, sp }))}
        items={SPECIES.map((sp) => {
          const probe = snapFloorW({ ...f, sp });
          const c = calcFloor(probe, sf);
          return { id: sp, label: sp, sub: c ? sell(c) + (probe.w !== f.w ? " @" + WIDTH_LABEL[probe.w] : "") : "—", dis: !c };
        })} />
    </Sect>
    {/* Construction (left) + Grade, with the price grid pushed to the right */}
    <div className="mb-4 flex items-end gap-4 flex-wrap">
      <div>
        <div className="ft-eyebrow text-[10px] mb-1.5">Construction</div>
        <Seg opts={[{ id: "solid", label: "Solid" }, { id: "eng", label: "Eng." }]} cur={f.cons} onPick={(cons) => set(snapFloorW({ ...f, cons }))} />
      </div>
      <div>
        <div className="ft-eyebrow text-[10px] mb-1.5">Grade</div>
        {f.sp === LIVE_SAWN_SP
          ? <Seg opts={[{ id: "ls", label: "Live Sawn" }]} cur="ls" onPick={() => {}} />
          : <Seg opts={[{ id: "clear", label: "Clear" }, { id: "char", label: "Char." }]} cur={f.grade} onPick={(grade) => set(snapFloorW({ ...f, grade }))} />}
      </div>
      <div className="ml-auto self-end"><GridButton onClick={onGrid} /></div>
    </div>
    <Sect title="Width">
      <WidthRow items={floorWidths(f).map((w) => { const c = calcFloor({ ...f, w }, sf); return { id: w, label: WIDTH_LABEL[w], sub: c ? sell(c) : "—", dis: !c }; })}
        cur={f.w} multi={multi} selected={mwWidths} count={mwWidths.length}
        onPick={(w) => set({ ...f, w: +w })} onToggle={onMwWidth} onMultiToggle={onMultiToggle} onStep={onStep} />
    </Sect>
    {/* Texture + Finishing on one row. When a prefinished finish is chosen its
        stain/sheen detail drops in right below — green-outlined to tie it to
        the Finishing control — pushing Lengths/Edge down. The +$ adders show
        retail (marked up), matching the sell-price chips above. */}
    <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-3">
      <Dropdown label="Texture / scrape" value={f.tex} onChange={(tex) => set({ ...f, tex })}
        options={TEXTURES.map((t) => ({ id: t.id, label: t.name.replace(" (standard)", "") + (t.add ? `  +${fm(sellOf(t.add, markup))}` : "") }))} />
      <Dropdown label="Finishing" hint="fee under 500 sf" value={f.finish} onChange={(finish) => set({ ...f, finish })}
        options={FINISHES.map((x) => ({ id: x.id, label: x.name + (x.id === "unf" ? "" : `  +${fm(sellOf(x.add(f), markup))}`) }))} />
    </div>
    {/* Prefinished finishes: stain color (established/custom) + sheen. Sheen is
        free on this custom/floor tab — no fee, it's made to order regardless. */}
    {prefin && (
      <div className="mb-3 rounded-lg border-2 p-3" style={{ borderColor: "var(--ft-brand)", background: "var(--ft-tint)" }}>
        <div className={`grid gap-3 ${stained ? "grid-cols-2" : "grid-cols-1"}`}>
          {stained && <StainPicker cfg={f} set={set} custom={custom} />}
          <SheenPicker cfg={f} set={set} note="· included, no charge" />
        </div>
      </div>
    )}
    <div className="mb-4 grid grid-cols-2 gap-x-3 gap-y-3">
      <Dropdown label="Lengths" value={f.len} onChange={(len) => set({ ...f, len })}
        options={LENGTHS.map((l) => ({ id: l.id, label: l.name.replace(" (standard)", "") + (l.pct ? `  +${l.pct}%` : "") }))} />
      <Dropdown label="Edge" value={f.edge} onChange={(edge) => set({ ...f, edge })}
        options={EDGES.map((e) => ({ id: e.id, label: e.name + (e.add ? `  +${fm(sellOf(e.add, markup))}` : "") }))} />
    </div>
    {NO_SAP[f.sp] != null && (
      <Sect title="Sap">
        <Toggle label={`No sap — ${f.sp}`} on={f.noSap} onClick={() => set({ ...f, noSap: !f.noSap })} add={`+${fm(sellOf(NO_SAP[f.sp], markup))}/sf`} />
      </Sect>
    )}
    {custom && (
      <Sect title="Custom color sample">
        <div className="w-full flex items-center gap-2.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800">
          <span className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-extrabold text-white shrink-0 bg-indigo-600">✓</span>
          <span className="flex-1">Color-match sample — required for custom colors</span>
          <span className="text-[11.5px] font-bold text-slate-500 tabular-nums">+$750 flat</span>
        </div>
      </Sect>
    )}
    {established && (
      <Sect title="Color-match sample">
        <Toggle label="Color-match sample — approval bundle (optional)" on={f.sample} onClick={() => set({ ...f, sample: !f.sample })} add="+$750 flat" />
      </Sect>
    )}
  </>);
}

function StockedRail({ k, set, sf, markup, onGrid, multi, mwWidths, onMultiToggle, onMwWidth, onStep }) {
  const it = stockedItem(k) || STOCKED[0];
  const species = [...new Set(STOCKED.map((x) => x.sp))];
  const colorsFor = (sp) => STOCKED.filter((x) => x.sp === sp);
  // Picking a species/color/grade the current width doesn't come in snaps it.
  const snap = (next) => {
    const nit = stockedItem(next);
    if (!nit) return next;
    if (!nit[next.grade]) next = { ...next, grade: nit.clear ? "clear" : "char" };
    const ws = STOCKED_WIDTHS[next.grade];
    if (!ws.includes(next.w) || nit[next.grade][ws.indexOf(next.w)] == null) {
      const w = ws.find((w2) => nit[next.grade][ws.indexOf(w2)] != null);
      if (w != null) next = { ...next, w };
    }
    return next;
  };
  // Changing species/color resets the sheen to that product's standard.
  const pickSpecies = (sp) => { const c = colorsFor(sp)[0]; set(snap({ ...k, sp, color: c.color, sheen: String(c.sheen), sheenCustom: false })); };
  const pickColor = (color) => { const nit = STOCKED.find((x) => x.sp === k.sp && x.color === color); set(snap({ ...k, color, sheen: String(nit.sheen), sheenCustom: false })); };
  const std = it.sheen;
  const curSheen = k.sheenCustom ? k.sheen : (k.sheen ?? String(std));
  const changed = k.sheenCustom ? (k.sheen !== "" && Number(k.sheen) !== std) : (Number(k.sheen ?? std) !== std);
  return (<>
    <Sect title="Species" hint="ships from stock">
      <Chips cur={k.sp} onPick={pickSpecies} items={species.map((sp) => ({ id: sp, label: sp }))} />
    </Sect>
    <Sect title="Color" hint={`${colorsFor(k.sp).length} in ${k.sp}`}>
      <Chips cur={k.color} onPick={pickColor}
        items={colorsFor(k.sp).map((x) => ({ id: x.color, label: x.color.replace(/ · /g, " "), sub: (x.tex ? "textured · " : "") + x.sheen + "-sheen" }))} />
    </Sect>
    {/* Grade centered, with the price grid button beside it */}
    <div className="mb-4">
      <div className="ft-eyebrow text-[10px] mb-1.5 text-center">Grade</div>
      <div className="flex items-center justify-center gap-3">
        <Seg cur={k.grade} onPick={(grade) => set(snap({ ...k, grade }))}
          opts={[{ id: "clear", label: "Clear", dis: !it.clear }, { id: "char", label: "Character", dis: !it.char }]} />
        <GridButton onClick={onGrid} />
      </div>
    </div>
    <Sect title="Width">
      <WidthRow items={STOCKED_WIDTHS[k.grade].map((w) => { const c = calcStocked({ ...k, w }); return { id: w, label: WIDTH_LABEL[w], sub: c ? fm(sellOf(c.cost, markup)) + "/sf" : "—", dis: !c }; })}
        cur={k.w} multi={multi} selected={mwWidths} count={mwWidths.length}
        onPick={(w) => set({ ...k, w: +w })} onToggle={onMwWidth} onMultiToggle={onMultiToggle} onStep={onStep} />
    </Sect>
    <Sect title="Sheen">
      <SheenPicker cfg={k} set={set} note={`standard ${std} · +$${SHEEN_FEE} if changed`}
        warn={changed ? `Non-standard sheen (${curSheen} vs ${std}) — adds a $${SHEEN_FEE} flat line at cost.` : null} />
    </Sect>
  </>);
}

function HbRail({ h, set, markup, onGrid, onCopyFloor, copySrc }) {
  const snap = (next) => {
    const t = HERRINGBONE[next.cons === "solid" ? "solid" : "eng"][next.sp];
    return t.ws.includes(next.w) ? next : { ...next, w: t.ws[Math.min(2, t.ws.length - 1)] };
  };
  const table = HERRINGBONE[h.cons === "solid" ? "solid" : "eng"][h.sp];
  const len = hbSlatLen(h);
  const band = len != null ? hbBandForLen(len) : (Number.isFinite(h.band) ? h.band : null);
  const custom = CUSTOM_FINISHES.includes(h.finish);
  const established = h.finish === "est";
  const prefin = h.finish && h.finish !== "unf";
  const stained = established || custom;
  return (<>
    {onCopyFloor && (
      <div className="mb-4 flex items-center gap-2.5 rounded-lg p-2.5" style={{ border: "1px dashed var(--ft-brand)", background: "var(--ft-tint)" }}>
        <span className="flex-1 text-[11px] font-medium text-slate-600 leading-snug">Match the floor — copy species, grade, construction, width, scrape, edge &amp; stain from the <b>{copySrc}</b> tab.</span>
        <button onClick={onCopyFloor} className="shrink-0 rounded-md border bg-white px-3 py-1.5 text-xs font-bold text-[color:var(--ft-brand-deep)] hover:bg-slate-50" style={{ borderColor: "var(--ft-brand)" }}>⤺ Copy floor</button>
      </div>
    )}
    <Sect title="Species">
      <Chips cur={h.sp} onPick={(sp) => set(snap({ ...h, sp }))}
        items={Object.keys(HERRINGBONE.solid).map((sp) => {
          const p = snap({ ...h, sp });
          const c = calcHerringbone(p);
          return { id: sp, label: sp, sub: c ? fm(sellOf(c.cost, markup)) + "/sf" : "—" };
        })} />
    </Sect>
    <div className="mb-4 flex items-end gap-4 flex-wrap">
      <div>
        <div className="ft-eyebrow text-[10px] mb-1.5">Construction</div>
        <Seg opts={[{ id: "solid", label: "Solid" }, { id: "eng", label: "Engineered" }]} cur={h.cons} onPick={(cons) => set(snap({ ...h, cons }))} />
      </div>
      <div>
        {/* Grade is order text only — no clear/char price split in the sheet. */}
        <div className="ft-eyebrow text-[10px] mb-1.5">Grade</div>
        <Seg opts={[{ id: "clear", label: "Clear" }, { id: "char", label: "Char." }]} cur={h.grade === "clear" ? "clear" : "char"} onPick={(grade) => set({ ...h, grade })} />
      </div>
    </div>
    <Sect title="Width" extra={<button onClick={onGrid} className="text-[11px] font-bold text-indigo-700 underline underline-offset-2">full price grid →</button>}>
      {/* Every width in the run stays pickable — before a length is typed there
          is no price yet, but the width choice must not be blocked on it. */}
      <Chips cur={h.w} onPick={(w) => set({ ...h, w: +w })}
        items={table.ws.map((w) => { const c = calcHerringbone({ ...h, w }); return { id: w, label: WIDTH_LABEL[w], sub: c ? fm(sellOf(c.cost, markup)) + "/sf" : "—" }; })} />
    </Sect>
    <Sect title="Slat length" hint="type it — the tier prices it">
      <div className="flex items-center gap-2 mb-2">
        <input type="number" min="0" step="0.25" value={h.slatLen} placeholder="—" data-sheoga-slatlen
          onChange={(e) => set({ ...h, slatLen: e.target.value })}
          className="w-24 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-bold text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <span className="text-xs font-bold text-slate-500">inches</span>
        <span className="text-[10.5px] text-slate-400 font-medium leading-tight">
          {len != null
            ? <>prices as the <b className="text-indigo-700">{HERRINGBONE.bands[band]}</b> tier · order prints {h.slatLen}"</>
            : "enter the slat length you want"}
        </span>
      </div>
      {/* The price tiers, shown for reference only — the typed length picks one. */}
      <div className="flex flex-wrap gap-1.5">
        {HERRINGBONE.bands.map((b, i) => {
          const c = calcHerringbone({ ...h, band: i, slatLen: "" });
          const on = i === band;
          return (
            <div key={i} className={`rounded-md border px-2.5 py-1.5 text-xs font-bold leading-tight text-center select-none ${on ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 bg-white text-slate-500"}`}>
              {b}
              <span className={`block text-[10px] font-semibold ${on ? "text-white/70" : "text-slate-400"}`}>{c ? fm(sellOf(c.cost, markup)) + "/sf" : "—"}</span>
            </div>
          );
        })}
      </div>
    </Sect>
    <Sect title="Pattern">
      <Toggle label="Chevron pattern (slip tongue included)" on={h.chevron} onClick={() => set({ ...h, chevron: !h.chevron })} add={`+${fm(sellOf(CHEVRON_ADD, markup))}/sf`} />
    </Sect>
    {/* Scrape + finishing + edge, same options and $/sf adders as the custom
        floor tab. A prefinished finish drops its stain/sheen detail in below
        (sheen free); established/custom colors owe the $750 sample. */}
    <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-3">
      <Dropdown label="Texture / scrape" value={h.tex || "smooth"} onChange={(tex) => set({ ...h, tex })}
        options={TEXTURES.map((t) => ({ id: t.id, label: t.name.replace(" (standard)", "") + (t.add ? `  +${fm(sellOf(t.add, markup))}` : "") }))} />
      <Dropdown label="Finishing" hint="fee under 500 sf" value={h.finish || "unf"} onChange={(finish) => set({ ...h, finish })}
        options={FINISHES.map((x) => ({ id: x.id, label: x.name + (x.id === "unf" ? "" : `  +${fm(sellOf(x.add(h), markup))}`) }))} />
    </div>
    {prefin && (
      <div className="mb-3 rounded-lg border-2 p-3" style={{ borderColor: "var(--ft-brand)", background: "var(--ft-tint)" }}>
        <div className={`grid gap-3 ${stained ? "grid-cols-2" : "grid-cols-1"}`}>
          {stained && <StainPicker cfg={h} set={set} custom={custom} />}
          <SheenPicker cfg={h} set={set} note="· included, no charge" />
        </div>
      </div>
    )}
    <div className="mb-4 grid grid-cols-2 gap-x-3 gap-y-3">
      <Dropdown label="Edge" value={h.edge || "square"} onChange={(edge) => set({ ...h, edge })}
        options={EDGES.map((e) => ({ id: e.id, label: e.name + (e.add ? `  +${fm(sellOf(e.add, markup))}` : "") }))} />
    </div>
    {custom && (
      <Sect title="Custom color sample">
        <div className="w-full flex items-center gap-2.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800">
          <span className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-extrabold text-white shrink-0 bg-indigo-600">✓</span>
          <span className="flex-1">Color-match sample — required for custom colors</span>
          <span className="text-[11.5px] font-bold text-slate-500 tabular-nums">+$750 flat</span>
        </div>
      </Sect>
    )}
    {established && (
      <Sect title="Color-match sample">
        <Toggle label="Color-match sample — approval bundle (optional)" on={h.sample} onClick={() => set({ ...h, sample: !h.sample })} add="+$750 flat" />
      </Sect>
    )}
  </>);
}

// Light-green shades per duct width, so the size buttons group visually (all the
// 6"-wide sizes share one tint, the 8"-wide another…). Deeper as the duct widens.
const VENT_W_TINT = { 2.25: "#eff5e6", 4: "#e6f0d5", 6: "#dcebc7", 8: "#d3e6ba", 10: "#cbe1ae", 12: "#c2dca1" };
const ventWidthTint = (size) => VENT_W_TINT[ventDims(size)[0]] || undefined;

function VentRail({ v, set, markup, onGrid, onCopyFloor, copySrc }) {
  const cat = VENT_CATS.find((c) => c.id === v.cat);
  const snapSize = (next) => {
    const c2 = VENT_CATS.find((c) => c.id === next.cat);
    return c2.list().some((r) => r[0] === next.size) ? next : { ...next, size: c2.list()[0][0] };
  };
  return (<>
    {onCopyFloor && (
      <div className="mb-4 flex items-center gap-2.5 rounded-lg p-2.5" style={{ border: "1px dashed var(--ft-brand)", background: "var(--ft-tint)" }}>
        <span className="flex-1 text-[11px] font-medium text-slate-600 leading-snug">Vents usually match the floor — copy species, scrape &amp; stain from the <b>{copySrc}</b> tab.</span>
        <button onClick={onCopyFloor} className="shrink-0 rounded-md border bg-white px-3 py-1.5 text-xs font-bold text-[color:var(--ft-brand-deep)] hover:bg-slate-50" style={{ borderColor: "var(--ft-brand)" }}>⤺ Copy floor</button>
      </div>
    )}
    <Sect title="Species" hint="A: cherry/hickory/beech/red oak">
      <Chips cur={v.sp} onPick={(sp) => set({ ...v, sp })}
        items={Object.keys(VENT_GROUP).map((sp) => ({ id: sp, label: sp, sub: "group " + VENT_GROUP[sp] }))} />
    </Sect>
    <Sect title="Vent type">
      <RadioList cur={v.cat} onPick={(id) => set(snapSize({ ...v, cat: id }))}
        items={VENT_CATS.map((c) => ({ id: c.id, label: c.name }))} />
    </Sect>
    <Sect title="Size (duct W × L)" hint="shaded by duct width" extra={<button onClick={onGrid} className="text-[11px] font-bold text-indigo-700 underline underline-offset-2">full grid →</button>}>
      <Chips cur={v.size} onPick={(size) => set({ ...v, size })}
        items={cat.list().map((row) => { const c = calcVent({ ...v, size: row[0] }); return { id: row[0], label: row[0] + '"', sub: c ? fm(sellOf(c.cost, markup)) : "—", bg: ventWidthTint(row[0]) }; })} />
    </Sect>
    <Sect title="Options">
      {cat.cubed && <Toggle label="Cubed grille" on={v.cubed} onClick={() => set({ ...v, cubed: !v.cubed })} add={`+${fm(sellOf(VENT_CUBED, markup))}`} />}
      <Toggle label="Prefinished" on={v.prefin} onClick={() => set({ ...v, prefin: !v.prefin })} add={`+${fm(sellOf(VENT_PREFIN, markup))}`} />
      {v.prefin && (
        <div className="mt-1.5 mb-1.5 ml-[26px]">
          <div className="flex items-baseline gap-1.5 mb-1"><span className="ft-eyebrow text-[10px]">Stain color</span><span className="text-[9.5px] text-slate-400 font-medium">included in the prefinish charge</span></div>
          <select value={v.stainCustom ? "__c" : (STAIN_COLORS.includes(v.stain) ? v.stain : "")}
            onChange={(e) => { const val = e.target.value; if (val === "__c") set({ ...v, stainCustom: true }); else set({ ...v, stainCustom: false, stain: val }); }} className={selectCls}>
            <option value="">Pick color…</option>
            {STAIN_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__c">Custom…</option>
          </select>
          {v.stainCustom && <input value={v.stain} onChange={(e) => set({ ...v, stain: e.target.value })} placeholder="Custom color name" className={textCls + " mt-1.5"} />}
        </div>
      )}
      <Toggle label="Textured" on={v.tex} onClick={() => set({ ...v, tex: !v.tex })} add={`+${fm(sellOf(VENT_TEX, markup))}`} />
      {v.tex && (
        <div className="mt-1.5 mb-1.5 ml-[26px]">
          <div className="flex items-baseline gap-1.5 mb-1"><span className="ft-eyebrow text-[10px]">Scrape / texture</span><span className="text-[9.5px] text-slate-400 font-medium">any scrape, same flat charge</span></div>
          <select value={ventScrape(v) ? v.scrape : ""} onChange={(e) => set({ ...v, scrape: e.target.value })} className={selectCls}>
            <option value="">Textured (unspecified)</option>
            {TEXTURES.filter((t) => t.id !== "smooth").map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      {DAMPERS[v.size] && <Toggle label="Attach damper" on={v.damper} onClick={() => set({ ...v, damper: !v.damper })} add={`+${fm(sellOf(DAMPERS[v.size][1] + DAMPER_ATTACH, markup))}`} />}
      {cat.frame && <Toggle label="Add frame ($0.40 / lineal inch)" on={v.frame} onClick={() => set({ ...v, frame: !v.frame })} add={`+${fm(sellOf(0.4 * frameLineal(v.size), markup))}`} />}
    </Sect>
    <Sect title="Quantity"><QtyInput value={v.qty} onChange={(qty) => set({ ...v, qty })} /></Sect>
  </>);
}

function DamperRail({ d, set, markup }) {
  return (<>
    <Sect title="Size" hint="sell each at markup">
      <Chips cur={d.size} onPick={(size) => set({ ...d, size })}
        items={Object.keys(DAMPERS).map((sz) => ({ id: sz, label: sz + '"', sub: fm(sellOf(DAMPERS[sz][1], markup)) }))} />
    </Sect>
    <Sect title="Quantity"><QtyInput value={d.qty} onChange={(qty) => set({ ...d, qty })} /></Sect>
    <p className="text-[11px] text-slate-400 leading-relaxed font-medium">Loose dampers. To price a damper attached to a vent (+$5 attach), use the Wood vents tab.</p>
  </>);
}

// --- full price grids ---------------------------------------------------------

const gridBtn = "w-full px-2 py-1.5 text-right tabular-nums rounded hover:bg-indigo-50";
const gridCur = "bg-slate-900 text-white hover:bg-slate-900";

function GridModal({ mode, cfg, onPick, onClose }) {
  let title = "", body = null;
  const th = "px-2 py-1.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300 bg-slate-100 first:text-left";
  const tdName = "px-2 py-1.5 text-left text-xs font-bold whitespace-nowrap";
  if (mode === "floor") {
    const cols = WIDTHS.concat([9.25, 11.25]);
    title = `Full price grid — ${cfg.grade === "clear" ? "Clear" : "Character"}, ${cfg.cons === "solid" ? "Solid" : "Engineered"}`;
    body = (
      <table className="w-full border-collapse">
        <thead><tr><th className={th}>Species</th>{cols.map((w) => <th key={w} className={th}>{WIDTH_LABEL[w]}</th>)}</tr></thead>
        <tbody>
          {SPECIES.map((sp) => (
            <tr key={sp} className="border-b border-slate-100">
              <td className={tdName}>{sp}</td>
              {cols.map((w) => {
                const p = floorBase({ ...cfg, sp, w });
                if (p == null) return <td key={w} className="px-2 py-1.5 text-right text-slate-300">—</td>;
                const cur = sp === cfg.sp && w === cfg.w;
                return <td key={w} className="text-xs font-semibold"><button onClick={() => onPick({ sp, w })} className={`${gridBtn} ${cur ? gridCur : ""}`}>{p.toFixed(2)}</button></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else if (mode === "stocked") {
    const ws = STOCKED_WIDTHS.char;
    title = "Stocked prefinished — full grid";
    body = (
      <table className="w-full border-collapse">
        <thead><tr><th className={th}>Color</th><th className={th}></th>{ws.map((w) => <th key={w} className={th}>{WIDTH_LABEL[w]}</th>)}</tr></thead>
        <tbody>
          {STOCKED.flatMap((it) => ["clear", "char"].filter((g) => it[g]).map((g) => (
            <tr key={`${it.sp}|${it.color}|${g}`} className="border-b border-slate-100">
              <td className={tdName}>{it.sp} — {it.color}{it.sheen !== 30 && <span className="text-slate-400 font-medium"> ({it.sheen})</span>}</td>
              <td className="px-1 py-1.5 text-[10px] text-slate-400 font-semibold">{g === "clear" ? "C" : "Ch"}</td>
              {ws.map((w) => {
                const wi = STOCKED_WIDTHS[g].indexOf(w);
                const p = wi < 0 ? null : it[g][wi];
                if (p == null) return <td key={w} className="px-2 py-1.5 text-right text-slate-300">—</td>;
                const cur = it.sp === cfg.sp && it.color === cfg.color && g === cfg.grade && w === cfg.w;
                return <td key={w} className="text-xs font-semibold"><button onClick={() => onPick({ sp: it.sp, color: it.color, grade: g, w })} className={`${gridBtn} ${cur ? gridCur : ""}`}>{p.toFixed(2)}</button></td>;
              })}
            </tr>
          )))}
        </tbody>
      </table>
    );
  } else if (mode === "hb") {
    const t = HERRINGBONE[cfg.cons === "solid" ? "solid" : "eng"][cfg.sp];
    // The tier row isn't selectable — the typed slat length picks it. A cell
    // click selects its width only; the highlight follows the length's tier.
    const len = hbSlatLen(cfg);
    const curBand = len != null ? hbBandForLen(len) : (Number.isFinite(cfg.band) ? cfg.band : null);
    title = `Herringbone — ${cfg.sp}, ${cfg.cons === "solid" ? "Solid" : "Engineered"}`;
    body = (
      <table className="w-full border-collapse">
        <thead><tr><th className={th}>Slat length</th>{t.ws.map((w) => <th key={w} className={th}>{WIDTH_LABEL[w]}</th>)}</tr></thead>
        <tbody>
          {HERRINGBONE.bands.map((b, bi) => (
            <tr key={b} className="border-b border-slate-100">
              <td className={tdName}>{b}</td>
              {t.ws.map((w, wi) => {
                const cur = bi === curBand && w === cfg.w;
                return <td key={w} className="text-xs font-semibold"><button onClick={() => onPick({ w })} className={`${gridBtn} ${cur ? gridCur : ""}`}>{t.p[bi][wi].toFixed(2)}</button></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else {
    // vents & dampers: the current category's group table, three columns across
    const isVent = mode === "vent";
    const g = isVent ? VENT_GROUP[cfg.sp] : "A";
    const cat = isVent ? VENT_CATS.find((c) => c.id === cfg.cat) : VENT_CATS[0];
    const rows = cat.list();
    const per = Math.ceil(rows.length / 3);
    title = `${cat.name} vents — group ${g}`;
    body = (
      <table className="w-full border-collapse">
        <thead><tr>{[0, 1, 2].map((i) => <Fragment2 key={i}><th className={th + " text-left"}>Size</th><th className={th}>Cost</th></Fragment2>)}</tr></thead>
        <tbody>
          {Array.from({ length: per }, (_, i) => (
            <tr key={i} className="border-b border-slate-100">
              {[0, 1, 2].map((cix) => {
                const r = rows[i + cix * per];
                if (!r) return <Fragment2 key={cix}><td /><td /></Fragment2>;
                const cur = isVent && r[0] === cfg.size;
                return (
                  <Fragment2 key={cix}>
                    <td className={tdName}>{r[0]}"</td>
                    <td className="text-xs font-semibold"><button onClick={() => isVent && onPick({ size: r[0] })} className={`${gridBtn} ${cur ? gridCur : ""}`}>{r[cat.col(g)].toFixed(2)}</button></td>
                  </Fragment2>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <div className="print:hidden fixed inset-0 flex items-center justify-center p-4 z-[80]" style={{ background: "rgba(20,15,10,.5)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[86vh] overflow-auto border border-slate-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center gap-2.5 px-4 py-3 border-b border-slate-200 bg-white">
          <span className="text-sm font-extrabold">{title}</span>
          <span className="text-[11px] text-slate-400 font-semibold">distributor cost · click to select</span>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="p-4">{body}</div>
      </div>
    </div>
  );
}
// React.Fragment that tolerates a key prop list in the vent grid loops.
const Fragment2 = ({ children }) => <>{children}</>;

// --- shared build card --------------------------------------------------------
// The cost -> sell breakdown, shown in the desktop right pane and inside the
// mobile pull-up sheet. `showActions` keeps the grid/Add buttons on desktop;
// the mobile sheet renders those in its own pinned footer instead.
function BuildCard({ c, sell, activeMarkup, isEa, qty, ctn, feesTot, jobTot, sf, onGrid, onAdd, onAddBasket, showActions = true }) {
  return (
    <div className="rounded-lg border overflow-hidden bg-white" style={{ borderColor: "var(--ft-grid-line)" }}>
      <div className="flex items-center gap-2 px-3.5 py-2" style={{ background: "var(--ft-sand)" }}>
        <span className="w-5 h-5 rounded text-[10px] font-extrabold text-white flex items-center justify-center" style={{ background: "var(--ft-brand-deep)" }}>H</span>
        <span className="text-[13px] font-extrabold flex-1">{c.name}</span>
        <span className="text-[9.5px] text-slate-500 font-semibold">{SHEET_NOTE}</span>
      </div>
      <div className="px-3.5 pt-2.5 text-[15px] font-bold leading-snug" data-sheoga-desc>{c.desc}</div>
      <div className="px-3.5 pb-3">
        {c.rows.map(([l, a], i) => (
          <div key={i} className="flex items-baseline gap-2 py-[3px] text-xs text-slate-500 font-medium">
            <span className="flex-1 min-w-0">{l}</span><span className="tabular-nums font-semibold text-slate-800">{a}</span>
          </div>
        ))}
        {ctn && (
          <div className="flex items-baseline gap-2 py-[3px] text-xs text-slate-500 font-medium">
            <span className="flex-1">Sold by full cartons — {ctn.sf} sf/carton</span>
            <span className="tabular-nums font-semibold text-slate-800">{ctn.cartons} ctns · exact {ctn.exact.toFixed(2)}</span>
          </div>
        )}
        {c.warn.map((w, i) => <div key={i} className="py-[3px] text-xs font-semibold text-amber-700">⚠ {w}</div>)}
      </div>
      <div className="flex items-center gap-4 px-3.5 py-2.5 border-t border-slate-300" style={{ background: "var(--ft-sand)" }}>
        <div className="leading-tight"><div className="ft-eyebrow text-[8.5px]">our cost</div><div className="text-base font-extrabold tabular-nums">{fm(c.cost)}{isEa ? " ea" : "/sf"}</div></div>
        <div className="text-xs text-slate-400">→ +{activeMarkup}% →</div>
        <div className="leading-tight"><div className="ft-eyebrow text-[8.5px]">sell</div><div className="text-xl font-extrabold tabular-nums" style={{ color: "var(--ft-brand-deep)" }} data-sheoga-sell>{fm(sell)}{isEa ? " ea" : "/sf"}</div></div>
        <div className="ml-auto text-right leading-tight">
          <div className="ft-eyebrow text-[8.5px]">{isEa ? `× ${qty} pcs` : ctn ? `${ctn.cartons} ctns × ${ctn.sf} sf = ${ctn.billedSf} sf` : `× ${sf} sq ft`}{feesTot ? ` + ${fm(feesTot)} fees` : ""}</div>
          <div className="text-base font-extrabold tabular-nums">{fmInt(jobTot)}</div>
        </div>
      </div>
      {(c.fees || []).length > 0 && (
        <div className="px-3.5 py-2 border-t border-dashed border-slate-300">
          {c.fees.map((x, i) => (
            <div key={i} className="flex items-baseline gap-2 py-[2px] text-[11px] text-slate-500 font-medium">
              <span className="flex-1">{x.label} — imports as its own line, at cost</span><span className="tabular-nums font-semibold">{fm(x.amt)}</span>
            </div>
          ))}
        </div>
      )}
      {showActions && (
        <div className="flex gap-2 px-3.5 py-2.5 border-t border-slate-200">
          <button onClick={onGrid} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"><Grid3X3 size={13} /> Full price grid</button>
          <button onClick={onAddBasket} className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"><Plus size={13} /> Add to basket</button>
          <button onClick={onAdd} className="rounded-md bg-indigo-600 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5" data-sheoga-add><Plus size={13} /> Add to product line{(c.fees || []).length ? "s" : ""}</button>
        </div>
      )}
    </div>
  );
}

// --- multi-width build card ---------------------------------------------------
// Same cost -> sell shape as BuildCard, one row per selected width instead of
// one product. Shares are editable inline; sf/line/bundle total recompute live
// off multiWidthBuild. Setup fees (small-order, sample, non-standard sheen)
// pool to a single shared line instead of repeating per width.
function MultiWidthCard({ base, widths, shares, sf, markup, onShare, onAddBasket, onMove, showActions = true }) {
  const wlist = widths.map((w) => ({ w, share: shares[w] ?? 0 }));
  const b = useMemo(() => multiWidthBuild(base, wlist, sf), [base, JSON.stringify(wlist), sf]);
  const ok = b.lines.filter((l) => l.ok);
  const linesTot = ok.reduce((a, l) => a + Math.round(sellOf(l.cost, markup) * l.sf), 0);
  const feesTot = b.fees.reduce((a, x) => a + x.amt, 0);
  const total = linesTot + feesTot;
  return (
    <div className="rounded-lg border overflow-hidden bg-white" style={{ borderColor: "var(--ft-grid-line)" }}>
      <div className="flex items-center gap-2 px-3.5 py-2" style={{ background: "var(--ft-sand)" }}>
        <span className="w-5 h-5 rounded text-[10px] font-extrabold text-white flex items-center justify-center" style={{ background: "var(--ft-brand-deep)" }}>H</span>
        <span className="text-[13px] font-extrabold flex-1">Multi-width — {base.cfg.sp} floor</span>
      </div>
      <div className="px-3.5 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 flex">
        <span className="w-11">Width</span><span className="w-16">Share</span><span className="w-16">Sq ft</span><span className="w-14">Sell</span><span className="ml-auto">Line</span>
      </div>
      <div className="px-3.5">
        {b.lines.map((l) => (
          <div key={l.w} className={`flex items-center gap-2 py-1.5 border-t border-slate-100 ${l.ok ? "" : "opacity-40"}`}>
            <span className="w-11 font-extrabold text-[13px]">{WIDTH_LABEL[l.w]}</span>
            <span className="inline-flex items-center rounded-md border border-slate-300 overflow-hidden bg-white">
              <input type="number" min="0" max="100" value={shares[l.w] ?? 0} onChange={(e) => onShare(l.w, e.target.value)}
                className="w-11 px-1.5 py-1 text-xs font-bold text-right focus:outline-none" /><span className="px-1.5 text-[11px] font-bold text-slate-400">%</span>
            </span>
            <span className="w-16 text-[11px] font-semibold text-slate-500">{l.ok ? `${l.sf} sf` : "n/a"}</span>
            <span className="w-14 text-[11px] font-semibold text-slate-400">{l.ok ? fm(sellOf(l.cost, markup)) : "—"}</span>
            <span className="ml-auto font-extrabold tabular-nums text-[13px]">{l.ok ? fmInt(Math.round(sellOf(l.cost, markup) * l.sf)) : "—"}</span>
          </div>
        ))}
      </div>
      {b.fees.length > 0 && (
        <div className="px-3.5 py-2 border-t border-dashed border-slate-300">
          {b.fees.map((x, i) => (
            <div key={i} className="flex items-baseline gap-2 py-[2px] text-[11.5px] font-semibold" style={{ color: "var(--ft-brand-deep)" }}>
              <span className="flex-1">{x.label} — one line, shared across widths</span><span className="tabular-nums">+{fmInt(x.amt)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-4 px-3.5 py-2.5 border-t border-slate-300" style={{ background: "var(--ft-sand)" }}>
        <div className="leading-tight"><div className="ft-eyebrow text-[8.5px]">{ok.length} width lines</div><div className="text-base font-extrabold tabular-nums">{fmInt(linesTot)}</div></div>
        <div className="text-xs text-slate-400">+ pooled fees →</div>
        <div className="ml-auto text-right leading-tight"><div className="ft-eyebrow text-[8.5px]">bundle total · {sf} sq ft</div><div className="text-xl font-extrabold tabular-nums" style={{ color: "var(--ft-brand-deep)" }}>{fmInt(total)}</div></div>
      </div>
      {showActions && (
        <div className="flex gap-2 px-3.5 py-2.5 border-t border-slate-200">
          <button onClick={onAddBasket} disabled={!ok.length} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"><Plus size={13} /> Add bundle to basket</button>
          <button onClick={onMove} disabled={!ok.length} className="ml-auto rounded-md bg-indigo-600 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5"><Plus size={13} /> Add {ok.length} lines to product line</button>
        </div>
      )}
    </div>
  );
}

// --- mobile pull-up build sheet -----------------------------------------------
// The phone's price detail: a bottom sheet that slides up over the options and
// swipes back down (same gesture as the app's MobileSheet). Anchored to the
// configurator panel (absolute), so it never escapes the popup. Always mounted
// so the transform animates both ways.
function MobileBuildSheet({ open, onClose, children, footer }) {
  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const drag = useRef(null);
  useEffect(() => {
    const el = panelRef.current;
    if (!open || !el) return;
    const start = (e) => {
      const t = e.touches[0];
      const inBody = bodyRef.current?.contains(e.target);
      drag.current = { y0: t.clientY, x0: t.clientX, t0: e.timeStamp, armed: !inBody || (bodyRef.current?.scrollTop ?? 0) <= 0, on: false, dy: 0 };
    };
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      const t = e.touches[0];
      const dy = t.clientY - d.y0;
      if (!d.on) { if (!d.armed || dy < 10 || Math.abs(t.clientX - d.x0) > dy) return; d.on = true; }
      e.preventDefault();
      d.dy = Math.max(0, dy);
      el.style.transition = "none";
      el.style.transform = `translateY(${d.dy}px)`;
    };
    const end = (e) => {
      const d = drag.current;
      drag.current = null;
      if (!d?.on) return;
      el.style.transition = "transform .22s ease-out";
      if (d.dy > 90 || d.dy / Math.max(1, e.timeStamp - d.t0) > 0.6) { el.style.transform = "translateY(105%)"; setTimeout(onClose, 170); }
      else { el.style.transform = "translateY(0)"; }
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => { el.removeEventListener("touchstart", start); el.removeEventListener("touchmove", move); el.removeEventListener("touchend", end); el.removeEventListener("touchcancel", end); };
  }, [open, onClose]);
  return (
    <div className={`absolute inset-0 z-[60] ${open ? "" : "pointer-events-none"}`}>
      <div className="absolute inset-0 bg-black/40 transition-opacity duration-200" style={{ opacity: open ? 1 : 0 }} onClick={onClose} />
      <div ref={panelRef} className="absolute left-0 right-0 bottom-0 flex flex-col rounded-t-2xl"
        style={{ background: "var(--ft-cream)", maxHeight: "88%", boxShadow: "0 -8px 40px rgba(28,26,23,.28)", transform: open ? "translateY(0)" : "translateY(105%)", transition: "transform .26s cubic-bezier(.32,.72,0,1)" }}>
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full shrink-0" style={{ background: "var(--ft-border-strong, rgba(28,26,23,.25))" }} onClick={onClose} />
        <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto px-3 pt-2 pb-3">{children}</div>
        {footer && <div className="shrink-0 flex gap-2 px-3 pt-2.5 border-t border-slate-200" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>{footer}</div>}
      </div>
    </div>
  );
}

// Matches the app's 768px breakpoint; self-contained so the harness works too.
function useIsWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(min-width: 768px)").matches : true);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on); };
  }, []);
  return wide;
}

// --- shopping basket -----------------------------------------------------------
// A basket entry snapshots a single build or a multi-width bundle so it can sit
// alongside other configurations before any of them commit to a product line.
// basketEntryView derives the same cost -> sell numbers BuildCard/MultiWidthCard
// show live, plus a `lines()` thunk that yields the lineItems() payload for Move.
function basketEntryView(entry) {
  if (entry.kind === "bundle") {
    const b = multiWidthBuild(entry.base, entry.widths, entry.sf);
    const ok = b.lines.filter((l) => l.ok);
    const linesTot = ok.reduce((a, l) => a + Math.round(sellOf(l.cost, entry.markupPct) * l.sf), 0);
    const feesTot = b.fees.reduce((a, x) => a + x.amt, 0);
    return { title: `${entry.base.cfg.sp} — multi-width (${ok.length} widths)`, meta: `${entry.sf} sf total · one job`, price: linesTot + feesTot,
      subs: ok.map((l) => ({ label: `${WIDTH_LABEL[l.w]} · ${l.sf} sf`, amt: Math.round(sellOf(l.cost, entry.markupPct) * l.sf) })),
      fees: b.fees.map((x) => ({ label: x.label, amt: x.amt })), lines: () => multiWidthLineItems(entry.base, entry.widths, entry.sf, entry.markupPct) };
  }
  const c = calcConfig(entry.snap, entry.sf);
  const isEa = c && c.per === "ea";
  const price = c ? Math.round(sellOf(c.cost, entry.markupPct) * (isEa ? (c.qty || 1) : entry.sf)) : 0;
  return { title: `${c ? (c.size ? c.size + " " : "") + (c.rest || c.desc) : "build"}`, meta: isEa ? `${c?.qty || 1} pcs` : `${entry.sf} sf`, price, subs: [], fees: [], lines: () => lineItems(entry.snap, { sf: entry.sf, markupPct: entry.markupPct }) };
}

function BasketPanel({ basket, sel, onToggle, onRemove, onSelectAll, onMove, onMoveAll, areaName, onClose, isWide }) {
  const n = basket.length, selCount = basket.filter((b) => sel[b.id]).length;
  return (
    <div className="flex flex-col h-full">
      {!isWide && <div className="mx-auto mt-2 h-1.5 w-10 rounded-full shrink-0" style={{ background: "var(--ft-border-strong, rgba(28,26,23,.25))" }} onClick={onClose} />}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200">
        <span className="text-sm font-extrabold">Basket</span>
        <span className="text-[11px] text-slate-400 font-semibold">{n} item{n === 1 ? "" : "s"} · saved with this job</span>
        <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {n === 0 ? <div className="text-center text-xs font-semibold text-slate-400 py-10">Basket is empty. Build a config and "Add to basket".</div> :
          basket.map((entry) => { const v = basketEntryView(entry); const on = !!sel[entry.id]; return (
            <div key={entry.id} className={`flex gap-2.5 items-start rounded-lg border p-2.5 mb-2 ${on ? "border-[color:var(--ft-brand)]" : "border-slate-200"}`}>
              <button onClick={() => onToggle(entry.id)} className={`w-[18px] h-[18px] mt-0.5 rounded-[5px] border flex items-center justify-center text-[11px] font-black text-white shrink-0 ${on ? "bg-[color:var(--ft-brand)] border-[color:var(--ft-brand)]" : "border-slate-300"}`}>{on ? "✓" : ""}</button>
              <div className="flex-1 min-w-0">
                {entry.kind === "bundle" && <span className="inline-block text-[9px] font-extrabold uppercase tracking-wide text-[color:var(--ft-brand-deep)] mb-1">Multi-width bundle</span>}
                <div className="text-[13px] font-bold leading-tight">{v.title}</div>
                <div className="text-[11px] text-slate-500 font-semibold">{v.meta}</div>
                {v.subs.map((s, i) => <div key={i} className="flex text-[11px] text-slate-500 font-semibold pt-0.5"><span>{s.label}</span><span className="ml-auto font-bold text-slate-700">{fmInt(s.amt)}</span></div>)}
                {v.fees.map((s, i) => <div key={i} className="flex text-[11px] font-semibold pt-0.5" style={{ color: "var(--ft-brand-deep)" }}><span>{s.label}</span><span className="ml-auto">+{fmInt(s.amt)}</span></div>)}
              </div>
              <div className="flex flex-col items-end gap-1.5"><span className="font-extrabold tabular-nums text-[13px]">{fmInt(v.price)}</span><button onClick={() => onRemove(entry.id)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button></div>
            </div>); })}
        {n > 0 && <div className="text-center pt-1"><button onClick={onSelectAll} className="text-[11px] font-bold underline underline-offset-2" style={{ color: "var(--ft-brand-deep)" }}>{selCount === n ? "Clear selection" : "Select all"}</button></div>}
      </div>
      <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-200">
        <span className="text-[11px] text-slate-500 font-semibold">{selCount} selected → <b>{areaName}</b></span>
        <button disabled={!n} onClick={onMoveAll} className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold disabled:opacity-40">Move all</button>
        <button disabled={!selCount} onClick={onMove} className="rounded-md bg-indigo-600 text-white px-3.5 py-1.5 text-xs font-bold disabled:opacity-40">Move {selCount} → {areaName}</button>
      </div>
    </div>
  );
}

// --- the popup ----------------------------------------------------------------

export default function SheogaConfigurator({ seed, initialSf, markupDefault, ventMarkupDefault, basket, onBasketChange, onMove, onMoveEntries, onAdd, onClose, areaName, embedded = false, onConfigChange }) {
  const [mode, setMode] = useState(seed?.mode || "floor");
  const [cfgs, setCfgs] = useState(() => {
    const base = Object.fromEntries(MODES.map((m) => [m.id, defaultConfig(m.id)]));
    if (seed?.mode && seed?.cfg) base[seed.mode] = { ...base[seed.mode], ...seed.cfg };
    return base;
  });
  // Flooring and vents/dampers carry separate markups (Settings → Price book).
  // The footer's markup box edits whichever applies to the active tab.
  const [markup, setMarkup] = useState(markupDefault ?? DEFAULT_MARKUP);
  const [ventMarkup, setVentMarkup] = useState(ventMarkupDefault ?? DEFAULT_VENT_MARKUP);
  const ventMode = mode === "vent" || mode === "damper";
  const activeMarkup = ventMode ? ventMarkup : markup;
  const setActiveMarkup = ventMode ? setVentMarkup : setMarkup;
  const [sf, setSf] = useState(initialSf > 0 ? initialSf : 1);
  const [grid, setGrid] = useState(false);
  const isWide = useIsWide();
  const [sheetUp, setSheetUp] = useState(false); // mobile: pull-up build sheet
  const [basketOpen, setBasketOpen] = useState(false);
  const [basketSel, setBasketSel] = useState({}); // basket entry id -> selected
  useEscClose(true, () => { if (grid) setGrid(false); else if (sheetUp) setSheetUp(false); else if (basketOpen) setBasketOpen(false); else onClose(); });

  const cfg = cfgs[mode];
  const set = (next) => setCfgs((c) => ({ ...c, [mode]: next }));
  // Report the live { mode, cfg } upward in seed shape, so App's refresh
  // restore (ft-open-layer) reopens the popup mid-configuration, not on the
  // seed it was first opened with.
  useEffect(() => { onConfigChange?.({ mode, cfg: cfgs[mode] }); }, [mode, cfgs]);
  // The vent tab's "Copy floor" pulls from whichever floor tab (unfinished /
  // stocked / herringbone) the user last had open — seeded tab first.
  const [floorSrc, setFloorSrc] = useState(seed?.mode === "stocked" || seed?.mode === "hb" ? seed.mode : "floor");
  // The herringbone tab copies from a real floor config, so it tracks the last-
  // open unfinished/stocked tab (never hb itself — that would be a no-op).
  const [flatSrc, setFlatSrc] = useState(seed?.mode === "stocked" ? "stocked" : "floor");
  const pickMode = (id) => { setMode(id); if (id === "floor" || id === "stocked" || id === "hb") setFloorSrc(id); if (id === "floor" || id === "stocked") setFlatSrc(id); };
  const copyFloorToVent = () => { const patch = ventFromFloor({ mode: floorSrc, cfg: cfgs[floorSrc] }); if (patch) set({ ...cfg, ...patch }); };
  const copyFloorToHb = () => {
    const patch = hbFromFloor({ mode: flatSrc, cfg: cfgs[flatSrc] });
    if (!patch) return;
    const next = { ...cfg, ...patch };
    const t = HERRINGBONE[next.cons === "solid" ? "solid" : "eng"][next.sp];
    if (t && !t.ws.includes(next.w)) next.w = t.ws[Math.min(2, t.ws.length - 1)];
    set(next);
  };

  // Multi-width entry (floor + stocked only): a job split across several plank
  // widths, sharing every other option. Lifted here so Task 9's MultiWidthCard
  // and both rails can read/write the same state.
  const [multi, setMulti] = useState(false);
  const [mwWidths, setMwWidths] = useState([3.25, 4.25, 5.25]);
  const [mwShares, setMwShares] = useState(() => redistributeShares([3.25, 4.25, 5.25]));
  const multiOk = mode === "floor" || mode === "stocked"; // multi-width only on width-run tabs
  useEffect(() => { if (!multiOk && multi) setMulti(false); }, [mode, multiOk, multi]);
  const widthShips = (w) => (mode === "stocked" ? !!calcStocked({ ...cfg, w }) : floorBase({ ...cfg, w }) != null);
  const availWidths = (mode === "stocked" ? (STOCKED_WIDTHS[cfg.grade] || []) : floorWidths(cfg)).filter(widthShips);
  const setMwSet = (nextWidths) => { const ws = [...new Set(nextWidths)].sort((a, b) => a - b); setMwWidths(ws); setMwShares(redistributeShares(ws)); };
  const toggleMwWidth = (w) => { if (mwWidths.includes(w)) { if (mwWidths.length > 2) setMwSet(mwWidths.filter((x) => x !== w)); } else setMwSet([...mwWidths, w]); };
  const stepMw = (d) => { if (d > 0) { const addW = availWidths.find((w) => !mwWidths.includes(w)); if (addW != null) setMwSet([...mwWidths, addW]); } else if (mwWidths.length > 2) setMwSet(mwWidths.slice(0, -1)); };
  const setShare = (w, v) => setMwShares((s) => ({ ...s, [w]: Math.max(0, Math.round(Number(v) || 0)) }));
  // When the width RUN changes (species/grade/construction/tab), drop widths the
  // new product doesn't ship and top back up to ≥2, re-deriving the split — so a
  // multi-width bundle never carries dead, unpriced widths.
  useEffect(() => {
    if (!multi || !multiOk) return;
    let next = mwWidths.filter((w) => availWidths.includes(w));
    for (const w of availWidths) { if (next.length >= 2) break; if (!next.includes(w)) next.push(w); }
    next = [...new Set(next)].sort((a, b) => a - b);
    if (next.length !== mwWidths.length || next.some((w, i) => w !== mwWidths[i])) { setMwWidths(next); setMwShares(redistributeShares(next)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multi, multiOk, mode, cfg.sp, cfg.grade, cfg.cons]);

  const snap = { mode, cfg };
  const c = useMemo(() => calcConfig(snap, sf), [mode, cfg, sf]);
  const sell = c ? sellOf(c.cost, activeMarkup) : 0;
  const isEa = c?.per === "ea";
  const qty = c?.qty || 1;
  const ctn = c && !isEa ? cartonize(sf, c.cartonSf) : null;
  const feesTot = (c?.fees || []).reduce((a, x) => a + x.amt, 0);
  const jobTot = c ? (isEa ? sell * qty : sell * (ctn ? ctn.billedSf : sf)) + feesTot : 0;
  const add = () => { if (c) onAdd(lineItems(snap, { sf, markupPct: activeMarkup }), snap); };
  const addBundleToBasket = () => {
    const entry = { id: undefined, kind: "bundle", addedAt: Date.now(), markupPct: activeMarkup, base: { mode, cfg: JSON.parse(JSON.stringify(cfg)) }, widths: mwWidths.map((w) => ({ w, share: mwShares[w] ?? 0 })), sf };
    onBasketChange([...(basket || []), normBasketEntry(entry)].filter(Boolean));
    setBasketOpen(true);
  };
  const moveBundleToLine = () => { onMove(multiWidthLineItems({ mode, cfg }, mwWidths.map((w) => ({ w, share: mwShares[w] ?? 0 })), sf, activeMarkup)); onClose(); };
  const addSingleToBasket = () => {
    const entry = normBasketEntry({ kind: "single", addedAt: Date.now(), markupPct: activeMarkup, snap: { mode, cfg: JSON.parse(JSON.stringify(cfg)) }, sf });
    if (entry) { onBasketChange([...(basket || []), entry]); setBasketOpen(true); }
  };
  const toggleBasketSel = (id) => setBasketSel((s) => ({ ...s, [id]: !s[id] }));
  const selectAllBasket = () => { const all = (basket || []).every((b) => basketSel[b.id]); const next = {}; (basket || []).forEach((b) => { next[b.id] = !all; }); setBasketSel(next); };
  const removeBasketEntry = (id) => onBasketChange((basket || []).filter((b) => b.id !== id));
  const moveBasketEntries = (entries) => {
    const lines = entries.flatMap((e) => basketEntryView(e).lines());
    const nextBasket = (basket || []).filter((b) => !entries.includes(b));
    onMoveEntries(lines, nextBasket);
    setBasketSel({});
  };
  const moveSelectedBasket = () => moveBasketEntries((basket || []).filter((b) => basketSel[b.id]));
  const moveAllBasket = () => moveBasketEntries([...(basket || [])]);

  const sfMode = !isEa && mode !== "vent" && mode !== "damper";
  // Herringbone with no length typed (and no legacy tier) isn't a dead combo —
  // it's just waiting for the slat length, so prompt for that instead.
  const hbNeedsLen = mode === "hb" && !c && hbSlatLen(cfg) == null && !Number.isFinite(cfg.band);

  const rail = (
    <>
      {mode === "floor" && <FloorRail f={cfg} set={set} sf={sf} markup={activeMarkup} onGrid={() => setGrid(true)}
        multi={multi} mwWidths={mwWidths} onMultiToggle={() => setMulti((m) => !m)} onMwWidth={toggleMwWidth} onStep={stepMw} />}
      {mode === "stocked" && <StockedRail k={cfg} set={set} sf={sf} markup={activeMarkup} onGrid={() => setGrid(true)}
        multi={multi} mwWidths={mwWidths} onMultiToggle={() => setMulti((m) => !m)} onMwWidth={toggleMwWidth} onStep={stepMw} />}
      {mode === "hb" && <HbRail h={cfg} set={set} markup={activeMarkup} onGrid={() => setGrid(true)}
        onCopyFloor={copyFloorToHb} copySrc={MODES.find((m) => m.id === flatSrc).label} />}
      {mode === "vent" && <VentRail v={cfg} set={set} markup={activeMarkup} onGrid={() => setGrid(true)}
        onCopyFloor={copyFloorToVent} copySrc={MODES.find((m) => m.id === floorSrc).label} />}
      {mode === "damper" && <DamperRail d={cfg} set={set} markup={activeMarkup} />}
    </>
  );
  const markupInput = (
    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
      {ventMode ? "Vent markup" : "Markup"} <input type="number" min="0" step="5" value={activeMarkup} onChange={(e) => setActiveMarkup(Math.max(0, Number(e.target.value) || 0))}
        className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" data-sheoga-markup /> %
    </label>
  );
  const sfInput = sfMode && (
    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
      Job size <input type="number" min="1" step={isWide ? "50" : "10"} value={sf} onChange={(e) => setSf(Math.max(1, Number(e.target.value) || 1))}
        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" data-sheoga-sf /> sq ft
    </label>
  );
  const priceNote = (
    <p className="mt-3 text-[10.5px] text-slate-400 font-medium leading-relaxed">
      Sheet prices are distributor cost · flooring effective Feb 1 2025 · vents Feb 2022 · custom orders 5–10% overrun, no returns.
    </p>
  );

  const header = (
    <div className="flex items-center gap-3 px-4 pt-3">
      <div className="leading-tight">
        <div className="ft-eyebrow text-[9px]">Vendor configurator</div>
        <div className="text-lg font-extrabold">Sheoga Hardwood <span className="text-xs font-semibold text-slate-500 ml-1.5">bought by description — no SKUs</span></div>
      </div>
      <button onClick={() => setBasketOpen(true)} className="relative ml-auto inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold hover:bg-slate-50">
        🧺 Basket{(basket || []).length > 0 && <span className="rounded-full bg-[color:var(--ft-brand)] text-white text-[11px] font-extrabold min-w-[18px] h-[18px] px-1 flex items-center justify-center">{basket.length}</span>}
      </button>
      {!embedded && <button onClick={onClose} className="w-7 h-7 rounded-md border border-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center"><X size={15} /></button>}
    </div>
  );
  // Desktop tabs sit on the content border; the phone scrolls them as pills.
  const tabs = (
    <div className={isWide ? "flex gap-0.5 px-4 pt-2.5 border-b border-slate-300" : "flex gap-1.5 px-4 pt-2 pb-2.5 overflow-x-auto border-b border-slate-200"}>
      {MODES.map((m) => (
        isWide ? (
          <button key={m.id} onClick={() => pickMode(m.id)}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-lg border border-b-0 -mb-px ${mode === m.id ? "bg-white border-slate-300 text-slate-900 relative z-10" : "bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700"}`}>
            {m.label}
          </button>
        ) : (
          <button key={m.id} onClick={() => pickMode(m.id)}
            className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-full border whitespace-nowrap ${mode === m.id ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-300 text-slate-500"}`}>
            {m.label}
          </button>
        )
      ))}
    </div>
  );

  return (
    <div className={embedded
        ? "relative flex-1 min-h-0 flex flex-col"
        : `print:hidden fixed inset-0 flex items-center justify-center z-[70] ${isWide ? "p-5" : ""}`}
      style={embedded ? undefined : { background: "rgba(20,15,10,.55)" }} onClick={embedded ? undefined : onClose}>
      <div className={`bg-white flex flex-col overflow-hidden ${embedded
          ? "relative flex-1 min-h-0 w-full"
          : isWide ? "relative rounded-xl w-full max-w-[1060px] h-[min(820px,94vh)] border border-slate-300 shadow-2xl" : "w-full h-full relative"}`}
        onClick={embedded ? undefined : (e) => e.stopPropagation()} data-sheoga-pop>
        {header}
        {tabs}
        {isWide ? (<>
          {/* desktop: options rail + build card side by side */}
          <div className="flex-1 flex min-h-0">
            <div className="w-[50%] max-w-[500px] shrink-0 border-r border-slate-300 overflow-y-auto p-4" style={{ scrollbarGutter: "stable" }}>{rail}</div>
            <div className="flex-1 min-w-0 overflow-y-auto p-4" style={{ background: "var(--ft-cream)" }}>
              {multi && multiOk ? (
                <MultiWidthCard base={{ mode, cfg }} widths={mwWidths} shares={mwShares} sf={sf} markup={activeMarkup} onShare={setShare}
                  onAddBasket={addBundleToBasket} onMove={moveBundleToLine} />
              ) : (!c ? (
                <div className="rounded-lg border border-slate-300 bg-white p-5 text-sm text-slate-400">{hbNeedsLen ? "Type a slat length on the left — the build prices from its tier." : "This combination isn't offered — pick an available width."}</div>
              ) : (
                <BuildCard c={c} sell={sell} activeMarkup={activeMarkup} isEa={isEa} qty={qty} ctn={ctn} feesTot={feesTot} jobTot={jobTot} sf={sf} onGrid={() => setGrid(true)} onAdd={add} onAddBasket={addSingleToBasket} />
              ))}
              {priceNote}
            </div>
          </div>
          <div className="flex items-center gap-5 px-4 py-2.5 border-t border-slate-300" style={{ background: "var(--ft-cream)" }}>
            {markupInput}
            {sfInput}
            <span className="ml-auto text-[10.5px] text-slate-400 font-medium">The description is the order — read it to Sheoga, or reconfigure from the row later.</span>
          </div>
        </>) : (<>
          {/* mobile: options fill the screen; price bar pinned; sheet pulls up */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-6">{rail}</div>
          <button type="button" onClick={() => (c || (multi && multiOk)) && setSheetUp(true)} disabled={!c && !(multi && multiOk)}
            className="shrink-0 text-left border-t border-slate-300 px-4 pt-2 pb-3" style={{ background: "var(--ft-card)", boxShadow: "0 -6px 24px rgba(28,26,23,.10)" }} data-sheoga-pricebar>
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full" style={{ background: "var(--ft-border-strong, rgba(28,26,23,.2))" }} />
            {!c ? (
              <div className="text-center text-xs font-semibold text-slate-400 py-1">{hbNeedsLen ? "Enter a slat length to see the price" : "Pick an available option to see the price"}</div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-extrabold truncate">{c.rest || c.desc}</div>
                  <div className="text-[10.5px] text-slate-500 font-semibold">{c.size ? c.size + " · " : ""}{isEa ? `${qty} pcs` : ctn ? `${ctn.cartons} cartons · ${ctn.billedSf} sf` : `${sf} sf`}</div>
                </div>
                <div className="text-right leading-none">
                  <div className="text-lg font-extrabold tabular-nums" style={{ color: "var(--ft-brand-deep)" }} data-sheoga-sell>{fm(sell)}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mt-1">{isEa ? "ea · sell" : "/sf · sell"}</div>
                </div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: "var(--ft-text)" }}><ChevronUp size={16} /></div>
              </div>
            )}
          </button>
          <MobileBuildSheet open={sheetUp && (!!c || (multi && multiOk))} onClose={() => setSheetUp(false)}
            footer={(multi && multiOk) ? (<>
              <button onClick={addBundleToBasket} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 flex items-center gap-1.5"><Plus size={14} /> Basket</button>
              <button onClick={moveBundleToLine} className="flex-1 rounded-lg text-white px-4 py-2.5 text-sm font-extrabold flex items-center justify-center gap-1.5" style={{ background: "var(--ft-brand)" }}><Plus size={15} /> Add lines</button>
            </>) : c && (<>
              <button onClick={() => setGrid(true)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 flex items-center gap-1.5"><Grid3X3 size={14} /> Grid</button>
              <button onClick={addSingleToBasket} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 flex items-center gap-1.5"><Plus size={14} /> Basket</button>
              <button onClick={add} className="flex-1 rounded-lg text-white px-4 py-2.5 text-sm font-extrabold flex items-center justify-center gap-1.5" style={{ background: "var(--ft-brand)" }} data-sheoga-add><Plus size={15} /> Add to product line{(c.fees || []).length ? "s" : ""}</button>
            </>)}>
            {multi && multiOk ? (
              <MultiWidthCard base={{ mode, cfg }} widths={mwWidths} shares={mwShares} sf={sf} markup={activeMarkup} onShare={setShare}
                onAddBasket={addBundleToBasket} onMove={moveBundleToLine} showActions={false} />
            ) : (c && <BuildCard c={c} sell={sell} activeMarkup={activeMarkup} isEa={isEa} qty={qty} ctn={ctn} feesTot={feesTot} jobTot={jobTot} sf={sf} showActions={false} />)}
            <div className="flex items-center gap-5 px-1 pt-3">{markupInput}{sfInput}</div>
            {priceNote}
          </MobileBuildSheet>
        </>)}
        {isWide && (<>
          <div className={`absolute inset-0 z-[55] transition-opacity ${basketOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} style={{ background: "rgba(20,15,10,.4)" }} onClick={() => setBasketOpen(false)} />
          <div className={`absolute top-0 right-0 bottom-0 z-[56] w-[400px] bg-white border-l border-slate-300 shadow-2xl transition-transform ${basketOpen ? "translate-x-0" : "translate-x-full"}`}>
            <BasketPanel basket={basket || []} sel={basketSel} onToggle={toggleBasketSel} onRemove={removeBasketEntry} onSelectAll={selectAllBasket} onMove={moveSelectedBasket} onMoveAll={moveAllBasket} areaName={areaName} onClose={() => setBasketOpen(false)} isWide />
          </div>
        </>)}
        {!isWide && (
          <MobileBuildSheet open={basketOpen} onClose={() => setBasketOpen(false)}>
            <BasketPanel basket={basket || []} sel={basketSel} onToggle={toggleBasketSel} onRemove={removeBasketEntry} onSelectAll={selectAllBasket} onMove={moveSelectedBasket} onMoveAll={moveAllBasket} areaName={areaName} onClose={() => setBasketOpen(false)} isWide={false} />
          </MobileBuildSheet>
        )}
      </div>
      {grid && <GridModal mode={mode} cfg={cfg} onClose={() => setGrid(false)} onPick={(patch) => { set({ ...cfg, ...patch }); setGrid(false); }} />}
    </div>
  );
}
