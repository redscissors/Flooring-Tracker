// PROTOTYPE — throwaway. Preview proof for the compact (Direction B) redesign of
// the Customer view and Project header. Mounted in Root.jsx behind ?proto=compact,
// before the auth gate, so it needs no Supabase. Delete once folded into App.jsx.
import { useState } from "react";
import {
  Phone, Mail, MapPin, Building2, StickyNote, Plus, ChevronRight, Save, History,
  FileText, ClipboardList, Printer, MoreHorizontal, Paperclip, Trash2,
} from "lucide-react";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";

const CUST = {
  name: "Delgado Residence",
  builder: "Hearthstone Homes",
  phone: "(828) 555-0147",
  email: "m.delgado@example.com",
  address: "418 Marlowe Ct, Asheville NC 28801",
  notes: "Repeat client — two prior jobs. Prefers warm neutrals; copy her designer on estimates.",
  projects: [
    { id: "p1", name: "Main Level Remodel", address: "418 Marlowe Ct", updated: "2 days ago" },
    { id: "p2", name: "Basement Suite", address: "418 Marlowe Ct · lower", updated: "1 week ago" },
    { id: "p3", name: "Guest Bath Refresh", address: "418 Marlowe Ct", updated: "3 weeks ago" },
  ],
};

const PROJ = {
  name: "Main Level Remodel",
  address: "418 Marlowe Ct",
  phone: "(828) 555-0147",
  builder: "Hearthstone Homes",
  customer: "Delgado Residence",
  total: "$18,240",
  sqft: "1,430",
  selections: 7,
  versions: 3,
  notes: "Client wants warm tones throughout; confirm stair nose finish before ordering.",
  attachments: ["floorplan.pdf", "inspiration.jpg"],
  areas: [
    { n: 1, name: "Kitchen", products: [
      { name: "Cortona Beige 12×24 porcelain", sku: "TIL-CB1224", qty: "312 sf", price: "$6.20/sf" },
      { name: "Warm Oak LVP · 7\" plank", sku: "LVP-WO7", qty: "148 sf", price: "$4.10/sf" },
    ]},
    { n: 2, name: "Master Bath", products: [
      { name: "Carrara Hex mosaic · matte", sku: "MOS-CH2", qty: "64 sf", price: "$11.80/sf" },
    ]},
    { n: 3, name: "Entry & Hall", products: [] },
  ],
};

// ---- shared bits ----
const pill = "flex items-center gap-1.5 text-sm rounded-full border border-slate-200 hover:bg-slate-50 px-3 py-1.5";
const iconPill = "flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 p-2";

function Chip({ icon: Icon, children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={"flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] transition " +
        (active
          ? "bg-indigo-50 text-slate-700 ring-1 ring-indigo-200"
          : "bg-slate-100 text-slate-500 hover:text-slate-700")}
    >
      <Icon size={13} className="opacity-70" />
      {children}
    </button>
  );
}

// ===================================================================
// CUSTOMER VIEW — Direction B
// ===================================================================
function CustomerViewB() {
  const [edit, setEdit] = useState(null);
  const toggle = (k) => setEdit((e) => (e === k ? null : k));
  const fields = {
    phone: { label: "Phone", value: CUST.phone },
    email: { label: "Email", value: CUST.email },
    address: { label: "Mailing address", value: CUST.address },
    builder: { label: "Builder", value: CUST.builder },
    notes: { label: "Customer notes", value: CUST.notes },
  };

  return (
    <div className="max-w-3xl mx-auto p-3 md:p-5">
      <div className="bg-white rounded-lg border border-slate-200" style={{ padding: "clamp(12px,1.8vw,18px)" }}>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="ft-eyebrow-accent text-[10px] mb-1.5">{CUST.builder} · Customer</div>
            <input value={CUST.name} readOnly className="ft-serif bg-transparent border-b-2 border-transparent focus:border-indigo-500 focus:outline-none pb-0.5 min-w-0" style={{ fontSize: "clamp(26px,4vw,34px)", lineHeight: 1 }} />
          </div>
          <div className="text-right shrink-0">
            <div className="ft-serif" style={{ fontSize: "clamp(22px,3vw,28px)", lineHeight: 1 }}>{CUST.projects.length}</div>
            <div className="ft-eyebrow text-[9px] mt-1">projects</div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
          <Chip icon={Phone} active={edit === "phone"} onClick={() => toggle("phone")}><b className="font-semibold text-slate-700">{CUST.phone}</b></Chip>
          <Chip icon={Mail} active={edit === "email"} onClick={() => toggle("email")}><b className="font-semibold text-slate-700">{CUST.email}</b></Chip>
          <Chip icon={MapPin} active={edit === "address"} onClick={() => toggle("address")}><span className="max-w-[12rem] truncate">{CUST.address}</span></Chip>
          <Chip icon={Building2} active={edit === "builder"} onClick={() => toggle("builder")}>{CUST.builder}</Chip>
          <Chip icon={StickyNote} active={edit === "notes"} onClick={() => toggle("notes")}>Notes</Chip>
          <span className="flex-1" />
          <button className={iconPill} title="More"><MoreHorizontal size={15} className="text-slate-400" /></button>
        </div>

        {edit && (
          <div className="mt-3">
            <label className={lbl}>{fields[edit].label}</label>
            {edit === "notes"
              ? <textarea value={fields[edit].value} readOnly rows={2} className={inp} />
              : <input value={fields[edit].value} readOnly className={inp} />}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6 mb-3 gap-2">
        <h2 className="ft-serif" style={{ fontSize: "clamp(22px,3vw,30px)", lineHeight: 1 }}>Projects</h2>
        <button className="flex items-center gap-1.5 text-sm font-semibold rounded-full border border-dashed border-slate-300 px-3.5 py-1.5 text-slate-500 hover:border-indigo-300 hover:text-indigo-700 transition"><Plus size={15} /> New project</button>
      </div>
      <div className="space-y-2">
        {CUST.projects.map((p) => (
          <button key={p.id} className="w-full text-left bg-white rounded-lg border border-slate-200 hover:border-indigo-300 transition p-4 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{p.name}</div>
              <div className="text-[12.5px] text-slate-400 truncate mt-px">{p.address}</div>
            </div>
            <div className="ft-mono text-[11px] text-slate-400 shrink-0 text-right">{p.updated}</div>
            <ChevronRight size={18} className="text-slate-300 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ===================================================================
// PROJECT HEADER — Direction B
// ===================================================================
function ProjectViewB() {
  const [showMeta, setShowMeta] = useState(null);
  const toggle = (k) => setShowMeta((e) => (e === k ? null : k));

  return (
    <div className="max-w-4xl mx-auto p-3 md:p-5">
      <div className="bg-white rounded-lg border border-slate-200 mb-4" style={{ padding: "clamp(12px,1.8vw,18px)" }}>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="ft-eyebrow-accent text-[10px] mb-1.5">{PROJ.customer} · Tile &amp; Flooring</div>
            <input value={PROJ.name} readOnly className="ft-serif bg-transparent border-b-2 border-transparent focus:border-indigo-500 focus:outline-none pb-0.5 min-w-0 w-full" style={{ fontSize: "clamp(24px,3.6vw,34px)", lineHeight: 1 }} />
          </div>
          <div className="text-right shrink-0">
            <div className="ft-serif" style={{ fontSize: "clamp(24px,3.2vw,32px)", lineHeight: 1 }}>{PROJ.total}</div>
            <div className="ft-mono text-[10.5px] text-slate-500 mt-1">{PROJ.sqft} sf · {PROJ.selections} selections</div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
          <Chip icon={MapPin} active={showMeta === "address"} onClick={() => toggle("address")}>{PROJ.address}</Chip>
          <Chip icon={Phone} active={showMeta === "phone"} onClick={() => toggle("phone")}>{PROJ.phone}</Chip>
          <Chip icon={StickyNote} active={showMeta === "notes"} onClick={() => toggle("notes")}>Notes</Chip>
          <Chip icon={Paperclip} active={showMeta === "files"} onClick={() => toggle("files")}><b className="font-semibold text-slate-700">{PROJ.attachments.length}</b> files</Chip>
          <span className="flex-1" />
          <button className={pill}><Save size={15} /> Version</button>
          <button className={iconPill} title={`History (${PROJ.versions})`}><History size={15} /></button>
          <button className={iconPill} title="Export CSV"><FileText size={15} /></button>
          <button className={iconPill} title="Order sheet"><ClipboardList size={15} /></button>
          <button className="flex items-center gap-1.5 text-sm rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 font-semibold"><Printer size={15} /> Print</button>
          <button className={iconPill} title="Delete"><Trash2 size={15} className="text-slate-400" /></button>
        </div>

        {showMeta === "notes" && (
          <div className="mt-3"><label className={lbl}>Project notes</label><textarea value={PROJ.notes} readOnly rows={2} className={inp} /></div>
        )}
        {showMeta === "files" && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {PROJ.attachments.map((f) => (
              <span key={f} className="flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs">{f}</span>
            ))}
            <button className="flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"><Plus size={12} /> Add</button>
          </div>
        )}
        {(showMeta === "address" || showMeta === "phone") && (
          <div className="mt-3"><label className={lbl}>{showMeta === "address" ? "Address" : "Phone"}</label><input value={showMeta === "address" ? PROJ.address : PROJ.phone} readOnly className={inp} /></div>
        )}
      </div>

      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="ft-serif" style={{ fontSize: "clamp(24px,3vw,34px)", lineHeight: 1 }}>Areas &amp; Selections</h2>
        <button className="flex items-center gap-1.5 text-sm font-semibold rounded-full border border-dashed border-slate-300 px-3.5 py-1.5 text-slate-500 hover:border-indigo-300 hover:text-indigo-700 transition"><Plus size={15} /> Add area</button>
      </div>
      <div className="space-y-4">
        {PROJ.areas.map((a) => (
          <div key={a.n} className="bg-white rounded-lg border border-slate-200 p-4 md:p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 ft-mono text-[11px] flex items-center justify-center">{a.n}</span>
              <span className="ft-serif" style={{ fontSize: 20 }}>{a.name}</span>
            </div>
            {a.products.map((p) => (
              <div key={p.sku} className="flex justify-between gap-3 rounded-md bg-slate-50/50 border border-slate-200 px-3 py-2 mt-2">
                <div>
                  <div className="text-sm">{p.name}</div>
                  <div className="ft-mono text-[10.5px] text-indigo-600">{p.sku}</div>
                </div>
                <div className="ft-mono text-[12px] text-right whitespace-nowrap">{p.qty}<br /><span className="text-slate-400">{p.price}</span></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================================================================
export default function CompactUiPrototype() {
  const [view, setView] = useState("customer");
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
        <span className="ft-eyebrow-accent text-[10px]">Prototype · Compact (B)</span>
        <div className="flex gap-1 ml-2">
          <button onClick={() => setView("customer")} className={"text-sm rounded-full px-3 py-1 " + (view === "customer" ? "bg-indigo-600 text-white" : "border border-slate-200 hover:bg-slate-50")}>Customer view</button>
          <button onClick={() => setView("project")} className={"text-sm rounded-full px-3 py-1 " + (view === "project" ? "bg-indigo-600 text-white" : "border border-slate-200 hover:bg-slate-50")}>Project view</button>
        </div>
        <span className="ml-auto text-[11px] text-slate-400">throwaway · ?proto=compact</span>
      </div>
      {view === "customer" ? <CustomerViewB /> : <ProjectViewB />}
    </div>
  );
}
