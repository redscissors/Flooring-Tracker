// Dev-only mockup harness (app-header-options.html): options for a consistent
// top-right on the Apps configurator headers (owner review 2026-09-24). Not
// part of the app build.
import { useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChevronDown, ShoppingBasket, Check } from "lucide-react";
import "./index.css";
import { PaneBack, PaneClose } from "./raildrawer.jsx";
import { HelpTip } from "./widgets.jsx";
import { TIER_COLOR } from "./uiconst.js";

const APPS = [
  { id: "schluter", name: "Schluter", tabs: ["Kits", "Custom shower", "Browse", "Compare"], tools: true },
  { id: "wedi", name: "wedi shower systems", tabs: ["Kits", "Custom shower", "Browse", "Compare"], tools: true },
  { id: "sheoga", name: "Sheoga Hardwood", tip: true, tabs: ["Unfinished & custom", "Stocked prefinished", "Wood vents", "Dampers"], tools: false },
];
const TIERS = ["retail", "builder", "employee", "sale", "custom"];
const LBL = { retail: "Retail", builder: "Builder", employee: "Employee", sale: "Sale", custom: "Custom" };

function Title({ app }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <PaneBack onClick={() => {}} />
      <h2 className="ft-serif text-xl leading-none whitespace-nowrap">{app.name}</h2>
      {app.tip && <HelpTip className="align-middle" tip="Sheoga help" />}
    </div>
  );
}
function Tabs({ app, right }) {
  return (
    <div className="flex items-end gap-1 px-3.5 pt-2 border-b border-slate-300">
      {app.tabs.map((t, i) => (
        <span key={t} className={"rounded-t-md border border-b-0 px-3.5 py-1.5 text-[12.5px] font-bold " + (i === 0 ? "bg-white border-slate-300 -mb-px" : "border-slate-200 text-slate-500")} style={i ? { background: "var(--ft-sand)" } : undefined}>{t}</span>
      ))}
      {right && <div className="ml-auto flex items-center gap-2 pb-1.5" style={{ marginRight: 35 }}>{right}</div>}
    </div>
  );
}
function Frame({ app, right, tabsRight, clip = true }) {
  return (
    <div className={"rounded-lg border border-slate-300 " + (clip ? "overflow-hidden" : "")} style={{ background: "var(--ft-cream)" }}>
      <div className="flex items-center gap-2.5 px-3.5 pt-2 min-h-[46px]">
        <Title app={app} />
        <div className="ml-auto flex items-center gap-2">{right}</div>
        <PaneClose onClick={() => {}} />
      </div>
      <Tabs app={app} right={tabsRight} />
      <div className="h-6 bg-white rounded-b-lg" />
    </div>
  );
}

// Flat controls: the header's own background, no outline, a hover tint only.
const FLAT = "h-[30px] inline-flex items-center gap-1.5 rounded-md px-2 text-[12px] font-bold text-slate-600 hover:bg-[color:var(--ft-hover)] shrink-0 whitespace-nowrap";
const TIER_LBL = (t, pct) => (t === "custom" ? `−${pct || 0}%` : LBL[t]);
const tierInk = (t) => TIER_COLOR[t]?.main || "var(--ft-text)";
const OPEN_W = 170;

// Closed: just the current level, flat on the header. Open: the same box
// slides down into the list and a dark border grows around the whole thing,
// so the trigger and its options read as one piece. The wrapper keeps the
// closed size in the row so nothing beside it moves.
function FlatTier({ tier: initial, open: startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  const [tier, setTier] = useState(initial);
  const [w, setW] = useState(0);
  const [pct, setPct] = useState("12");
  const trig = useRef(null);
  useLayoutEffect(() => { setW(trig.current.offsetWidth); }, [tier, pct, open]);
  return (
    <div className="relative h-[30px]" style={{ width: w || undefined }}>
      <div className="absolute right-0 top-0 rounded-lg overflow-hidden"
        style={{ zIndex: open ? 30 : 10, width: open ? Math.max(w, OPEN_W) : w || "auto", background: "var(--ft-cream)",
          border: "1.5px solid " + (open ? "var(--ft-text)" : "transparent"),
          boxShadow: open ? "0 12px 28px -12px rgba(28,26,23,.45)" : "none",
          transition: "width 220ms cubic-bezier(.2,.8,.2,1), border-color 220ms ease, box-shadow 220ms ease" }}>
        <button ref={trig} data-price onClick={() => setOpen(!open)}
          className={"h-[27px] w-full inline-flex items-center justify-end gap-1.5 px-2 text-[12.5px] font-extrabold whitespace-nowrap " + (open ? "" : "hover:bg-[color:var(--ft-hover)]")}
          style={{ color: tierInk(tier) }}>
          {TIER_LBL(tier, pct)}
          <ChevronDown size={14} className="text-slate-400" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 220ms ease" }} />
        </button>
        <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows 240ms cubic-bezier(.2,.8,.2,1)" }}>
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-slate-300 mx-2" />
            <div className="py-1">
              {TIERS.map((t) => (
                <button key={t} data-tier={t} onClick={() => { setTier(t); setOpen(false); }}
                  className={"w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-left hover:bg-[color:var(--ft-hover)] " + (t === tier ? "font-extrabold" : "font-semibold text-slate-600")}>
                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: tierInk(t) }} />
                  {t === "custom" ? (
                    <span className="flex-1">
                      <span className="inline-flex items-center gap-0.5 rounded border border-slate-300 bg-white px-1.5 text-[12px] font-bold" style={{ color: tierInk(t) }} onClick={(e) => e.stopPropagation()}>
                        −<input data-custom value={pct} onFocus={() => setTier("custom")} onChange={(e) => setPct(e.target.value.replace(/\D/g, "").slice(0, 2))}
                          onKeyDown={(e) => { if (e.key === "Enter") setOpen(false); }} className="w-5 text-right bg-transparent focus:outline-none" />%
                      </span>
                    </span>
                  ) : <span className="flex-1" style={t === tier ? { color: tierInk(t) } : undefined}>{LBL[t]}</span>}
                  <span className="w-3.5 shrink-0">{t === tier && <Check size={13} />}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
const FlatBasket = ({ n = 2 }) => (
  <button className={FLAT + " relative !px-1.5 w-[34px] justify-center"} title="Basket">
    <ShoppingBasket size={20} strokeWidth={2} />
    {n > 0 && <span className="absolute -top-1.5 -right-1.5 rounded-full ring-2 ring-[color:var(--ft-cream)] bg-[color:var(--ft-brand)] text-white text-[10px] font-extrabold min-w-[16px] h-[16px] px-1 flex items-center justify-center">{n}</span>}
  </button>
);
const FlatClear = () => <button className={FLAT}>Clear design</button>;
const FlatStock = ({ on = true }) => (
  <button className={FLAT}>
    <span className={"w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center " + (on ? "bg-[color:var(--ft-brand)] border-[color:var(--ft-brand)] text-white" : "border-slate-400")}>{on && <Check size={10} strokeWidth={3} />}</span>Stock only
  </button>
);
const OPTIONS = [
  {
    key: "flat", title: "D3 · flat controls, price dropdown, basket icon", note: "No outlines or fills: every control sits on the header's own background and only tints on hover. Price level shows only the current level's name (e.g. Builder) in its tier color; click it to open the list. Basket is an icon with the count on it. Stock only and Clear design stay on the tab row, right-aligned under the basket.",
    render: (app, tier) => <Frame clip={false} app={app} right={<><FlatTier key={tier} tier={tier} /><FlatBasket /></>} tabsRight={app.tools ? <><FlatStock /><FlatClear /></> : null} />,
  },
  {
    key: "flatopen", title: "The price dropdown, open", note: "Click the price and it slides open into one bordered piece: a dark outline grows around the current level and the list together. The levels are names only; the last row is just the custom discount, in a box to type it. Pick one and it slides shut.",
    render: (app, tier) => app.id !== "sheoga" ? null : <div className="pb-44"><Frame clip={false} app={app} right={<><FlatTier key={tier} tier={tier} open /><FlatBasket /></>} /></div>,
  },
];

function Page() {
  const [tier, setTier] = useState("builder");
  return (
    <div className="min-h-screen p-6 space-y-10" style={{ background: "var(--ft-cream)", width: 1240 }}>
      <div className="flex items-center gap-3">
        <h1 className="ft-serif text-2xl">Apps header: top-right options</h1>
        <span className="text-xs text-slate-500">Showing price level:</span>
        {TIERS.slice(0, 4).map((t) => <button key={t} onClick={() => setTier(t)} className={"text-xs rounded border px-2 py-0.5 " + (tier === t ? "border-slate-800 font-bold" : "border-slate-300")}>{LBL[t]}</button>)}
      </div>
      {OPTIONS.map((o) => (
        <section key={o.key} data-option={o.key} className="space-y-2">
          <h2 className="text-base font-extrabold">{o.title}</h2>
          <p className="text-[12.5px] text-slate-500 max-w-4xl">{o.note}</p>
          <div className="space-y-3">{APPS.map((a) => <div key={a.id}>{o.render(a, tier)}</div>)}</div>
        </section>
      ))}
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Page />);
