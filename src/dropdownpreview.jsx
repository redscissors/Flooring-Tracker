// Dev-only harness (dropdown-preview.html): today's dropdowns beside the REAL
// MorphSelect / DotMenu (ADR 0048), desktop and phone, plus a zoomed
// workspace and a near-the-bottom flip. Not part of the app build.
import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { MoreHorizontal, Copy, Pencil, Printer, Trash2 } from "lucide-react";
import "./index.css";
import { MorphSelect, DotMenu } from "./widgets.jsx";
import { TIER_COLOR } from "./uiconst.js";
import { STAIN_COLORS } from "./sheoga.js";

const GROUT = ["Prism", "Permacolor Select", "Polyblend Plus", "SpectraLOCK Pro"];
const GROUT_COLORS = {
  stock: ["Bright White", "Delorean Gray", "Frost", "Oyster Gray", "Pewter", "Charcoal", "Sandstone", "Natural Gray", "Linen", "Haystack", "Alabaster", "Summer Wheat"],
  special: ["Antique White", "Bone", "Earth", "Fawn", "Light Smoke", "Mocha", "Quarry Red", "Sable Brown", "Tobacco Road", "Walnut", "Driftwood", "Slate Gray"],
};
const MORTAR = ["VersaBond", "MegaLite", "Ultraflex LFT", "RapidSet"];
const tierDot = (v) => TIER_COLOR[v]?.main || "var(--ft-text)";
const TIERS = [
  { v: "retail", label: "Retail", dot: tierDot("retail") },
  { v: "builder", label: "Builder", note: "−10%", dot: tierDot("builder") },
  { v: "employee", label: "Employee", note: "cost +6%", dot: tierDot("employee") },
  { v: "sale", label: "Sale", note: "−15%", dot: tierDot("sale") },
];

// Today's drawer dropdown (the retired FitSelect): a browser <select>.
const FitSelect = ({ display, children, ...rest }) => (
  <span className="relative inline-block max-w-full align-middle">
    <span aria-hidden="true" className="invisible block truncate whitespace-pre border border-transparent pl-1.5 pr-5 py-0.5 text-xs">{display || " "}</span>
    <select {...rest} className="ft-field absolute inset-0 w-full h-full rounded-md border border-slate-200 pl-1.5 pr-1 py-0.5 text-xs">{children}</select>
  </span>
);

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

function ActionMenu({ items, bg }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  return (
    <>
      <button ref={ref} onClick={() => setOpen((o) => !o)} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-[color:var(--ft-hover)]"><MoreHorizontal size={16} /></button>
      <DotMenu open={open} onClose={() => setOpen(false)} anchorRef={ref} width={196} bg={bg}>
        {items.map(([Icon, t, danger]) => (
          <button key={t} onClick={() => setOpen(false)} className={"w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] font-semibold text-left hover:bg-[color:var(--ft-hover)] " + (danger ? "text-red-600" : "text-slate-600")}>
            <Icon size={13} className="shrink-0" />{t}
          </button>
        ))}
      </DotMenu>
    </>
  );
}

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
            <FitSelect value={gp} display={gp} onChange={(e) => setGp(e.target.value)}>{GROUT.map((g) => <option key={g}>{g}</option>)}</FitSelect>
            <FitSelect value={gc} display={gc} onChange={(e) => setGc(e.target.value)}>{GROUT_COLORS.stock.map((c) => <option key={c}>{c}</option>)}</FitSelect>
          </DrawerRow>
          <div className="pl-[88px] pt-0"><div className="pl-[70px]"><BrowserList sel={gc} groups={[{ label: "In stock", items: GROUT_COLORS.stock.slice(0, 7) }, { label: "Special order", items: GROUT_COLORS.special.slice(0, 3) }]} /></div></div>
          <p className="text-[11px] text-slate-400 mt-2">The open list is drawn by the browser (shown roughly) — it can't be styled.</p>
        </>}
        next={<DrawerRow>
          <MorphSelect size="sm" value={gp} options={opts(GROUT)} onChange={setGp} bg="var(--ft-tint)" />
          <span data-shot="grout"><MorphSelect size="sm" value={gc} groups={colorGroups} onChange={setGc} bg="var(--ft-tint)" /></span>
          <MorphSelect size="sm" value={mo} options={opts(MORTAR)} onChange={setMo} bg="var(--ft-tint)" />
        </DrawerRow>} />

      <Pair title="Sheoga options — stain color and texture (white card)" h={320}
        note="Same piece on a white card: white dropdown, dark outline when open. Short lists never scroll."
        today={<div className="grid grid-cols-2 gap-3 max-w-[420px]">
          <div><div className="ft-eyebrow text-[10px] mb-1">Texture</div><select value={tex} onChange={(e) => setTex(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800">{["Smooth", "Hand scraped", "Wire brushed"].map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><div className="ft-eyebrow text-[10px] mb-1">Stain color</div><select value={stain} onChange={(e) => setStain(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800">{STAIN_COLORS.map((c) => <option key={c}>{c}</option>)}</select>
            <BrowserList sel={stain} items={STAIN_COLORS.slice(0, 11)} /></div>
        </div>}
        next={<div className="grid grid-cols-2 gap-3 max-w-[420px]">
          <div><div className="ft-eyebrow text-[10px] mb-1">Texture</div><MorphSelect full bold value={tex} options={opts(["Smooth", "Hand scraped", "Wire brushed"])} onChange={setTex} /></div>
          <div><div className="ft-eyebrow text-[10px] mb-1">Stain color</div><span data-shot="stain"><MorphSelect full bold value={stain} options={opts(STAIN_COLORS)} onChange={setStain} /></span></div>
        </div>} />

      <Pair title="⋯ action menu (area / company / price-book rows)" h={200}
        note="An icon can't grow into a list, so action menus keep popping out below the ⋯ — but with the same surface color, dark outline, shadow and slide-open."
        today={<div className="flex justify-end pr-24"><div className="flex flex-col items-end gap-1"><MoreHorizontal size={16} className="text-slate-500 mr-1.5" /><OldDotMenu items={MENU} /></div></div>}
        next={<div data-shot="menu" className="flex justify-end pr-24 rounded-md" style={{ background: "var(--ft-cream)" }}><ActionMenu items={MENU} bg="var(--ft-cream)" /></div>} />
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
            <span data-shot="tier"><MorphSelect tinted bold value={tier} options={TIERS} onChange={setTier} minOpenW={200} align="right" /></span>
          </div>
        </PhoneFrame>
        <PhoneFrame label="Today — phone's own chooser">
          <DrawerRow><FitSelect value={gc} display={gc} onChange={() => {}}><option>{gc}</option></FitSelect></DrawerRow>
          <div className="absolute inset-0 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,.35)" }}>
            <div className="w-full"><PhonePicker title="Grout color" sel={gc} items={GROUT_COLORS.stock.slice(0, 7)} /></div>
          </div>
        </PhoneFrame>
        <PhoneFrame label="New style — grout color">
          <DrawerRow><span data-shot="groutphone"><MorphSelect value={gc} groups={colorGroups} onChange={setGc} bg="var(--ft-tint)" /></span></DrawerRow>
        </PhoneFrame>
      </div>
    </section>
  );
}

function Edges() {
  const [z, setZ] = useState("Caramel");
  const [f, setF] = useState("Frost");
  return (
    <>
      <section className="space-y-2">
        <h2 className="text-base font-extrabold">Inside a zoomed workspace (Settings / wedi at 75%)</h2>
        <div data-shot="zoom" className="rounded-lg border border-slate-300 p-4" style={{ zoom: 0.75, background: "var(--ft-card)", height: 360 }}>
          <MorphSelect bold value={z} options={opts(STAIN_COLORS)} onChange={setZ} />
        </div>
      </section>
      <section className="space-y-2 mt-[60vh]">
        <h2 className="text-base font-extrabold">Near the bottom of the screen — the list opens upward</h2>
        <div data-shot="flip"><MorphSelect value={f} groups={colorGroups} onChange={setF} /></div>
      </section>
    </>
  );
}

function Page() {
  return (
    <div className="min-h-screen p-6 space-y-12" style={{ background: "var(--ft-cream)", width: 1240 }}>
      <h1 className="ft-serif text-2xl">Dropdowns in the price-level style — click any new-style dropdown</h1>
      <Desktop />
      <Phone />
      <Edges />
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Page />);
