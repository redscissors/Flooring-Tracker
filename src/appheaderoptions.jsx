// Dev-only mockup harness (app-header-options.html): options for a consistent
// top-right on the Apps configurator headers (owner review 2026-09-24). Not
// part of the app build.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ChevronDown, ShoppingBasket, Check } from "lucide-react";
import "./index.css";
import { PaneBack, PaneClose } from "./raildrawer.jsx";
import { HelpTip } from "./widgets.jsx";
import { TIER_COLOR } from "./uiconst.js";

const APPS = [
  { id: "schluter", name: "Schluter", tabs: ["Kits", "Custom shower", "Browse", "Compare"], tools: true, sub: { retail: "1.5× cost", builder: "−0%", employee: "cost × 1.06", sale: "−10%" } },
  { id: "wedi", name: "wedi shower systems", tabs: ["Kits", "Custom shower", "Browse", "Compare"], tools: true, sub: { retail: "book price", builder: "× 1.00", employee: "cost × 1.06", sale: "−10%" } },
  { id: "sheoga", name: "Sheoga Hardwood", tip: true, tabs: ["Unfinished & custom", "Stocked prefinished", "Wood vents", "Dampers"], tools: false },
];
const TIERS = ["retail", "builder", "employee", "sale", "custom"];
const LBL = { retail: "Retail", builder: "Builder", employee: "Employee", sale: "Sale", custom: "Custom" };
const SHORT = { retail: "Retail", builder: "Bldr", employee: "Emp", sale: "Sale" };
const fillOf = (t) => (TIER_COLOR[t] ? { background: TIER_COLOR[t].main, color: "#fff" } : { background: "#1C1A17", color: "#fff" });
const pressed = { boxShadow: "inset 0 2px 4px rgba(0,0,0,.28)" };

const Basket = ({ n = 2, w }) => (
  <button style={w ? { width: w } : undefined} className="h-[30px] justify-center whitespace-nowrap relative inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold hover:bg-slate-50 shrink-0">
    🧺 Basket{n > 0 && <span className="rounded-full bg-[color:var(--ft-brand)] text-white text-[11px] font-extrabold min-w-[18px] h-[18px] px-1 flex items-center justify-center">{n}</span>}
  </button>
);
const StockChip = ({ on = true }) => (
  <button className={"h-[30px] inline-flex items-center gap-1.5 rounded-md border px-2.5 text-[11.5px] font-bold shrink-0 " + (on ? "text-[color:var(--ft-brand-deep)] font-extrabold" : "border-slate-300 bg-white text-slate-500")}
    style={on ? { background: "var(--ft-seg-on-bg)", borderColor: "var(--ft-brand)" } : undefined}>
    <span className={"w-3 h-3 rounded-sm border flex items-center justify-center text-[9px] " + (on ? "bg-[color:var(--ft-brand)] border-[color:var(--ft-brand)] text-white" : "border-slate-400")}>{on ? "✓" : ""}</span>Stock only
  </button>
);
const Clear = ({ w }) => <button style={w ? { width: w } : undefined} className="h-[30px] rounded-md border border-slate-200 px-2.5 text-[11px] font-bold text-slate-500 hover:bg-slate-50 shrink-0 whitespace-nowrap">Clear design</button>;
const Source = ({ v = "stock", labels = ["Stock only", "Full catalog"] }) => (
  <div className="h-[30px] inline-flex rounded-md border border-slate-300 overflow-hidden bg-white shrink-0 text-[11.5px] font-bold">
    {[["stock", labels[0]], ["all", labels[1]]].map(([k, l], i) => (
      <button key={k} className={"px-2.5 " + (i ? "border-l border-slate-300 " : "") + (v === k ? "text-[color:var(--ft-brand-deep)] font-extrabold" : "text-slate-500")}
        style={v === k ? { background: "var(--ft-seg-on-bg)", boxShadow: "inset 0 0 0 1.5px var(--ft-brand)" } : undefined}>{l}</button>
    ))}
  </div>
);

// Today's two tier bars, as drawn now.
function TierTwoLine({ tier, sub }) {
  return (
    <div className="flex items-stretch rounded-[7px] border border-slate-300 overflow-hidden bg-white shrink-0">
      {TIERS.map((t, i) => {
        const on = tier === t;
        return (
          <button key={t} className={"px-[11px] py-[6px] text-[11.5px] leading-[1.1] flex flex-col items-start " + (i ? "border-l border-slate-300 " : "") + (on ? "font-extrabold" : "font-bold text-slate-500")} style={on ? { ...fillOf(t), ...pressed } : undefined}>
            {LBL[t]}<small className="text-[8.5px] font-semibold opacity-75">{t === "custom" ? "–  %" : sub[t]}</small>
          </button>
        );
      })}
    </div>
  );
}
function TierLabeled({ tier, label = true, short = false }) {
  return (
    <div className="h-[30px] inline-flex shrink-0 items-stretch rounded-md border border-slate-300 overflow-hidden bg-white">
      {label && <span className="flex items-center px-2 text-[9px] font-bold uppercase tracking-wider text-slate-400" style={{ background: "var(--ft-sand)" }}>Price level</span>}
      {TIERS.map((t, i) => {
        const on = tier === t;
        return (
          <button key={t} className={(label || i ? "border-l border-slate-300 " : "") + "px-2.5 text-[11px] whitespace-nowrap flex items-center gap-1 " + (on ? "font-extrabold " + (TIER_COLOR[t] ? "text-white" : "bg-slate-900 text-white") : "font-bold text-slate-500")} style={on ? { ...(TIER_COLOR[t] ? { background: TIER_COLOR[t].main } : {}), ...pressed } : undefined}>
            {t === "custom" ? <>{short ? "" : "Custom "}<span className="w-5 text-right">–</span>%</> : short ? SHORT[t] : LBL[t]}
          </button>
        );
      })}
    </div>
  );
}
function TierPill({ tier }) {
  const txt = tier === "builder" ? "Builder −15%" : tier === "sale" ? "Sale −10%" : LBL[tier];
  return (
    <button className="h-[30px] inline-flex items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-extrabold shrink-0" style={fillOf(tier)}>
      <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">Price</span> {txt} <ChevronDown size={13} />
    </button>
  );
}

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
      <div className="h-6 bg-white" />
    </div>
  );
}

const BW = 124; // Basket and Clear design share a width so they stack as a column
const D_BASE = "The title row matches the job header's short price bar (Retail · Bldr · Emp · Sale · %). Basket and Clear design share a width, and Clear design sits right under Basket.";
// One button language for the whole cluster: white fill, slate-300 border,
// 11.5px bold slate-600, 30px tall. State colors only: the active tier cell and
// the checked box.
const BTN = "h-[30px] inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-[11.5px] font-bold text-slate-600 hover:bg-slate-50 shrink-0 whitespace-nowrap";
const UBasket = () => <button className={BTN} style={{ width: BW }}>🧺 Basket<span className="rounded-full bg-[color:var(--ft-brand)] text-white text-[11px] font-extrabold min-w-[18px] h-[18px] px-1 flex items-center justify-center">2</span></button>;
const UClear = () => <button className={BTN} style={{ width: BW }}>Clear design</button>;
const UStock = ({ on = true }) => (
  <button className={BTN}>
    <span className={"w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center text-[10px] leading-none " + (on ? "bg-[color:var(--ft-brand)] border-[color:var(--ft-brand)] text-white" : "border-slate-400")}>{on ? "✓" : ""}</span>Stock only
  </button>
);
function UTier({ tier }) {
  return (
    <div className="h-[30px] inline-flex shrink-0 items-stretch rounded-md border border-slate-300 overflow-hidden bg-white">
      {TIERS.map((t, i) => {
        const on = tier === t;
        return (
          <button key={t} className={(i ? "border-l border-slate-300 " : "") + "px-2.5 text-[11.5px] font-bold whitespace-nowrap flex items-center gap-1 " + (on ? "text-white" : "text-slate-600 hover:bg-slate-50")} style={on ? { ...fillOf(t), ...pressed } : undefined}>
            {t === "custom" ? <><span className="w-5 text-right">–</span>%</> : SHORT[t]}
          </button>
        );
      })}
    </div>
  );
}
// Flat controls: the header's own background, no outline, a hover tint only.
const FLAT = "h-[30px] inline-flex items-center gap-1.5 rounded-md px-2 text-[12px] font-bold text-slate-600 hover:bg-[color:var(--ft-hover)] shrink-0 whitespace-nowrap";
const TIER_LBL = (t) => t === "builder" ? "Builder −15%" : t === "sale" ? "Sale −10%" : LBL[t];
function FlatTier({ tier, open }) {
  return (
    <div className="relative">
      <button className={FLAT + (open ? " bg-[color:var(--ft-hover)]" : "")}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Price</span>
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: TIER_COLOR[tier]?.main || "#1C1A17" }} />
        <span style={{ color: TIER_COLOR[tier]?.main }}>{TIER_LBL(tier)}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-[34px] z-10 w-48 rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-[12.5px]">
          {TIERS.map((t) => (
            <div key={t} className={"flex items-center gap-2 px-3 py-1.5 " + (t === tier ? "font-extrabold" : "font-semibold text-slate-600")}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: TIER_COLOR[t]?.main || "#1C1A17" }} />
              <span className="flex-1" style={t === tier ? { color: TIER_COLOR[t]?.main } : undefined}>{LBL[t]}</span>
              <span className="text-[11px] text-slate-400">{t === "builder" ? "−15%" : t === "sale" ? "−10%" : t === "employee" ? "cost × 1.06" : t === "custom" ? "__ %" : ""}</span>
              {t === tier && <Check size={13} />}
            </div>
          ))}
        </div>
      )}
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
    key: "flat", title: "D3 · flat controls, price dropdown, basket icon", note: "No outlines or fills: every control sits on the header's own background and only tints on hover. Price level is one dropdown showing the current level in its tier color. Basket is an icon with the count on it. Stock only and Clear design stay on the tab row, right-aligned under the basket.",
    render: (app, tier) => <Frame app={app} right={<><FlatTier tier={tier} /><FlatBasket /></>} tabsRight={app.tools ? <><FlatStock /><FlatClear /></> : null} />,
  },
  {
    key: "flatopen", title: "The price dropdown, open", note: "Each level shows its percentage in the menu, so nothing from today's bar is lost.",
    render: (app, tier) => app.id !== "sheoga" ? null : <div className="pb-44"><Frame clip={false} app={app} right={<><FlatTier tier={tier} open /><FlatBasket /></>} /></div>,
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
