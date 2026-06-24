import { useState, useEffect, useRef } from "react";
import { Search, Plus, Trash2, Settings, Save, Printer, FileText, Download, Upload, X, History, Layers, User, Package, Check, Paperclip, Menu, LogOut, MapPin, Phone, Mail, Archive, ArchiveRestore, ChevronRight, ChevronDown } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import { num, normalizeSettings, withDerived, serializeSettings, groutExact, mortarExact, getGrout, getMortar, offeredGrouts, offeredMortars, isDuplicateName, addCompany, addProduct } from "./catalog.js";

const TYPES = ["tile", "hardwood", "vinyl", "laminate", "carpet"];
const TLBL = { tile: "Tile", hardwood: "Hardwood", vinyl: "Vinyl", laminate: "Laminate", carpet: "Carpet" };
const JOINTS = [{ label: '1/16"', v: 0.0625 }, { label: '1/8"', v: 0.125 }, { label: '3/16"', v: 0.1875 }];
const THICK = [{ label: '1/8"', v: "0.125" }, { label: '3/16"', v: "0.1875" }, { label: '1/4"', v: "0.25" }, { label: '5/16"', v: "0.3125" }, { label: '3/8"', v: "0.375" }, { label: '7/16"', v: "0.4375" }, { label: '1/2"', v: "0.5" }, { label: '5/8"', v: "0.625" }, { label: '3/4"', v: "0.75" }];
// Grout colors are code-defined (out of the persisted catalog — see ADR 0002),
// but keyed per grout product so each brand offers its own palette. A grout not
// listed here (e.g. a team-added one) falls back to DEFAULT_COLORS. The job's
// color picker resolves the list by the selected grout's name.
const DEFAULT_COLORS = ["Mushroom", "Natural Gray", "Bright White", "Dusty Grey", "Desert Khaki", "Latte", "Antique White", "Marble Beige", "Light Pewter", "Parchment", "Raven", "Sterling Silver", "Mocha", "Smoke Grey", "Silver Shadow", "Sand Beige", "Sauterne", "Platinum", "Midnight Black", "Espresso", "Butter Cream", "Silk", "Slate Grey", "Almond", "Toasted Almond", "Hemp", "Hot Cocoa", "Terra Cotta", "Quarry Red", "Chestnut Brown", "Autumn Green", "Twilight Blue", "Sandstone", "Fossil", "Walnut", "Mink", "Steamship", "Iron", "Frosty", "Stormy Grey"];
const GROUT_COLORS = {
  "Tec Power Grout": ["Antique White", "Birch", "Bright White", "Charcoal", "Coffee", "Dark Walnut", "Dove Grey", "Espresso", "Jet Black", "Light Bronze", "Light Buff", "Light Cool Gray", "Light Pewter", "Light Smoke", "Mist", "Mocha", "Optic White", "Pearl", "Praline", "Raven", "Sable", "Sandstone", "Silhouette", "Silverado", "Slate Grey", "Standard Grey", "Standard White", "Starry Night", "Sterling", "Summer Wheat", "Urban Bronze", "Warm Taupe"],
  "CEG-Lite": ["Bright White", "Snow White", "Antique White", "Alabaster", "Bone", "Linen", "Quartz", "Urban Putty", "Haystack", "Sandstone", "Mushroom", "Light Smoke", "Khaki", "Fawn", "Sahara Tan", "Summer Wheat", "Earth", "Nutmeg", "Walnut", "Chateau", "New Taupe", "Saddle Brown", "Tobacco Brown", "Sable Brown", "Truffle", "Surf Green", "Ice Blue", "Platinum", "Rolling Fog", "Bleached Wood", "Oyster Gray", "Cape Gray", "Delorean Gray", "Driftwood", "Graystone", "Natural Gray", "Winter Gray", "Pewter", "Dove Gray", "Charcoal"],
};
const colorsFor = (groutName) => GROUT_COLORS[groutName] || DEFAULT_COLORS;

const ATT_BUCKET = "attachments";
const SHARED_SETTINGS_ID = "singleton";
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const money = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPhone = (v) => { const d = (v || "").replace(/\D/g, "").slice(0, 10); if (d.length < 4) return d; if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`; return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`; };
const blobToDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
const dataURLToBlob = (dataURL) => { const [meta, b64] = String(dataURL).split(","); const mime = (meta.match(/:(.*?);/) || [])[1] || "application/octet-stream"; const bin = atob(b64 || ""); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: mime }); };

const newProduct = () => ({ id: uid(), type: "tile", L: "", W: "", thickness: "0.375", sizeText: "", brandColor: "", priceSqft: "", qtyType: "sqft", qty: "", note: "", grout: { checked: false, product: "PermaColor Select", color: "", joint: 0.125, manual: "" }, mortar: { checked: false, product: "ProLite", manual: "" } });
const newArea = () => ({ id: uid(), name: "New Area", note: "", products: [newProduct()] });
const newCustomer = () => ({ id: uid(), name: "New Customer", address: "", phone: "", email: "", notes: "", createdAt: Date.now(), categories: [], versions: [], attachments: [] });

const normP = (p) => ({ id: p.id || uid(), type: TYPES.includes(p.type) ? p.type : "tile", L: p.L ?? "", W: p.W ?? "", thickness: p.thickness ?? "0.375", sizeText: p.sizeText ?? (p.size || ""), brandColor: p.brandColor ?? [p.brand, p.color].filter(Boolean).join(" / "), priceSqft: p.priceSqft ?? "", qtyType: p.qtyType === "count" ? "count" : "sqft", qty: p.qty ?? "", note: p.note ?? "", grout: { checked: !!p.grout?.checked, product: p.grout?.product || "PermaColor Select", color: p.grout?.color || "", joint: p.grout?.joint ?? 0.125, manual: p.grout?.manual ?? "" }, mortar: { checked: !!p.mortar?.checked, product: p.mortar?.product || "ProLite", manual: p.mortar?.manual ?? "" } });
const normA = (a) => ({ id: a.id || uid(), name: a.name || "Area", note: a.note || "", products: (a.products || [{}]).map(normP) });
const normC = (c) => ({ ...c, categories: (c.categories || []).map(normA), versions: c.versions || [], attachments: c.attachments || [] });

export default function App({ user, onSignOut }) {
  const [data, setData] = useState(() => ({ customers: [], settings: normalizeSettings() }));
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [showArchive, setShowArchive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState("");
  const [focusArea, setFocusArea] = useState(null);
  const [focusName, setFocusName] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isWide, setIsWide] = useState(() => typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(min-width: 768px)").matches : true);
  const [namingVersion, setNamingVersion] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const fileRef = useRef(null);
  const attRef = useRef(null);
  const areaRefs = useRef({});
  const nameRef = useRef(null);
  const addressRef = useRef(null);
  const phoneRef = useRef(null);
  const emailRef = useRef(null);
  const addAreaRef = useRef(null);
  const saveOkTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        // The legacy per-user blob is still read: to pick up any customers
        // awaiting migration, and as the seed fallback for the shared settings.
        const { data: row, error } = await supabase.from("app_data").select("data").eq("user_id", user.id).maybeSingle();
        if (error) throw error;

        // Settings now live in one shared record every signed-in user reads and
        // writes (ADR 0002), no longer in per-user app_data.
        const settings = await loadSharedSettings(row?.data?.settings);

        // One-time migration: move any customers still embedded in the blob into
        // the customers table (and relocate their attachment files), then strip
        // them from the blob. Idempotent — safe to run on every load.
        const legacy = row?.data?.customers;
        if (Array.isArray(legacy) && legacy.length) {
          await migrateLegacyCustomers(legacy.map(normC));
        }

        const customers = await loadCustomers();
        setData({ customers, settings });
      } catch (e) { ping("Could not load your data — check connection"); }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Fetch every customer the current user may see (own + public), but LIGHT:
  // only the fields the list draws/searches/sorts, projected out of the jsonb
  // server-side. The heavy detail (categories/products/versions/attachments)
  // stays on the server until a customer is opened (see loadDetail).
  const loadCustomers = async () => {
    const { data: rows, error } = await supabase
      .from("customers")
      .select("id, owner_id, visibility, archived, created_at, name:data->>name, address:data->>address, phone:data->>phone, email:data->>email");
    if (error) throw error;
    return (rows || []).map((r) => ({
      id: r.id, ownerId: r.owner_id, visibility: r.visibility, archived: !!r.archived,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      name: r.name || "", address: r.address || "", phone: r.phone || "", email: r.email || "",
      _full: false,
    }));
  };

  // Lazy-load one customer's full record on open, merging it into the light row.
  // The column-backed fields (ownerId/visibility/archived) are re-applied over
  // the jsonb so they always win.
  const loadDetail = async (id) => {
    const existing = data.customers.find((c) => c.id === id);
    if (!existing || existing._full) return;
    try {
      const { data: row, error } = await supabase.from("customers").select("data").eq("id", id).maybeSingle();
      if (error) throw error;
      const full = normC(row?.data || {});
      setData((prev) => ({
        ...prev,
        customers: prev.customers.map((c) => c.id === id
          ? { ...c, ...full, id: c.id, ownerId: c.ownerId, visibility: c.visibility, archived: c.archived, createdAt: c.createdAt, _full: true }
          : c),
      }));
    } catch (e) { ping("Could not open customer — check connection"); }
  };

  // Read the one shared settings record. If it is missing or empty (the seed
  // migration hasn't run yet), seed it from this user's former per-user settings
  // — falling back to built-in defaults — so the team starts from real numbers.
  const loadSharedSettings = async (fallbackRaw) => {
    const { data: row, error } = await supabase.from("shared_settings").select("data").eq("id", SHARED_SETTINGS_ID).maybeSingle();
    if (error) throw error;
    const hasRow = row?.data && Object.keys(row.data).length;
    const settings = normalizeSettings(hasRow ? row.data : fallbackRaw);
    // Persist when the stored record is missing or still pre-catalog, so the
    // backfilled catalog (with stable ids) becomes the canonical shared copy.
    if (!hasRow || !row.data.catalog) {
      try { await supabase.from("shared_settings").upsert({ id: SHARED_SETTINGS_ID, data: serializeSettings(settings) }, { onConflict: "id" }); } catch (x) { /* best-effort seed */ }
    }
    return settings;
  };

  const migrateLegacyCustomers = async (legacy) => {
    for (const c of legacy) {
      // Move attachment files from <user_id>/<file_id> to <customer_id>/<file_id>.
      for (const m of (c.attachments || [])) {
        try {
          const { data: blob } = await supabase.storage.from(ATT_BUCKET).download(`${user.id}/${m.id}`);
          if (!blob) continue;
          await supabase.storage.from(ATT_BUCKET).upload(`${c.id}/${m.id}`, blob, { contentType: m.type, upsert: true });
          await supabase.storage.from(ATT_BUCKET).remove([`${user.id}/${m.id}`]);
        } catch (x) { /* best-effort */ }
      }
      const { ownerId, visibility, ...rest } = c;
      await supabase.from("customers").upsert(
        { id: c.id, owner_id: user.id, visibility: "private", data: rest, created_at: new Date(c.createdAt || Date.now()).toISOString() },
        { onConflict: "id", ignoreDuplicates: true }
      );
    }
    // Drop the migrated array from the blob. Settings have moved to the shared
    // store, so nothing else needs to live here anymore.
    await supabase.from("app_data").upsert({ user_id: user.id, data: {} }, { onConflict: "user_id" });
  };
  useEffect(() => { if (focusArea && areaRefs.current[focusArea]) { const el = areaRefs.current[focusArea]; el.focus(); el.select?.(); el.scrollIntoView?.({ behavior: "smooth", block: "center" }); setFocusArea(null); } }, [focusArea, data]);
  useEffect(() => { if (focusName && nameRef.current) { nameRef.current.focus(); nameRef.current.select?.(); const t = setTimeout(() => setFocusName(false), 1500); return () => clearTimeout(t); } }, [focusName]);
  useEffect(() => { const mq = window.matchMedia("(min-width: 768px)"); const on = () => setIsWide(mq.matches); on(); mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on); return () => { mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on); }; }, []);

  const ping = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const flashSaved = () => { if (saveOkTimer.current) clearTimeout(saveOkTimer.current); setSaveOk(true); saveOkTimer.current = setTimeout(() => setSaveOk(false), 2000); };

  // Strip the column-backed and in-memory-only fields before writing to jsonb.
  // (ownerId/visibility/archived are their own columns; _full is load state.)
  const custData = ({ ownerId, visibility, archived, _full, ...rest }) => rest;

  // Settings live in one shared record (ADR 0002) — last-write-wins across the
  // whole team, the same as a Public customer's data.
  const setSettings = (patch) => {
    const next = { ...data, settings: withDerived({ ...data.settings, ...patch }) };
    setData(next);
    (async () => { try { const { error } = await supabase.from("shared_settings").upsert({ id: SHARED_SETTINGS_ID, data: serializeSettings(next.settings) }, { onConflict: "id" }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
  };
  const settings = data.settings;
  const sel = data.customers.find((c) => c.id === selId) || null;

  // Every customer-content mutation goes through here: optimistic state update +
  // an UPDATE of that one row's data. (owner_id / visibility are never sent here
  // so the guard trigger only ever fires for the explicit visibility toggle.)
  const updateCust = (id, patch) => {
    const next = { ...data, customers: data.customers.map((c) => c.id === id ? { ...c, ...patch } : c) };
    setData(next);
    const cust = next.customers.find((c) => c.id === id);
    (async () => { try { const { error } = await supabase.from("customers").update({ data: custData(cust) }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
  };

  const isOwner = (c) => c && c.ownerId === user.id;
  const canEdit = (c) => c && (isOwner(c) || c.visibility === "public");
  const canDelete = (c) => c && (isOwner(c) || (c.visibility === "public" && Date.now() - (c.createdAt || 0) > 30 * 24 * 60 * 60 * 1000));

  const setVisibility = (id, visibility) => {
    setData((prev) => ({ ...prev, customers: prev.customers.map((c) => c.id === id ? { ...c, visibility } : c) }));
    (async () => { try { const { error } = await supabase.from("customers").update({ visibility }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Couldn't change sharing"); } })();
  };

  // Narrow write: touches only the archived column, never the data blob, so it
  // can't clobber a concurrent editor's changes. No owner check — anyone who can
  // edit a public job may archive/restore it (the guard trigger lets this pass).
  const setArchived = (id, archived) => {
    setData((prev) => ({ ...prev, customers: prev.customers.map((c) => c.id === id ? { ...c, archived } : c) }));
    (async () => { try { const { error } = await supabase.from("customers").update({ archived }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Couldn't change archive status"); } })();
  };

  const addCustomer = () => {
    const c = { ...newCustomer(), ownerId: user.id, visibility: "private", archived: false, _full: true };
    setData((prev) => ({ ...prev, customers: [c, ...prev.customers] }));
    setSelId(c.id); setSidebarOpen(false); setFocusName(true);
    (async () => { try { const { error } = await supabase.from("customers").insert({ id: c.id, owner_id: user.id, visibility: "private", data: custData(c), created_at: new Date(c.createdAt).toISOString() }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
  };
  const pickCustomer = (id) => { setSelId(id); setSidebarOpen(false); loadDetail(id); };
  const delCustomer = async (id) => {
    const cust = data.customers.find((c) => c.id === id);
    if (cust) { for (const m of (cust.attachments || [])) { try { await supabase.storage.from(ATT_BUCKET).remove([attPath(id, m.id)]); } catch (x) { } } }
    setData((prev) => ({ ...prev, customers: prev.customers.filter((c) => c.id !== id) }));
    if (selId === id) setSelId(null);
    setConfirm(null);
    try { const { error } = await supabase.from("customers").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); }
  };
  const addArea = () => { const a = newArea(); updateCust(sel.id, { categories: [...sel.categories, a] }); setFocusArea(a.id); };
  const tabTo = (ref) => (e) => { if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); ref.current?.focus(); ref.current?.select?.(); } };
  const updArea = (aid, patch) => updateCust(sel.id, { categories: sel.categories.map((a) => a.id === aid ? { ...a, ...patch } : a) });
  const delArea = (aid) => updateCust(sel.id, { categories: sel.categories.filter((a) => a.id !== aid) });
  const addProduct = (aid) => { const a = sel.categories.find((x) => x.id === aid); updArea(aid, { products: [...a.products, newProduct()] }); };
  const updProduct = (aid, pid, patch) => { const a = sel.categories.find((x) => x.id === aid); updArea(aid, { products: a.products.map((p) => p.id === pid ? { ...p, ...patch } : p) }); };
  const delProduct = (aid, pid) => { const a = sel.categories.find((x) => x.id === aid); updArea(aid, { products: a.products.filter((p) => p.id !== pid) }); };

  const attPath = (custId, fileId) => `${custId}/${fileId}`;
  const addAttachment = async (e) => { const f = e.target.files?.[0]; if (!f) return; const id = uid(); try { const { error } = await supabase.storage.from(ATT_BUCKET).upload(attPath(sel.id, id), f, { contentType: f.type, upsert: true }); if (error) throw error; updateCust(sel.id, { attachments: [...(sel.attachments || []), { id, name: f.name, type: f.type, size: f.size }] }); ping("Attachment added"); } catch (x) { ping("Upload failed — file may be too large"); } e.target.value = ""; };
  const openAttachment = async (m) => { try { const { data: blob, error } = await supabase.storage.from(ATT_BUCKET).download(attPath(sel.id, m.id)); if (error) throw error; const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = m.name; a.click(); URL.revokeObjectURL(u); } catch (x) { ping("Could not load attachment"); } };
  const delAttachment = async (m) => { try { await supabase.storage.from(ATT_BUCKET).remove([attPath(sel.id, m.id)]); } catch (x) { } updateCust(sel.id, { attachments: (sel.attachments || []).filter((x) => x.id !== m.id) }); };

  const startVersionName = () => { setVersionName(`Version ${(sel.versions?.length || 0) + 1}`); setNamingVersion(true); };
  const confirmVersion = () => { const label = versionName.trim() || `Version ${(sel.versions?.length || 0) + 1}`; updateCust(sel.id, { versions: [{ id: uid(), label, savedAt: Date.now(), snapshot: JSON.parse(JSON.stringify(sel.categories)) }, ...(sel.versions || [])] }); setNamingVersion(false); setVersionName(""); ping("Version saved"); };
  const loadVersion = (v) => { updateCust(sel.id, { categories: JSON.parse(JSON.stringify(v.snapshot)) }); setShowVersions(false); ping("Version loaded"); };
  const delVersion = (vid) => updateCust(sel.id, { versions: sel.versions.filter((v) => v.id !== vid) });

  const dl = (blob, name) => { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); };
  const exportCSV = () => {
    const head = ["Customer", "Area", "Type", "Size", "Brand/Color", "$/SqFt", "QtyType", "Qty", "Line Total", "Note", "Grout", "Grout Color", "Joint", "Grout Exact", "Grout Order", "Mortar", "Mortar Exact", "Mortar Order"]; const rows = [];
    sel.categories.forEach((a) => a.products.forEach((p) => { const size = p.type === "tile" ? `${p.L}x${p.W}x${p.thickness}` : p.sizeText; const j = JOINTS.find((x) => x.v === num(p.grout.joint))?.label || ""; const line = p.qtyType === "sqft" ? num(p.qty) * num(p.priceSqft) : ""; const G = getGrout(p, settings), M = getMortar(p, settings); rows.push([sel.name, a.name, TLBL[p.type], size, p.brandColor, p.priceSqft, p.qtyType, p.qty, line, p.note, G ? G.product : "", G ? G.color : "", G ? j : "", G ? G.exact.toFixed(2) : "", G ? G.order : "", M ? M.product : "", M ? M.exact.toFixed(2) : "", M ? M.order : ""]); }));
    const csv = [head, ...rows].map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    dl(new Blob([csv], { type: "text/csv" }), `${sel.name.replace(/\s+/g, "_")}_selections.csv`);
  };
  const exportBackup = async () => {
    // The in-memory list is light, so pull every full record before backing up.
    let customers;
    try {
      const { data: rows, error } = await supabase.from("customers").select("id, owner_id, visibility, archived, data, created_at");
      if (error) throw error;
      customers = (rows || []).map((r) => ({ ...normC(r.data || {}), id: r.id, ownerId: r.owner_id, visibility: r.visibility, archived: !!r.archived }));
    } catch (e) { ping("Backup failed — check connection"); return; }
    const attachments = {};
    for (const c of customers) for (const m of (c.attachments || [])) { try { const { data: blob } = await supabase.storage.from(ATT_BUCKET).download(attPath(c.id, m.id)); if (blob) attachments[m.id] = await blobToDataURL(blob); } catch (x) { } }
    dl(new Blob([JSON.stringify({ customers, settings: data.settings, attachments }, null, 2)], { type: "application/json" }), `floortrack_backup_${new Date().toISOString().slice(0, 10)}.json`);
  };
  const importBackup = (e) => { const f = e.target.files?.[0]; if (!f) return; const fr = new FileReader(); fr.onload = async () => { try {
    const p = JSON.parse(fr.result);
    // Restore each customer as a new owned, private row (with a fresh id so it
    // can't collide with an existing public customer), then upload its files.
    const restored = [];
    for (const raw of (p.customers || [])) {
      const c = { ...normC(raw), id: uid(), ownerId: user.id, visibility: "private", archived: false, _full: true };
      const idMap = {};
      c.attachments = (c.attachments || []).map((m) => { const nid = uid(); idMap[m.id] = nid; return { ...m, id: nid }; });
      try { const { error } = await supabase.from("customers").insert({ id: c.id, owner_id: user.id, visibility: "private", data: custData(c), created_at: new Date(c.createdAt || Date.now()).toISOString() }); if (error) throw error; } catch (x) { continue; }
      for (const m of c.attachments) { const val = p.attachments?.[Object.keys(idMap).find((k) => idMap[k] === m.id)]; if (!val) continue; try { await supabase.storage.from(ATT_BUCKET).upload(attPath(c.id, m.id), dataURLToBlob(val), { upsert: true }); } catch (x) { } }
      restored.push(c);
    }
    if (p.settings) setSettings(serializeSettings(normalizeSettings(p.settings)));
    setData((prev) => ({ ...prev, customers: [...restored, ...prev.customers] }));
    ping("Backup restored");
  } catch (x) { ping("Invalid file"); } }; fr.readAsText(f); e.target.value = ""; };

  let totalSqft = 0, flooringPrice = 0, groutCost = 0, mortarCost = 0; const gAgg = {}, mAgg = {};
  (sel?.categories || []).forEach((a) => a.products.forEach((p) => { if (p.qtyType === "sqft") { const sf = num(p.qty); totalSqft += sf; flooringPrice += sf * num(p.priceSqft); } const G = getGrout(p, settings); if (G) { groutCost += G.order * G.price; const k = G.product + "||" + (G.color || "—"); if (!gAgg[k]) gAgg[k] = { product: G.product, color: G.color || "—", unit: G.unit, exact: 0 }; gAgg[k].exact += G.exact; } const M = getMortar(p, settings); if (M) { mortarCost += M.order * M.price; const k = M.product; if (!mAgg[k]) mAgg[k] = { product: M.product, unit: M.unit, exact: 0 }; mAgg[k].exact += M.exact; } }));
  const gList = Object.values(gAgg).map((g) => ({ ...g, order: Math.ceil(g.exact) }));
  const mList = Object.values(mAgg).map((m) => ({ ...m, order: Math.ceil(m.exact) }));
  const hasMat = gList.length || mList.length; const grandTotal = flooringPrice + groutCost + mortarCost;
  const sortCustomers = (list) => [...list].sort((a, b) => sortBy === "name" ? (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }) : (b.createdAt || 0) - (a.createdAt || 0));
  // When searching, span both active and archived (archived rows are badged in
  // the list). With no search, the active list hides archived jobs and the
  // archive view shows only them.
  const q = search.trim().toLowerCase();
  const filtered = data.customers.filter((c) => {
    if (q) return [c.name, c.address, c.phone, c.email].some((f) => (f || "").toLowerCase().includes(q));
    return showArchive ? c.archived : !c.archived;
  });
  const mineList = sortCustomers(filtered.filter((c) => c.ownerId === user.id));
  const sharedList = sortCustomers(filtered.filter((c) => c.ownerId !== user.id));
  const archivedCount = data.customers.filter((c) => c.archived).length;

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
  const lbl = "text-xs font-medium text-slate-500 mb-1 block";

  const renderCustItem = (c) => (
    <button key={c.id} onClick={() => pickCustomer(c.id)} className={`w-full text-left rounded-md px-2.5 py-2 mb-0.5 transition flex items-center gap-2 ${selId === c.id ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-slate-50"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${selId === c.id ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"}`}>{(c.name || "?").slice(0, 1).toUpperCase()}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate flex items-center gap-1.5">{c.name || "Untitled"}{isOwner(c) && c.visibility === "public" && <span className="ft-public text-[10px] font-semibold uppercase tracking-wide rounded px-1 py-px shrink-0">Public</span>}{c.archived && <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-200 rounded px-1 py-px shrink-0">Archived</span>}</div>
        {c.address && <div className="text-xs text-slate-400 truncate">{c.address}</div>}
      </div>
    </button>
  );

  return (
    <div className="h-screen bg-slate-50 text-slate-800 flex flex-col" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
      <div className={`print:hidden flex ${isWide ? "flex-row" : "flex-col"} flex-1 overflow-hidden relative`}>
        {/* Mobile top bar */}
        {!isWide && (
          <div className="flex items-center gap-2 px-3 py-2 ft-rail border-b border-slate-200">
            <button onClick={() => setSidebarOpen(true)} className="p-1 -ml-1 text-slate-600"><Menu size={20} /></button>
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center"><Layers size={13} className="text-white" /></div>
            <span className="font-semibold text-sm truncate flex-1">{sel ? sel.name : "FloorTrack"}</span>
          </div>
        )}

        {!isWide && sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={isWide ? "ft-rail border-r border-slate-200 flex flex-col w-64 shrink-0" : `ft-rail border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center"><Layers size={18} className="text-white" /></div>
            <div className="flex-1"><div className="ft-display font-semibold uppercase tracking-[0.18em] text-[15px]">FloorTrack</div><div className="text-xs text-slate-400 -mt-0.5">Selection manager</div></div>
            {!isWide && <button onClick={() => setSidebarOpen(false)} className="text-slate-400"><X size={18} /></button>}
          </div>
          <div className="p-2.5 space-y-2">
            <div className="relative"><Search size={16} className="absolute left-2.5 top-2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers…" className={inp + " pl-8"} /></div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 shrink-0">Sort</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={inp + " py-1"}>
                <option value="newest">Newest first</option>
                <option value="name">Alphabetical</option>
              </select>
            </div>
            <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs">
              {[["Active", false], ["Archived", true]].map(([label, v]) => (
                <button key={label} onClick={() => setShowArchive(v)} className={`flex-1 px-2.5 py-1.5 ${showArchive === v ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{label}{v && archivedCount ? ` (${archivedCount})` : ""}</button>
              ))}
            </div>
            <button onClick={addCustomer} className="w-full flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-1.5 transition"><Plus size={16} /> New Customer</button>
          </div>
          <div className="flex-1 overflow-y-auto px-1.5 pb-2">
            {filtered.length === 0 && <div className="text-center text-sm text-slate-400 mt-8 px-4">{search ? "No matches" : "No customers yet"}</div>}
            {mineList.map((c) => renderCustItem(c))}
            {sharedList.length > 0 && (
              <div className="mt-3 mb-1 px-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Shared with everyone</div>
            )}
            {sharedList.map((c) => renderCustItem(c))}
          </div>
          <div className="p-2.5 border-t border-slate-100 space-y-2">
            <div className="flex gap-2">
              <button onClick={() => { setShowSettings(true); setSidebarOpen(false); }} className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-sm py-1.5 text-slate-600"><Settings size={15} /> Settings</button>
              <button onClick={exportBackup} title="Backup all data" className="rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 text-slate-600"><Download size={15} /></button>
              <button onClick={() => fileRef.current?.click()} title="Restore backup" className="rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 text-slate-600"><Upload size={15} /></button>
              <input ref={fileRef} type="file" accept="application/json" onChange={importBackup} className="hidden" />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-semibold shrink-0">{(user.email || "?").slice(0, 1).toUpperCase()}</div>
              <span className="truncate flex-1" title={user.email}>{user.email}</span>
              <span className="w-px h-4 bg-slate-200 shrink-0" />
              <button onClick={onSignOut} title="Sign out" className="rounded-md border border-slate-200 hover:bg-slate-50 p-1.5 text-slate-500"><LogOut size={14} /></button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          {!sel ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4"><User size={28} className="text-indigo-500" /></div>
              <h2 className="text-lg font-semibold">Select or create a customer</h2>
              <p className="text-sm text-slate-400 mt-1 max-w-xs">Tap the menu to pick a customer, or add a new one.</p>
            </div>
          ) : !sel._full ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading {sel.name || "customer"}…</div>
          ) : (
            <div className="max-w-4xl mx-auto p-3 md:p-5">
              <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <input ref={nameRef} onKeyDown={tabTo(addressRef)} value={sel.name} onChange={(e) => updateCust(sel.id, { name: e.target.value })} placeholder="Customer name" className={"text-2xl md:text-3xl font-bold tracking-tight bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none pb-0.5 min-w-0 flex-1 rounded-sm transition" + (focusName ? " ring-2 ring-indigo-500 ring-offset-2 bg-indigo-50/50" : "")} />
                      {saveOk && <span className="text-xs text-indigo-600 font-medium whitespace-nowrap">Saved ✓</span>}
                    </div>
                    <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5 min-w-0 sm:flex-1 sm:min-w-[12rem]"><MapPin size={14} className="shrink-0 text-slate-400" /><input ref={addressRef} onKeyDown={tabTo(phoneRef)} value={sel.address} onChange={(e) => updateCust(sel.id, { address: e.target.value })} placeholder="Address" className="bg-transparent focus:outline-none border-b border-transparent hover:border-slate-200 focus:border-indigo-500 min-w-0 flex-1" /></span>
                      <span className="flex items-center gap-1.5"><Phone size={14} className="shrink-0 text-slate-400" /><input ref={phoneRef} onKeyDown={tabTo(emailRef)} value={sel.phone} onChange={(e) => updateCust(sel.id, { phone: fmtPhone(e.target.value) })} placeholder="(216) 555-0192" className="bg-transparent focus:outline-none border-b border-transparent hover:border-slate-200 focus:border-indigo-500 w-36" /></span>
                      <span className="flex items-center gap-1.5"><Mail size={14} className="shrink-0 text-slate-400" /><input ref={emailRef} onKeyDown={tabTo(addAreaRef)} value={sel.email} onChange={(e) => updateCust(sel.id, { email: e.target.value })} placeholder="Email" className="bg-transparent focus:outline-none border-b border-transparent hover:border-slate-200 focus:border-indigo-500 w-44" /></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                    {isOwner(sel) ? (
                      <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs" title="Who can see this customer">
                        {["private", "public"].map((v) => <button key={v} onClick={() => setVisibility(sel.id, v)} className={`px-2.5 py-1.5 ${sel.visibility === v ? (v === "public" ? "ft-plum-fill text-white" : "bg-indigo-600 text-white") : "ft-field text-slate-500 hover:bg-slate-50"}`}>{v === "private" ? "Private" : "Public"}</button>)}
                      </div>
                    ) : (
                      <span className="ft-public text-xs font-medium rounded-md px-2.5 py-1.5">Shared</span>
                    )}
                    {namingVersion ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus value={versionName} onChange={(e) => setVersionName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmVersion(); if (e.key === "Escape") setNamingVersion(false); }} className="text-sm rounded-md border border-slate-200 px-2 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button onClick={confirmVersion} className="flex items-center gap-1 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5"><Check size={15} /></button>
                        <button onClick={() => setNamingVersion(false)} className="rounded-md border border-slate-200 hover:bg-slate-50 px-2 py-1.5 text-slate-400"><X size={15} /></button>
                      </div>
                    ) : (
                      <button onClick={startVersionName} className="flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5"><Save size={15} /> Version</button>
                    )}
                    <button onClick={() => setShowVersions(true)} className="flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5"><History size={15} /> {(sel.versions?.length || 0)}</button>
                    {canEdit(sel) && <button onClick={() => setArchived(sel.id, !sel.archived)} className="flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5" title={sel.archived ? "Restore to active list" : "Archive this job"}>{sel.archived ? <><ArchiveRestore size={15} /> Restore</> : <><Archive size={15} /> Archive</>}</button>}
                    <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5"><FileText size={15} /> CSV</button>
                    <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5"><Printer size={15} /> Print</button>
                    {canDelete(sel) && <button onClick={() => setConfirm({ id: sel.id })} className="rounded-md border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 px-2 py-1.5 text-slate-400"><Trash2 size={15} /></button>}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100"><label className={lbl}>Project notes</label><textarea value={sel.notes} onChange={(e) => updateCust(sel.id, { notes: e.target.value })} rows={2} className={inp} /></div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1"><Paperclip size={13} /> Attachments <span className="text-slate-300">(not printed)</span></span>
                  {(sel.attachments || []).map((m) => (
                    <span key={m.id} className="flex items-center gap-1.5 rounded-md bg-slate-100 pl-2 pr-1 py-1 text-xs"><button onClick={() => openAttachment(m)} className="hover:text-indigo-600 max-w-[10rem] truncate" title={`${m.name} · ${Math.max(1, Math.round(m.size / 1024))} KB`}>{m.name}</button><button onClick={() => delAttachment(m)} className="text-slate-400 hover:text-red-500"><X size={12} /></button></span>
                  ))}
                  <button onClick={() => attRef.current?.click()} className="flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"><Plus size={12} /> Add</button>
                  <input ref={attRef} type="file" onChange={addAttachment} className="hidden" />
                </div>
              </div>

              <div className="flex items-center justify-between mb-2 gap-2">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Areas &amp; Selections</h3>
                <div className="flex items-center gap-3">
                  <button ref={addAreaRef} onClick={addArea} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"><Plus size={15} /> Add area</button>
                </div>
              </div>

              {sel.categories.length === 0 && <div className="bg-white rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">No areas yet. Add one to start building this customer's selections.</div>}

              <div className="space-y-3">
                {sel.categories.map((a) => (
                  <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <input ref={(el) => { if (el) areaRefs.current[a.id] = el; }} value={a.name} onChange={(e) => updArea(a.id, { name: e.target.value })} className="font-semibold text-base bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none flex-1 min-w-0" />
                      <input value={a.note} onChange={(e) => updArea(a.id, { note: e.target.value })} placeholder="area note…" className="text-sm text-slate-500 bg-transparent focus:outline-none placeholder:text-slate-300 w-28 md:w-40 text-right" />
                      <button onClick={() => delArea(a.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                    </div>

                    <div className="space-y-2 mt-2">
                      {a.products.map((p) => {
                        const G = getGrout(p, settings), M = getMortar(p, settings);
                        const gEx = groutExact(p, settings), mEx = mortarExact(p, settings);
                        const sf = p.qtyType === "sqft" ? num(p.qty) : 0; const line = sf * num(p.priceSqft);
                        const thickKnown = THICK.some((t) => t.v === String(p.thickness));
                        // Dropdowns are driven by the catalog (resolve-by-name). A selection
                        // whose stored product is no longer offered is injected back as an
                        // option so it still shows — same pattern as tile thickness above.
                        const groutNames = offeredGrouts(settings.catalog), mortarNames = offeredMortars(settings.catalog);
                        const groutOpts = groutNames.includes(p.grout.product) ? groutNames : [p.grout.product, ...groutNames];
                        const colorBase = colorsFor(p.grout.product);
                        const colorOpts = (!p.grout.color || colorBase.includes(p.grout.color)) ? colorBase : [p.grout.color, ...colorBase];
                        const mortarOpts = mortarNames.includes(p.mortar.product) ? mortarNames : [p.mortar.product, ...mortarNames];
                        return (
                          <div key={p.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {p.type === "tile" ? (<>
                                <input type="number" value={p.L} onChange={(e) => updProduct(a.id, p.id, { L: e.target.value })} className={inp + " !w-12 shrink-0 px-1.5"} placeholder="L" title="Length (in)" />
                                <span className="text-slate-300 text-sm shrink-0">×</span>
                                <input type="number" value={p.W} onChange={(e) => updProduct(a.id, p.id, { W: e.target.value })} className={inp + " !w-12 shrink-0 px-1.5"} placeholder="W" title="Width (in)" />
                                <select value={p.thickness} onChange={(e) => updProduct(a.id, p.id, { thickness: e.target.value })} className={inp + " !w-20 shrink-0"} title="Thickness">{!thickKnown && <option value={p.thickness}>{p.thickness}"</option>}{THICK.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
                                <input value={p.brandColor} onChange={(e) => updProduct(a.id, p.id, { brandColor: e.target.value })} className={inp + " flex-1 min-w-[8rem]"} placeholder="Brand / color" />
                              </>) : (<>
                                <input value={p.sizeText} onChange={(e) => updProduct(a.id, p.id, { sizeText: e.target.value })} className={inp + " !w-28 shrink-0"} placeholder="Size" />
                                <input value={p.brandColor} onChange={(e) => updProduct(a.id, p.id, { brandColor: e.target.value })} className={inp + " flex-1 min-w-[8rem]"} placeholder="Brand / color" />
                              </>)}
                              <div className="relative w-20 shrink-0"><span className="absolute left-2 top-1.5 text-slate-400 text-sm">$</span><input type="number" value={p.priceSqft} onChange={(e) => updProduct(a.id, p.id, { priceSqft: e.target.value })} className={inp + " pl-5"} placeholder="/sqft" title="Price per sq ft" /></div>
                            </div>

                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {TYPES.map((t) => (
                                <button key={t} onClick={() => updProduct(a.id, p.id, { type: t })} className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs ${p.type === t ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}><span className={`w-3 h-3 rounded-sm flex items-center justify-center ${p.type === t ? "bg-indigo-600" : "border border-slate-300"}`}>{p.type === t && <Check size={9} className="text-white" />}</span>{TLBL[t]}</button>
                              ))}
                              <span className="flex-1" />
                              {a.products.length > 1 && <button onClick={() => delProduct(a.id, p.id)} className="text-slate-300 hover:text-red-500"><X size={14} /></button>}
                            </div>

                            {p.type === "tile" ? (
                              <div className="border-t border-slate-200 pt-2 mt-2 grid grid-cols-1 md:grid-cols-[0.8fr_1.7fr_1.1fr] gap-2 items-start">
                                {/* Quantity */}
                                <div className="rounded-md border border-slate-100 bg-white px-2.5 py-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium flex-1">Sq Ft</span>
                                    {p.qtyType === "sqft" && num(p.priceSqft) > 0 && <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">{money(line)}</span>}
                                  </div>
                                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                    <input type="number" value={p.qty} onChange={(e) => updProduct(a.id, p.id, { qty: e.target.value })} className={inp + " !w-14"} placeholder="0" />
                                    <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs shrink-0">{["sqft", "count"].map((t) => <button key={t} onClick={() => updProduct(a.id, p.id, { qtyType: t })} className={`px-2.5 py-1.5 ${p.qtyType === t ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{t === "sqft" ? "SF" : "EA"}</button>)}</div>
                                    {p.qtyType === "sqft" && num(p.priceSqft) === 0 && <span className="text-xs text-slate-500 whitespace-nowrap">{sf} sf</span>}
                                  </div>
                                </div>
                                {/* Grout */}
                                <div className={`rounded-md border px-2.5 py-1.5 ${p.grout.checked ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100 bg-white"}`}>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => updProduct(a.id, p.id, { grout: { ...p.grout, checked: !p.grout.checked } })} className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${p.grout.checked ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{p.grout.checked && <Check size={12} />}</button>
                                    <span className="text-sm font-medium flex-1">Grout</span>
                                    {p.grout.checked && <span className="flex items-center gap-1 text-sm text-indigo-700 shrink-0">{gEx != null && <span className="text-slate-400 text-xs whitespace-nowrap">{gEx.toFixed(2)} →</span>}<input type="number" value={G ? String(G.order) : ""} onChange={(e) => updProduct(a.id, p.id, { grout: { ...p.grout, manual: e.target.value } })} placeholder="—" title="Total — type to override the calculated amount" className="!w-12 text-right font-semibold rounded border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 ft-field" /><span className="font-semibold">{G ? G.unit : settings.grouts[p.grout.product]?.unit}</span></span>}
                                  </div>
                                  {p.grout.checked && (
                                    <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                                      <select value={p.grout.product} onChange={(e) => updProduct(a.id, p.id, { grout: { ...p.grout, product: e.target.value } })} className={inp + " flex-[2] min-w-[7rem]"}>{groutOpts.map((g) => <option key={g} value={g}>{g}</option>)}</select>
                                      <select value={p.grout.color} onChange={(e) => updProduct(a.id, p.id, { grout: { ...p.grout, color: e.target.value } })} className={inp + " flex-1 min-w-[6rem]"}><option value="">Color…</option>{colorOpts.map((c) => <option key={c}>{c}</option>)}</select>
                                      <div className="flex rounded-md border border-slate-200 overflow-hidden text-[11px] shrink-0">{JOINTS.map((j) => <button key={j.v} onClick={() => updProduct(a.id, p.id, { grout: { ...p.grout, joint: j.v } })} className={`px-1 py-1.5 ${num(p.grout.joint) === j.v ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{j.label}</button>)}</div>
                                      {!G && <div className="w-full text-xs text-amber-500">Enter Sq Ft + tile L/W/thickness to calculate, or type a total above.</div>}
                                    </div>
                                  )}
                                </div>
                                {/* Mortar */}
                                <div className={`rounded-md border px-2.5 py-1.5 ${p.mortar.checked ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100 bg-white"}`}>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => updProduct(a.id, p.id, { mortar: { ...p.mortar, checked: !p.mortar.checked } })} className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${p.mortar.checked ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{p.mortar.checked && <Check size={12} />}</button>
                                    <span className="text-sm font-medium flex-1">Mortar</span>
                                    {p.mortar.checked && <span className="flex items-center gap-1 text-sm text-indigo-700 shrink-0">{mEx != null && <span className="text-slate-400 text-xs whitespace-nowrap">{mEx.toFixed(2)} →</span>}<input type="number" value={M ? String(M.order) : ""} onChange={(e) => updProduct(a.id, p.id, { mortar: { ...p.mortar, manual: e.target.value } })} placeholder="—" title="Total — type to override the calculated amount" className="!w-12 text-right font-semibold rounded border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 ft-field" /><span className="font-semibold">{M ? M.unit : settings.mortars[p.mortar.product]?.unit}</span></span>}
                                  </div>
                                  {p.mortar.checked && (
                                    <div className="mt-1.5">
                                      <select value={p.mortar.product} onChange={(e) => updProduct(a.id, p.id, { mortar: { ...p.mortar, product: e.target.value } })} className={inp}>{mortarOpts.map((g) => <option key={g} value={g}>{g}</option>)}</select>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 mt-1.5">
                                <input type="number" value={p.qty} onChange={(e) => updProduct(a.id, p.id, { qty: e.target.value })} className={inp + " !w-16 shrink-0"} placeholder="0" />
                                <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs shrink-0">{["sqft", "count"].map((t) => <button key={t} onClick={() => updProduct(a.id, p.id, { qtyType: t })} className={`px-2.5 py-1.5 ${p.qtyType === t ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{t === "sqft" ? "SF" : "EA"}</button>)}</div>
                                {p.qtyType === "sqft" && <span className="text-xs text-slate-500 whitespace-nowrap">{sf} sq ft{num(p.priceSqft) > 0 && <span className="text-slate-700 font-medium"> · {money(line)}</span>}</span>}
                              </div>
                            )}

                            <input value={p.note} onChange={(e) => updProduct(a.id, p.id, { note: e.target.value })} placeholder="note…" className="w-full mt-2 text-sm text-slate-500 bg-transparent focus:outline-none placeholder:text-slate-300" />
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={() => addProduct(a.id)} className="mt-2 flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"><Plus size={14} /> Add product</button>
                  </div>
                ))}
              </div>

              {(totalSqft > 0 || hasMat) && (
                <div className="mt-4 space-y-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-3 flex-wrap">
                    <div className="text-sm text-slate-500 pt-1">Total flooring: <span className="font-semibold text-slate-800">{totalSqft.toLocaleString()} sq ft</span></div>
                    <div className="text-sm text-right space-y-0.5">
                      <div className="text-slate-500">Flooring <span className="font-medium text-slate-700">{money(flooringPrice)}</span></div>
                      {groutCost > 0 && <div className="text-slate-500">Grout <span className="font-medium text-slate-700">{money(groutCost)}</span></div>}
                      {mortarCost > 0 && <div className="text-slate-500">Mortar <span className="font-medium text-slate-700">{money(mortarCost)}</span></div>}
                      <div className="text-slate-900 font-semibold border-t border-slate-200 pt-1 mt-1">Estimated material total {money(grandTotal)}</div>
                    </div>
                  </div>
                  {hasMat && (
                    <div className="bg-slate-900 text-white rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2 text-sm font-semibold"><Package size={16} /> Material Order Summary <span className="text-xs text-slate-400 font-normal">(combined)</span></div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {mList.map((m, i) => <div key={"m" + i} className="bg-white/5 rounded-lg p-2.5"><div className="text-xl font-semibold">{m.order} <span className="text-sm font-normal text-slate-300">{m.unit}</span></div><div className="text-xs text-slate-300">{m.product} · {m.exact.toFixed(2)} exact</div></div>)}
                        {gList.map((g, i) => <div key={"g" + i} className="bg-white/5 rounded-lg p-2.5"><div className="text-xl font-semibold">{g.order} <span className="text-sm font-normal text-slate-300">{g.unit}</span></div><div className="text-xs text-slate-300">{g.product}{g.color !== "—" ? ` · ${g.color}` : ""} · {g.exact.toFixed(2)} exact</div></div>)}
                      </div>
                      <div className="text-xs text-slate-400 mt-2">"Exact" is the un-rounded need (incl. {settings.wastePct}% waste). Verify before ordering.</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* PRINT VIEW */}
      <div className="hidden print:block text-black p-2">
        {sel && sel._full && (
          <div>
            <div className="flex justify-between items-end border-b-2 border-black pb-3 mb-4">
              <div><div className="text-2xl font-bold">{sel.name}</div><div className="text-sm">{sel.address}</div><div className="text-sm">{[sel.phone, sel.email].filter(Boolean).join(" · ")}</div></div>
              <div className="text-right text-sm"><div className="font-semibold">Flooring &amp; Tile Selections</div><div>{new Date().toLocaleDateString()}</div></div>
            </div>
            {sel.notes && <div className="text-sm mb-4 italic">{sel.notes}</div>}
            {sel.categories.map((a) => (
              <div key={a.id} className="mb-4 break-inside-avoid">
                <div className="font-bold text-lg border-b border-slate-400">{a.name}</div>
                {a.note && <div className="text-sm italic">{a.note}</div>}
                {a.products.map((p) => {
                  const size = p.type === "tile" ? `${p.L}" × ${p.W}"${p.thickness ? ` × ${THICK.find((t) => t.v === String(p.thickness))?.label || p.thickness + '"'}` : ""}` : p.sizeText;
                  const j = JOINTS.find((x) => x.v === num(p.grout.joint))?.label; const G = getGrout(p, settings), M = getMortar(p, settings);
                  const sf = p.qtyType === "sqft" ? num(p.qty) : 0; const line = sf * num(p.priceSqft);
                  return (
                    <div key={p.id} className="mt-2 text-sm">
                      <div><b>{TLBL[p.type]}</b>{size ? ` · ${size}` : ""}{p.brandColor ? ` · ${p.brandColor}` : ""}{p.qty ? ` · ${p.qty} ${p.qtyType === "sqft" ? "sq ft" : "units"}` : ""}{num(p.priceSqft) > 0 ? ` @ ${money(num(p.priceSqft))}/sf = ${money(line)}` : ""}</div>
                      {G && <div className="ml-3">Grout: {G.product}{G.color ? ` — ${G.color}` : ""}{j ? `, ${j} joint` : ""} → {G.order} {G.unit} ({G.exact.toFixed(2)}){G.price > 0 ? ` = ${money(G.order * G.price)}` : ""}</div>}
                      {M && <div className="ml-3">Mortar: {M.product} → {M.order} {M.unit} ({M.exact.toFixed(2)}){M.price > 0 ? ` = ${money(M.order * M.price)}` : ""}</div>}
                      {p.note && <div className="ml-3 italic">{p.note}</div>}
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="mt-6 border-t-2 border-black pt-3">
              {totalSqft > 0 && <div className="text-sm mb-1"><b>Total flooring:</b> {totalSqft.toLocaleString()} sq ft</div>}
              <table className="text-sm w-auto mb-2"><tbody>
                <tr><td className="pr-6">Flooring</td><td className="text-right font-semibold">{money(flooringPrice)}</td></tr>
                {groutCost > 0 && <tr><td className="pr-6">Grout</td><td className="text-right font-semibold">{money(groutCost)}</td></tr>}
                {mortarCost > 0 && <tr><td className="pr-6">Mortar</td><td className="text-right font-semibold">{money(mortarCost)}</td></tr>}
                <tr className="border-t border-black"><td className="pr-6 font-bold">Estimated material total</td><td className="text-right font-bold">{money(grandTotal)}</td></tr>
              </tbody></table>
              {hasMat && (<>
                <div className="font-bold mb-1">Materials to Order (combined)</div>
                <table className="text-sm w-auto"><tbody>
                  {mList.map((m, i) => <tr key={"m" + i}><td className="pr-6">{m.product}</td><td className="font-semibold">{m.order} {m.unit} <span className="text-slate-500">({m.exact.toFixed(2)})</span></td></tr>)}
                  {gList.map((g, i) => <tr key={"g" + i}><td className="pr-6">{g.product}{g.color !== "—" ? ` — ${g.color}` : ""}</td><td className="font-semibold">{g.order} {g.unit} <span className="text-slate-500">({g.exact.toFixed(2)})</span></td></tr>)}
                </tbody></table>
              </>)}
              <div className="text-xs mt-3 text-slate-600">Quantities and prices are estimates (incl. {settings.wastePct}% material waste). Confirm against product specs and final measurements before ordering.</div>
            </div>
          </div>
        )}
      </div>

      {/* Settings */}
      {showSettings && (
        <Modal onClose={() => setShowSettings(false)} title="Coverage, Pricing & Settings">
          <p className="text-sm text-slate-500 mb-4">Calibrate coverage to your real-world results and set unit prices. Grout scales automatically for tile size, joint, and thickness from a 12×12×3/8" / 1/8"-joint baseline.</p>
          <div className="mb-4"><label className={lbl}>Waste factor (%)</label><input type="number" value={settings.wastePct} onChange={(e) => setSettings({ wastePct: e.target.value })} className={inp + " w-28"} /></div>
          <div className="font-medium text-sm mb-1">Grout &amp; mortar catalog</div>
          <p className="text-xs text-slate-400 mb-2">Products grouped by company. Uncheck a company or product to hide it from the job dropdowns — it stays stored, and jobs that already use it are unaffected.</p>
          <CatalogSettings catalog={settings.catalog} onChange={(c) => setSettings({ catalog: c })} inp={inp} lbl={lbl} />
        </Modal>
      )}

      {showVersions && sel && (
        <Modal onClose={() => setShowVersions(false)} title="Saved Versions">
          {(!sel.versions || sel.versions.length === 0) ? <p className="text-sm text-slate-400">No versions yet. Use "Version" to snapshot the current selections.</p> : (
            <div className="space-y-2">{sel.versions.map((v) => (<div key={v.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><div className="flex-1"><div className="text-sm font-medium">{v.label}</div><div className="text-xs text-slate-400">{new Date(v.savedAt).toLocaleString()} · {v.snapshot.length} areas</div></div><button onClick={() => loadVersion(v)} className="text-sm rounded-lg bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700">Restore</button><button onClick={() => delVersion(v.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button></div>))}</div>
          )}
        </Modal>
      )}

      {confirm && (
        <Modal onClose={() => setConfirm(null)} title="Delete customer?">
          <p className="text-sm text-slate-500 mb-4">This permanently removes the customer and all their selections, versions, and attachments{confirm && !isOwner(data.customers.find((c) => c.id === confirm.id)) ? " — including for everyone it's shared with" : ""}. Consider a backup export first.</p>
          <div className="flex justify-end gap-2"><button onClick={() => setConfirm(null)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button><button onClick={() => delCustomer(confirm.id)} className="text-sm rounded-lg bg-red-600 text-white px-4 py-2 hover:bg-red-700">Delete</button></div>
        </Modal>
      )}

      {toast && <div className="print:hidden fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{toast}</div>}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="print:hidden fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-lg">{title}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

// The shared grout/mortar catalog editor: a Company → Product tree. Each company
// and product has an enabled checkbox (show/hide for the job dropdowns); a
// product's numbers are shown and editable only while it is enabled, but stay
// stored when off. All edits flow up through onChange(newCatalog).
function CatalogSettings({ catalog, onChange, inp, lbl }) {
  const [newCompany, setNewCompany] = useState("");
  const [adding, setAdding] = useState(null); // { companyId, kind }
  const [draft, setDraft] = useState({});
  const [error, setError] = useState("");
  // Which companies are expanded — view state only, never persisted. Collapsed
  // by default so the list stays tidy as products accumulate.
  const [expanded, setExpanded] = useState(() => new Set());
  const toggleExpanded = (id) => setExpanded((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const setCompany = (cid, patch) => onChange({ companies: catalog.companies.map((co) => co.id === cid ? { ...co, ...patch } : co) });
  const setProduct = (cid, kind, pid, patch) => onChange({ companies: catalog.companies.map((co) => co.id === cid ? { ...co, [kind]: co[kind].map((p) => p.id === pid ? { ...p, ...patch } : p) } : co) });

  const kindLabel = (kind) => kind === "grouts" ? "grout" : "mortar";
  const startAdd = (companyId, kind) => { setAdding({ companyId, kind }); setDraft(kind === "grouts" ? { name: "", coverage: "", unit: "units", price: "" } : { name: "", tier1: "", tier2: "", tier3: "", unit: "units", price: "" }); setError(""); };
  const cancelAdd = () => { setAdding(null); setError(""); };
  const submitAdd = () => {
    const name = (draft.name || "").trim();
    if (!name) { setError("Product name is required."); return; }
    if (isDuplicateName(catalog, adding.kind, name)) { setError(`A ${kindLabel(adding.kind)} named "${name}" already exists.`); return; }
    onChange(addProduct(catalog, adding.companyId, adding.kind, { ...draft, name }));
    setAdding(null); setError("");
  };
  const submitCompany = () => { const name = newCompany.trim(); if (!name) return; onChange(addCompany(catalog, name)); setNewCompany(""); };

  const box = (on, onClick, title) => (
    <button onClick={onClick} title={title} className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${on ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{on && <Check size={12} />}</button>
  );
  const numField = (label, value, onVal) => (
    <div><label className={lbl}>{label}</label><input type="number" value={value} onChange={(e) => onVal(e.target.value)} className={inp} /></div>
  );
  const txtField = (label, value, onVal) => (
    <div><label className={lbl}>{label}</label><input value={value} onChange={(e) => onVal(e.target.value)} className={inp} /></div>
  );
  return (
    <div className="space-y-2">
      {catalog.companies.map((co) => (
        <div key={co.id} className="border border-slate-200 rounded-lg p-2.5">
          <div className="flex items-center gap-2">
            <button onClick={() => toggleExpanded(co.id)} className="text-slate-400 hover:text-slate-600 shrink-0" title={expanded.has(co.id) ? "Collapse" : "Expand"}>{expanded.has(co.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
            {box(co.enabled, () => setCompany(co.id, { enabled: !co.enabled }), co.enabled ? "Hide all of this company's products" : "Show this company's products")}
            <button onClick={() => toggleExpanded(co.id)} className={`text-sm font-semibold flex-1 text-left ${co.enabled ? "" : "text-slate-400"}`}>{co.name}</button>
            <span className="text-xs text-slate-400 shrink-0">{co.grouts.length + co.mortars.length}</span>
          </div>
          {expanded.has(co.id) && (
          <div className="mt-1.5 space-y-1.5 pl-7">
            {co.grouts.length === 0 && co.mortars.length === 0 && <div className="text-xs text-slate-400">No products yet.</div>}
            {co.grouts.map((g) => (
              <div key={g.id} className={`rounded-md border px-2.5 py-1.5 ${g.enabled ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100 bg-white"}`}>
                <div className="flex items-center gap-2">
                  {box(g.enabled, () => setProduct(co.id, "grouts", g.id, { enabled: !g.enabled }))}
                  <span className={`text-sm font-medium flex-1 ${g.enabled ? "" : "text-slate-400"}`}>{g.name}</span>
                  <span className="text-xs text-slate-400">Grout</span>
                </div>
                {g.enabled && (
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {numField("Cov. sq ft/unit", g.coverage, (v) => setProduct(co.id, "grouts", g.id, { coverage: v }))}
                    {txtField("Unit", g.unit, (v) => setProduct(co.id, "grouts", g.id, { unit: v }))}
                    {numField("$/unit", g.price, (v) => setProduct(co.id, "grouts", g.id, { price: v }))}
                  </div>
                )}
              </div>
            ))}
            {co.mortars.map((m) => (
              <div key={m.id} className={`rounded-md border px-2.5 py-1.5 ${m.enabled ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100 bg-white"}`}>
                <div className="flex items-center gap-2">
                  {box(m.enabled, () => setProduct(co.id, "mortars", m.id, { enabled: !m.enabled }))}
                  <span className={`text-sm font-medium flex-1 ${m.enabled ? "" : "text-slate-400"}`}>{m.name}</span>
                  <span className="text-xs text-slate-400">Mortar</span>
                </div>
                {m.enabled && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-1.5">
                    {numField('Tile < 8"', m.tier1, (v) => setProduct(co.id, "mortars", m.id, { tier1: v }))}
                    {numField('8"–15"', m.tier2, (v) => setProduct(co.id, "mortars", m.id, { tier2: v }))}
                    {numField('> 15"', m.tier3, (v) => setProduct(co.id, "mortars", m.id, { tier3: v }))}
                    {txtField("Unit", m.unit, (v) => setProduct(co.id, "mortars", m.id, { unit: v }))}
                    {numField("$/unit", m.price, (v) => setProduct(co.id, "mortars", m.id, { price: v }))}
                  </div>
                )}
              </div>
            ))}
            {adding && adding.companyId === co.id ? (
              <div className="rounded-md border border-indigo-200 bg-white px-2.5 py-2">
                <div className="text-xs font-medium mb-1.5">New {kindLabel(adding.kind)} product</div>
                <input autoFocus placeholder="Product name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); if (e.key === "Escape") cancelAdd(); }} className={inp + " mb-1.5"} />
                {adding.kind === "grouts" ? (
                  <div className="grid grid-cols-3 gap-2">
                    {numField("Cov. sq ft/unit", draft.coverage, (v) => setDraft({ ...draft, coverage: v }))}
                    {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
                    {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {numField('Tile < 8"', draft.tier1, (v) => setDraft({ ...draft, tier1: v }))}
                    {numField('8"–15"', draft.tier2, (v) => setDraft({ ...draft, tier2: v }))}
                    {numField('> 15"', draft.tier3, (v) => setDraft({ ...draft, tier3: v }))}
                    {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
                    {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
                  </div>
                )}
                {error && <div className="text-xs text-red-500 mt-1.5">{error}</div>}
                <div className="flex gap-2 mt-2">
                  <button onClick={submitAdd} className="text-sm rounded-md bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700">Add</button>
                  <button onClick={cancelAdd} className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 pt-0.5">
                <button onClick={() => startAdd(co.id, "grouts")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Grout</button>
                <button onClick={() => startAdd(co.id, "mortars")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Mortar</button>
              </div>
            )}
          </div>
          )}
        </div>
      ))}
      <div className="flex gap-2 items-center pt-1">
        <input placeholder="New company name" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitCompany(); }} className={inp + " flex-1"} />
        <button onClick={submitCompany} className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50 flex items-center gap-1 shrink-0"><Plus size={14} /> Company</button>
      </div>
    </div>
  );
}
