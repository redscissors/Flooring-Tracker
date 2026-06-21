import { useState, useEffect, useRef } from "react";
import { Search, Plus, Trash2, Settings, Save, Printer, Download, Upload, FileText, X, History, Layers, User, ChevronRight, Package, Check, LogOut } from "lucide-react";
import { supabase } from "./lib/supabase.js";

const MATS = ["mortar", "grout", "underlayment", "waterproofing"];

const DEFAULTS = {
  wastePct: 10,
  materials: {
    mortar: { label: "Mortar / Thinset", coverage: 95, unit: "bags" },
    grout: { label: "Grout", coverage: 100, unit: "bags" },
    underlayment: { label: "Underlayment", coverage: 15, unit: "sheets" },
    waterproofing: { label: "Waterproofing", coverage: 50, unit: "gallons" },
  },
};

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

const newAddons = () => MATS.reduce((o, k) => ({ ...o, [k]: { checked: false, manual: "" } }), {});
const newCategory = () => ({ id: uid(), name: "New Area", product: "", brand: "", color: "", size: "", qtyType: "sqft", qty: "", addons: newAddons() });
const newCustomer = () => ({ id: uid(), name: "New Customer", address: "", phone: "", email: "", notes: "", createdAt: Date.now(), categories: [], versions: [] });

function matQty(cat, key, settings) {
  if (cat.qtyType !== "sqft") return null;
  const sqft = num(cat.qty);
  if (!sqft) return 0;
  const m = settings.materials[key];
  const cov = num(m.coverage) || 1;
  return Math.ceil((sqft * (1 + num(settings.wastePct) / 100)) / cov);
}
function addonVal(cat, key, settings) {
  const a = cat.addons?.[key] || {};
  if (a.manual !== "" && a.manual != null) return num(a.manual);
  return matQty(cat, key, settings);
}

export default function App({ user, onSignOut }) {
  const [data, setData] = useState({ customers: [], settings: DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState(null);
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: row, error } = await supabase
          .from("app_data")
          .select("data")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (row && row.data) {
          const p = row.data;
          setData({ customers: p.customers || [], settings: { ...DEFAULTS, ...(p.settings || {}) } });
        }
      } catch (e) {
        ping("Could not load your data — check connection");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const persist = async (next) => {
    setData(next);
    try {
      const { error } = await supabase
        .from("app_data")
        .upsert({ user_id: user.id, data: next }, { onConflict: "user_id" });
      if (error) throw error;
    } catch (e) {
      ping("Save failed — try a backup export");
    }
  };
  const ping = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const sel = data.customers.find((c) => c.id === selId) || null;
  const updateCust = (id, patch) => persist({ ...data, customers: data.customers.map((c) => c.id === id ? { ...c, ...patch } : c) });

  const addCustomer = () => { const c = newCustomer(); persist({ ...data, customers: [c, ...data.customers] }); setSelId(c.id); };
  const delCustomer = (id) => { persist({ ...data, customers: data.customers.filter((c) => c.id !== id) }); if (selId === id) setSelId(null); setConfirm(null); };

  const addCategory = () => updateCust(sel.id, { categories: [...sel.categories, newCategory()] });
  const updateCategory = (cid, patch) => updateCust(sel.id, { categories: sel.categories.map((c) => c.id === cid ? { ...c, ...patch } : c) });
  const delCategory = (cid) => updateCust(sel.id, { categories: sel.categories.filter((c) => c.id !== cid) });
  const setAddon = (cid, key, patch) => {
    const cat = sel.categories.find((c) => c.id === cid);
    updateCategory(cid, { addons: { ...cat.addons, [key]: { ...cat.addons[key], ...patch } } });
  };

  const saveVersion = () => {
    const label = (typeof prompt === "function" && prompt("Name this version (e.g. 'Client approved v1')")) || `Version ${(sel.versions?.length || 0) + 1}`;
    const v = { id: uid(), label, savedAt: Date.now(), snapshot: JSON.parse(JSON.stringify(sel.categories)) };
    updateCust(sel.id, { versions: [v, ...(sel.versions || [])] });
    ping("Version saved");
  };
  const loadVersion = (v) => { updateCust(sel.id, { categories: JSON.parse(JSON.stringify(v.snapshot)) }); setShowVersions(false); ping("Version loaded"); };
  const delVersion = (vid) => updateCust(sel.id, { versions: sel.versions.filter((v) => v.id !== vid) });

  const exportCSV = () => {
    const head = ["Customer", "Area", "Product", "Brand", "Color", "Size", "Type", "Qty", ...MATS.map((k) => data.settings.materials[k].label)];
    const rows = sel.categories.map((cat) => {
      const mats = MATS.map((k) => cat.addons[k]?.checked ? (addonVal(cat, k, data.settings) ?? "") : "");
      return [sel.name, cat.name, cat.product, cat.brand, cat.color, cat.size, cat.qtyType, cat.qty, ...mats];
    });
    const csv = [head, ...rows].map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    dl(new Blob([csv], { type: "text/csv" }), `${sel.name.replace(/\s+/g, "_")}_selections.csv`);
  };
  const exportBackup = () => dl(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `floortrack_backup_${new Date().toISOString().slice(0, 10)}.json`);
  const importBackup = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => { try { const p = JSON.parse(fr.result); persist({ customers: p.customers || [], settings: { ...DEFAULTS, ...(p.settings || {}) } }); ping("Backup restored"); } catch (x) { ping("Invalid backup file"); } };
    fr.readAsText(f); e.target.value = "";
  };
  const dl = (blob, name) => { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); };

  const filtered = data.customers.filter((c) => {
    const q = search.toLowerCase();
    return !q || [c.name, c.address, c.phone, c.email].some((f) => (f || "").toLowerCase().includes(q));
  });

  const totals = sel ? MATS.reduce((o, k) => {
    o[k] = sel.categories.reduce((s, cat) => s + (cat.addons[k]?.checked ? (addonVal(cat, k, data.settings) || 0) : 0), 0);
    return o;
  }, {}) : {};

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-400">Loading…</div>;

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
  const lbl = "text-xs font-medium text-slate-500 mb-1 block";

  return (
    <div className="h-screen bg-slate-50 text-slate-800 flex flex-col" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`@media print{ @page{ margin:1.4cm } body{ -webkit-print-color-adjust:exact; print-color-adjust:exact } }`}</style>

      {/* APP UI */}
      <div className="print:hidden flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center"><Layers size={18} className="text-white" /></div>
            <div><div className="font-semibold tracking-tight">FloorTrack</div><div className="text-xs text-slate-400 -mt-0.5">Selection manager</div></div>
          </div>
          <div className="p-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers…" className={inp + " pl-9"} />
            </div>
            <button onClick={addCustomer} className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 transition"><Plus size={16} /> New Customer</button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {filtered.length === 0 && <div className="text-center text-sm text-slate-400 mt-8 px-4">{search ? "No matches" : "No customers yet"}</div>}
            {filtered.map((c) => (
              <button key={c.id} onClick={() => setSelId(c.id)} className={`w-full text-left rounded-lg px-3 py-2.5 mb-1 transition group flex items-center gap-2 ${selId === c.id ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-slate-50"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${selId === c.id ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"}`}>{(c.name || "?").slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.name || "Untitled"}</div>
                  <div className="text-xs text-slate-400 truncate">{c.categories.length} area{c.categories.length !== 1 ? "s" : ""}{c.address ? ` · ${c.address}` : ""}</div>
                </div>
                {selId === c.id && <ChevronRight size={15} className="text-indigo-400" />}
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-slate-100 space-y-2">
            <div className="flex gap-2">
              <button onClick={() => setShowSettings(true)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm py-2 text-slate-600"><Settings size={15} /> Settings</button>
              <button onClick={exportBackup} title="Backup all data" className="rounded-lg border border-slate-200 hover:bg-slate-50 px-2.5 text-slate-600"><Download size={15} /></button>
              <button onClick={() => fileRef.current?.click()} title="Restore backup" className="rounded-lg border border-slate-200 hover:bg-slate-50 px-2.5 text-slate-600"><Upload size={15} /></button>
              <input ref={fileRef} type="file" accept="application/json" onChange={importBackup} className="hidden" />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-semibold shrink-0">{(user.email || "?").slice(0, 1).toUpperCase()}</div>
              <span className="truncate flex-1" title={user.email}>{user.email}</span>
              <button onClick={onSignOut} title="Sign out" className="rounded-lg border border-slate-200 hover:bg-slate-50 p-1.5 text-slate-500"><LogOut size={14} /></button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          {!sel ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4"><User size={28} className="text-indigo-500" /></div>
              <h2 className="text-lg font-semibold">Select or create a customer</h2>
              <p className="text-sm text-slate-400 mt-1 max-w-xs">Add a customer, then build out their flooring and tile selections by area.</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto p-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-5">
                <input value={sel.name} onChange={(e) => updateCust(sel.id, { name: e.target.value })} className="text-2xl font-semibold tracking-tight bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none flex-1 pb-1" />
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button onClick={saveVersion} className="flex items-center gap-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 px-3 py-2"><Save size={15} /> Save version</button>
                  <button onClick={() => setShowVersions(true)} className="flex items-center gap-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 px-3 py-2"><History size={15} /> {(sel.versions?.length || 0)}</button>
                  <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 px-3 py-2"><FileText size={15} /> CSV</button>
                  <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2"><Printer size={15} /> Print / PDF</button>
                  <button onClick={() => setConfirm({ type: "cust", id: sel.id })} className="rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 px-2.5 py-2 text-slate-400"><Trash2 size={15} /></button>
                </div>
              </div>

              {/* Customer info */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 grid grid-cols-2 gap-3">
                <div><label className={lbl}>Address</label><input value={sel.address} onChange={(e) => updateCust(sel.id, { address: e.target.value })} className={inp} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Phone</label><input value={sel.phone} onChange={(e) => updateCust(sel.id, { phone: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>Email</label><input value={sel.email} onChange={(e) => updateCust(sel.id, { email: e.target.value })} className={inp} /></div>
                </div>
                <div className="col-span-2"><label className={lbl}>Project notes</label><textarea value={sel.notes} onChange={(e) => updateCust(sel.id, { notes: e.target.value })} rows={2} className={inp} /></div>
              </div>

              {/* Categories */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Areas & Selections</h3>
                <button onClick={addCategory} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"><Plus size={15} /> Add area</button>
              </div>

              {sel.categories.length === 0 && <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">No areas yet. Add a room or project area to start.</div>}

              <div className="space-y-4">
                {sel.categories.map((cat) => (
                  <div key={cat.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <input value={cat.name} onChange={(e) => updateCategory(cat.id, { name: e.target.value })} className="font-semibold bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none flex-1" />
                      <button onClick={() => delCategory(cat.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div><label className={lbl}>Product</label><input value={cat.product} onChange={(e) => updateCategory(cat.id, { product: e.target.value })} className={inp} /></div>
                      <div><label className={lbl}>Brand</label><input value={cat.brand} onChange={(e) => updateCategory(cat.id, { brand: e.target.value })} className={inp} /></div>
                      <div><label className={lbl}>Color</label><input value={cat.color} onChange={(e) => updateCategory(cat.id, { color: e.target.value })} className={inp} /></div>
                      <div><label className={lbl}>Size</label><input value={cat.size} onChange={(e) => updateCategory(cat.id, { size: e.target.value })} className={inp} /></div>
                    </div>
                    <div className="flex items-end gap-3 mb-4">
                      <div className="w-40"><label className={lbl}>Quantity</label><input type="number" value={cat.qty} onChange={(e) => updateCategory(cat.id, { qty: e.target.value })} className={inp} placeholder="0" /></div>
                      <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
                        {["sqft", "count"].map((t) => (
                          <button key={t} onClick={() => updateCategory(cat.id, { qtyType: t })} className={`px-3 py-2 ${cat.qtyType === t ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>{t === "sqft" ? "Sq Ft" : "Count"}</button>
                        ))}
                      </div>
                    </div>
                    {/* Add-ons */}
                    <div className="border-t border-slate-100 pt-3">
                      <div className="text-xs font-medium text-slate-400 mb-2">Material add-ons {cat.qtyType !== "sqft" && <span className="text-amber-500">(auto-calc needs Sq Ft — enter manually)</span>}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {MATS.map((k) => {
                          const m = data.settings.materials[k];
                          const on = cat.addons[k]?.checked;
                          const v = addonVal(cat, k, data.settings);
                          return (
                            <div key={k} className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition ${on ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100"}`}>
                              <button onClick={() => setAddon(cat.id, k, { checked: !on })} className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${on ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{on && <Check size={13} />}</button>
                              <span className="text-sm flex-1">{m.label}</span>
                              {on && (
                                <div className="flex items-center gap-1">
                                  <input value={cat.addons[k].manual} onChange={(e) => setAddon(cat.id, k, { manual: e.target.value })} placeholder={v != null ? String(v) : "—"} className="w-16 text-right rounded border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                  <span className="text-xs text-slate-400 w-12">{m.unit}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              {sel.categories.length > 0 && (
                <div className="bg-slate-900 text-white rounded-xl p-4 mt-5">
                  <div className="flex items-center gap-2 mb-3 text-sm font-semibold"><Package size={16} /> Material Order Summary</div>
                  <div className="grid grid-cols-4 gap-3">
                    {MATS.map((k) => (
                      <div key={k} className="bg-white/5 rounded-lg p-3">
                        <div className="text-2xl font-semibold">{totals[k] || 0}</div>
                        <div className="text-xs text-slate-300">{data.settings.materials[k].unit} · {data.settings.materials[k].label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-slate-400 mt-3">Estimates include {data.settings.wastePct}% waste. Verify against product coverage before ordering.</div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* PRINT VIEW */}
      <div className="hidden print:block text-black p-2">
        {sel && (
          <div>
            <div className="flex justify-between items-end border-b-2 border-black pb-3 mb-4">
              <div><div className="text-2xl font-bold">{sel.name}</div><div className="text-sm">{sel.address}</div><div className="text-sm">{[sel.phone, sel.email].filter(Boolean).join(" · ")}</div></div>
              <div className="text-right text-sm"><div className="font-semibold">Flooring & Tile Selections</div><div>{new Date().toLocaleDateString()}</div></div>
            </div>
            {sel.notes && <div className="text-sm mb-4 italic">{sel.notes}</div>}
            {sel.categories.map((cat) => (
              <div key={cat.id} className="mb-4 break-inside-avoid">
                <div className="font-bold text-lg border-b border-slate-300">{cat.name}</div>
                <div className="grid grid-cols-2 gap-x-8 text-sm mt-1">
                  {cat.product && <div><b>Product:</b> {cat.product}</div>}
                  {cat.brand && <div><b>Brand:</b> {cat.brand}</div>}
                  {cat.color && <div><b>Color:</b> {cat.color}</div>}
                  {cat.size && <div><b>Size:</b> {cat.size}</div>}
                  {cat.qty && <div><b>Quantity:</b> {cat.qty} {cat.qtyType === "sqft" ? "sq ft" : "units"}</div>}
                </div>
                {MATS.some((k) => cat.addons[k]?.checked) && (
                  <table className="text-sm mt-2 w-full"><tbody>
                    {MATS.filter((k) => cat.addons[k]?.checked).map((k) => (
                      <tr key={k}><td className="py-0.5 pr-4">{data.settings.materials[k].label}</td><td className="font-semibold">{addonVal(cat, k, data.settings)} {data.settings.materials[k].unit}</td></tr>
                    ))}
                  </tbody></table>
                )}
              </div>
            ))}
            <div className="mt-6 border-t-2 border-black pt-3">
              <div className="font-bold mb-1">Total Materials Needed</div>
              <table className="text-sm w-full"><tbody>
                {MATS.filter((k) => totals[k] > 0).map((k) => (
                  <tr key={k}><td className="py-0.5 pr-4">{data.settings.materials[k].label}</td><td className="font-semibold">{totals[k]} {data.settings.materials[k].unit}</td></tr>
                ))}
              </tbody></table>
              <div className="text-xs mt-3 text-slate-600">Quantities are estimates including {data.settings.wastePct}% waste, based on configured coverage rates. Confirm against actual product specifications before ordering.</div>
            </div>
          </div>
        )}
      </div>

      {/* Settings modal */}
      {showSettings && (
        <Modal onClose={() => setShowSettings(false)} title="Coverage & Settings">
          <p className="text-sm text-slate-500 mb-4">Set how much area each unit of material covers. These drive the auto-calculations. Adjust to match the products you actually use.</p>
          <div className="mb-4"><label className={lbl}>Waste factor (%)</label><input type="number" value={data.settings.wastePct} onChange={(e) => persist({ ...data, settings: { ...data.settings, wastePct: e.target.value } })} className={inp + " w-28"} /></div>
          <div className="space-y-3">
            {MATS.map((k) => {
              const m = data.settings.materials[k];
              const set = (patch) => persist({ ...data, settings: { ...data.settings, materials: { ...data.settings.materials, [k]: { ...m, ...patch } } } });
              return (
                <div key={k} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5"><label className={lbl}>Name</label><input value={m.label} onChange={(e) => set({ label: e.target.value })} className={inp} /></div>
                  <div className="col-span-3"><label className={lbl}>Sq ft / unit</label><input type="number" value={m.coverage} onChange={(e) => set({ coverage: e.target.value })} className={inp} /></div>
                  <div className="col-span-4"><label className={lbl}>Unit label</label><input value={m.unit} onChange={(e) => set({ unit: e.target.value })} className={inp} /></div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {/* Versions modal */}
      {showVersions && sel && (
        <Modal onClose={() => setShowVersions(false)} title="Saved Versions">
          {(!sel.versions || sel.versions.length === 0) ? <p className="text-sm text-slate-400">No versions saved yet. Use "Save version" to snapshot the current selections.</p> : (
            <div className="space-y-2">
              {sel.versions.map((v) => (
                <div key={v.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex-1"><div className="text-sm font-medium">{v.label}</div><div className="text-xs text-slate-400">{new Date(v.savedAt).toLocaleString()} · {v.snapshot.length} areas</div></div>
                  <button onClick={() => loadVersion(v)} className="text-sm rounded-lg bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700">Restore</button>
                  <button onClick={() => delVersion(v.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Confirm */}
      {confirm && (
        <Modal onClose={() => setConfirm(null)} title="Delete customer?">
          <p className="text-sm text-slate-500 mb-4">This permanently removes the customer and all their selections and versions. Consider a backup export first.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirm(null)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
            <button onClick={() => delCustomer(confirm.id)} className="text-sm rounded-lg bg-red-600 text-white px-4 py-2 hover:bg-red-700">Delete</button>
          </div>
        </Modal>
      )}

      {toast && <div className="print:hidden fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="print:hidden fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-lg">{title}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}
