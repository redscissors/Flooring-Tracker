// Dev-only mockup harness (dropdown-preview.html): the price-level dropdown's
// look (PriceLevelMenu) carried onto other dropdowns, desktop and phone, next
// to how they look today (owner review 2026-09-24). Not part of the app build.
import { useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChevronDown, Check, MoreHorizontal, Copy, Pencil, Printer, Trash2 } from "lucide-react";
import "./index.css";
import { FitSelect } from "./widgets.jsx";
import { TIER_COLOR } from "./uiconst.js";
import { STAIN_COLORS } from "./sheoga.js";

const EASE = "cubic-bezier(.2,.8,.2,1)";
const GROUT = ["Prism", "Permacolor Select", "Polyblend Plus", "SpectraLOCK Pro"];
const GROUT_COLORS = {
  stock: ["Bright White", "Delorean Gray", "Frost", "Oyster Gray", "Pewter", "Charcoal", "Sandstone", "Natural Gray", "Linen", "Haystack", "Alabaster", "Summer Wheat"],
  special: ["Antique White", "Bone", "Earth", "Fawn", "Light Smoke", "Mocha", "Quarry Red", "Sable Brown", "Tobacco Road", "Walnut", "Driftwood", "Slate Gray"],
};
const MORTAR = ["VersaBond", "MegaLite", "Ultraflex LFT", "RapidSet"];
const TIERS = [
  { v: "retail", label: "Retail" },
  { v: "builder", label: "Builder", note: "−10%" },
  { v: "employee", label: "Employee", note: "cost +6%" },
  { v: "sale", label: "Sale", note: "−15%" },
];
const tierDot = (v) => TIER_COLOR[v]?.main || "var(--ft-text)";

// The shared dropdown the owner liked, generalized. Closed: the field sits on
// its surface with a faint outline. Open: the same box grows into the list,
// the outline darkens around trigger + list together, it slides down.
function MorphSelect({ value, options, groups, onPick, placeholder = "Pick…", bg = "var(--ft-card)", openW = 180, maxH = 220, phone, startOpen = false, bold, dots, align = "left" }) {
  const [open, setOpen] = useState(startOpen);
  const [w, setW] = useState(0);
  const label = useRef(null);
  const all = groups ? groups.flatMap((g) => g.items) : options;
  const cur = all.find((o) => o.v === value);
  const text = cur ? cur.label : placeholder;
  useLayoutEffect(() => { if (label.current) setW(label.current.offsetWidth + 18); }, [text]);
  const h = phone ? 36 : 28;
  const row = phone ? "py-2.5 text-[14px]" : "py-1.5 text-[12.5px]";
  const item = (o) => {
    const on = o.v === value;
    return (
      <div key={o.v} role="button" tabIndex={open ? 0 : -1} onClick={() => { onPick(o.v); setOpen(false); }}
        className={"w-full flex items-center gap-2 px-3 cursor-pointer hover:bg-[color:var(--ft-hover)] " + row + " " + (on ? "font-extrabold" : "font-semibold text-slate-600")}>
        {dots && <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: tierDot(o.v) }} />}
        <span className="flex-1 truncate" style={on && dots ? { color: tierDot(o.v) } : undefined}>{o.label}</span>
        {o.note && <span className="text-[10.5px] font-semibold text-slate-400">{o.note}</span>}
        <span className="w-3.5 shrink-0">{on && <Check size={13} />}</span>
      </div>
    );
  };
  return (
    <div className="relative shrink-0" style={{ width: w || undefined, height: h + 3 }}>
      <div className={"absolute top-0 rounded-lg overflow-hidden " + (align === "right" ? "right-0" : "left-0")}
        style={{ zIndex: open ? 30 : 10, width: open ? Math.max(w, openW) : w || "auto", background: bg,
          border: "1.5px solid " + (open ? "var(--ft-text)" : "var(--ft-border-strong)"),
          boxShadow: open ? "0 12px 28px -12px rgba(28,26,23,.45)" : "none",
          transition: `width 220ms ${EASE}, border-color 220ms ease, box-shadow 220ms ease` }}>
        <button onClick={() => setOpen(!open)} aria-expanded={open}
          className={"w-full flex items-center px-2.5 whitespace-nowrap " + (phone ? "text-[14px] " : "text-[12.5px] ") + (bold ? "font-extrabold " : "font-semibold ") + (open ? "" : "hover:bg-[color:var(--ft-hover)]")}
          style={{ height: h, color: dots && cur ? tierDot(cur.v) : cur ? "var(--ft-text)" : "var(--ft-muted)" }}>
          <span ref={label} className="inline-flex items-center gap-1.5">
            {text}
            <ChevronDown size={14} className="text-slate-400" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 220ms ease" }} />
          </span>
        </button>
        <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: `grid-template-rows 240ms ${EASE}` }}>
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-slate-300 mx-2" />
            <div className="py-1 overflow-y-auto" style={{ maxHeight: maxH }}>
              {groups ? groups.map((g) => (
                <div key={g.label}>
                  <div className="ft-eyebrow text-[9px] px-3 pt-2 pb-0.5">{g.label}</div>
                  {g.items.map(item)}
                </div>
              )) : options.map(item)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Icon-triggered menus (⋯, right-click) can't grow out of their button, so
// they borrow the rest: the surface color, dark outline, shadow, slide-open.
function MorphActionMenu({ bg = "var(--ft-card)", startOpen = false, items }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(!open)} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-[color:var(--ft-hover)]"><MoreHorizontal size={16} /></button>
      <div className="absolute right-0 top-8 rounded-lg overflow-hidden" style={{ zIndex: 30, width: 196, background: bg,
        border: "1.5px solid " + (open ? "var(--ft-text)" : "transparent"), boxShadow: open ? "0 12px 28px -12px rgba(28,26,23,.45)" : "none",
        display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: `grid-template-rows 240ms ${EASE}, border-color 220ms ease, box-shadow 220ms ease` }}>
        <div className="min-h-0 overflow-hidden"><div className="py-1">{items.map(([Icon, t, danger]) => (
          <div key={t} role="button" onClick={() => setOpen(false)} className={"flex items-center gap-2 px-3 py-1.5 text-[12.5px] font-semibold cursor-pointer hover:bg-[color:var(--ft-hover)] " + (danger ? "text-red-600" : "text-slate-600")}>
            <Icon size={13} className="shrink-0" />{t}
          </div>
        ))}</div></div>
      </div>
    </div>
  );
}

// Static stand-ins for what today's controls show when open — the browser
// draws a native <select>'s list itself, so a screenshot can't catch it.
const BrowserList = ({ items, sel, groups }) => (
  <div className="mt-1 w-[190px] bg-white border border-[#767676] shadow-md text-[13px] font-[system-ui] max-h-[210px] overflow-hidden" style={{ color: "#000" }}>
    {(groups || [{ items }]).map((g, i) => (
      <div key={i}>
        {g.label && <div className="px-1 font-bold">{g.label}</div>}
        {g.items.map((c) => <div key={c} className={"px-1 " + (g.label ? "pl-4 " : "") + (c === sel ? "text-white" : "")} style={c === sel ? { background: "#1E6FD9" } : undefined}>{c}</div>)}
      </div>
    ))}
  </div>
);
const OldDotMenu = ({ items }) => (
  <div className="w-[196px] rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-sm">
    {items.map(([Icon, t, danger]) => <div key={t} className={"flex items-center gap-2 px-3 py-1.5 " + (danger ? "text-red-600" : "")}><Icon size={13} />{t}</div>)}
  </div>
);
const PhonePicker = ({ items, sel, title }) => (
  <div className="rounded-2xl bg-white shadow-xl overflow-hidden font-[system-ui]" style={{ color: "#000" }}>
    <div className="px-4 pt-3 pb-2 text-[13px] text-center" style={{ color: "#6b6b6b" }}>{title}</div>
    {items.map((c) => (
      <div key={c} className="flex items-center gap-3 px-4 py-3 border-t text-[16px]" style={{ borderColor: "#e5e5e5" }}>
        <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: c === sel ? "#1E6FD9" : "#9a9a9a" }}>{c === sel && <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#1E6FD9" }} />}</span>{c}
      </div>
    ))}
  </div>
);

const MENU = [[Copy, "Duplicate area"], [Pencil, "Rename"], [Printer, "Print this area"], [Trash2, "Delete area", true]];
const colorGroups = [
  { label: "In stock", items: GROUT_COLORS.stock.map((c) => ({ v: c, label: c })) },
  { label: "Special order", items: GROUT_COLORS.special.map((c) => ({ v: c, label: c })) },
];
const opts = (list) => list.map((c) => ({ v: c, label: c }));

function Pair({ title, note, today, next, h = 300 }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-extrabold">{title}</h2>
      {note && <p className="text-[12.5px] text-slate-500 max-w-4xl">{note}</p>}
      <div className="grid grid-cols-2 gap-5">
        <div><div className="ft-eyebrow text-[10px] mb-1.5">Today</div><div className="rounded-lg border border-slate-300 p-4" style={{ minHeight: h }}>{today}</div></div>
        <div><div className="ft-eyebrow text-[10px] mb-1.5" style={{ color: "var(--ft-brand)" }}>New style</div><div className="rounded-lg border border-slate-300 p-4" style={{ minHeight: h }}>{next}</div></div>
      </div>
    </section>
  );
}

const DrawerRow = ({ children }) => (
  <div className="rounded-md px-3 py-2" style={{ background: "var(--ft-tint)", border: "1px solid var(--ft-border)" }}>
    <div className="flex items-center gap-2"><span className="text-sm font-medium w-14">Grout</span>{children}</div>
  </div>
);

function Desktop() {
  const [gp, setGp] = useState("Prism");
  const [gc, setGc] = useState("Delorean Gray");
  const [mo, setMo] = useState("VersaBond");
  const [stain, setStain] = useState("Toasted Acorn");
  const [tex, setTex] = useState("Hand scraped");
  return (
    <div className="space-y-10">
      <Pair title="Materials drawer — grout color (long, grouped list)" h={340}
        note="The dropdown takes the drawer's own tint and grows into the list; the outline darkens around the whole piece. Long lists scroll inside it, with the In stock / Special order headings kept."
        today={<>
          <DrawerRow>
            <FitSelect sm value={gp} display={gp} onChange={(e) => setGp(e.target.value)}>{GROUT.map((g) => <option key={g}>{g}</option>)}</FitSelect>
            <FitSelect sm value={gc} display={gc} onChange={(e) => setGc(e.target.value)}>{GROUT_COLORS.stock.map((c) => <option key={c}>{c}</option>)}</FitSelect>
          </DrawerRow>
          <div className="pl-[88px] pt-0"><div className="pl-[70px]"><BrowserList sel={gc} groups={[{ label: "In stock", items: GROUT_COLORS.stock.slice(0, 7) }, { label: "Special order", items: GROUT_COLORS.special.slice(0, 3) }]} /></div></div>
          <p className="text-[11px] text-slate-400 mt-2">The open list is drawn by the browser (shown roughly) — it can't be styled.</p>
        </>}
        next={<DrawerRow>
          <MorphSelect value={gp} options={opts(GROUT)} onPick={setGp} bg="var(--ft-tint)" />
          <MorphSelect value={gc} groups={colorGroups} onPick={setGc} bg="var(--ft-tint)" startOpen openW={0} maxH={250} />
          <MorphSelect value={mo} options={opts(MORTAR)} onPick={setMo} bg="var(--ft-tint)" />
        </DrawerRow>} />

      <Pair title="Sheoga options — stain color and texture (white card)" h={320}
        note="Same piece on a white card: white dropdown, dark outline when open. Short lists never scroll."
        today={<div className="grid grid-cols-2 gap-3 max-w-[420px]">
          <div><div className="ft-eyebrow text-[10px] mb-1">Texture</div><select value={tex} onChange={(e) => setTex(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800">{["Smooth", "Hand scraped", "Wire brushed"].map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><div className="ft-eyebrow text-[10px] mb-1">Stain color</div><select value={stain} onChange={(e) => setStain(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800">{STAIN_COLORS.map((c) => <option key={c}>{c}</option>)}</select>
            <BrowserList sel={stain} items={STAIN_COLORS.slice(0, 11)} /></div>
        </div>}
        next={<div className="grid grid-cols-2 gap-3 max-w-[420px]">
          <div><div className="ft-eyebrow text-[10px] mb-1">Texture</div><MorphSelect bold value={tex} options={opts(["Smooth", "Hand scraped", "Wire brushed"])} onPick={setTex} /></div>
          <div><div className="ft-eyebrow text-[10px] mb-1">Stain color</div><MorphSelect bold value={stain} options={opts(STAIN_COLORS)} onPick={setStain} startOpen maxH={230} /></div>
        </div>} />

      <Pair title="⋯ action menu (area / company / price-book rows)" h={200}
        note="An icon can't grow into a list, so action menus keep popping out below the ⋯ — but with the same surface color, dark outline, shadow and slide-open."
        today={<div className="flex justify-end pr-24"><div className="flex flex-col items-end gap-1"><MoreHorizontal size={16} className="text-slate-500 mr-1.5" /><OldDotMenu items={MENU} /></div></div>}
        next={<div className="flex justify-end pr-24 rounded-md" style={{ background: "var(--ft-cream)" }}><MorphActionMenu items={MENU} bg="var(--ft-cream)" startOpen /></div>} />
    </div>
  );
}

function PhoneFrame({ label, children }) {
  return (
    <div>
      <div className="ft-eyebrow text-[10px] mb-1.5">{label}</div>
      <div className="rounded-[26px] border-[6px] border-slate-800 overflow-hidden" style={{ width: 360, height: 560, background: "var(--ft-cream)" }}>
        <div className="p-3 space-y-3 h-full relative">{children}</div>
      </div>
    </div>
  );
}

function Phone() {
  const [tier, setTier] = useState("builder");
  const [gc, setGc] = useState("Delorean Gray");
  return (
    <section className="space-y-2">
      <h2 className="text-base font-extrabold">Phone — grout color in the materials drawer</h2>
      <p className="text-[12.5px] text-slate-500 max-w-4xl">Today a phone opens its own full-screen chooser (it varies by phone — roughly the middle frame). The new style keeps the list on the page, with taller rows so they're easy to tap; the first frame shows the price level with the same treatment.</p>
      <div className="flex gap-6">
        <PhoneFrame label="New style — price level">
          <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "var(--ft-card)", border: "1px solid var(--ft-border)" }}>
            <span className="text-[13px] font-extrabold flex-1">Hartman kitchen</span>
            <MorphSelect phone dots bold value={tier} options={TIERS} onPick={setTier} startOpen openW={200} align="right" />
          </div>
        </PhoneFrame>
        <PhoneFrame label="Today — phone's own chooser">
          <DrawerRow><FitSelect sm value={gc} display={gc} onChange={() => {}}><option>{gc}</option></FitSelect></DrawerRow>
          <div className="absolute inset-0 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,.35)" }}>
            <div className="w-full"><PhonePicker title="Grout color" sel={gc} items={GROUT_COLORS.stock.slice(0, 7)} /></div>
          </div>
        </PhoneFrame>
        <PhoneFrame label="New style — grout color">
          <DrawerRow><MorphSelect phone value={gc} groups={colorGroups} onPick={setGc} bg="var(--ft-tint)" startOpen openW={220} maxH={330} /></DrawerRow>
        </PhoneFrame>
      </div>
    </section>
  );
}

function Page() {
  return (
    <div className="min-h-screen p-6 space-y-12" style={{ background: "var(--ft-cream)", width: 1240 }}>
      <h1 className="ft-serif text-2xl">Dropdowns in the price-level style</h1>
      <Desktop />
      <Phone />
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Page />);
