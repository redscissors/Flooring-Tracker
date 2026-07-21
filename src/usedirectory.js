import { useState, useRef } from "react";
import { supabase } from "./lib/supabase.js";
import { SHARED_SETTINGS_ID } from "./bootload.js";
import { normalizeSettings, withDerived, serializeSettings } from "./catalog.js";
import { ATT_BUCKET } from "./uiconst.js";
import { uid, catSig, rowBlank, newProject, newPerson, newBuilder, normC, personData } from "./model.js";

export const attPath = (custId, fileId) => `${custId}/${fileId}`;
export const normProfile = (p) => ({ name: "", phone: "", email: "", ...(p || {}) });

// Version metadata as held in memory — snapshots stay on the server until a
// restore actually needs one.
export const vMeta = (r) => ({ id: r.id, label: r.label || "Version", auto: !!r.auto, savedAt: r.saved_at ? new Date(r.saved_at).getTime() : Date.now() });

export function useDirectory({ user, ping, flashSaved, setSidebarOpen, setFocusProd, setFocusName, setConfirm, setPromoteId, setPromoteQ }) {
  const [data, setData] = useState(() => ({ projects: [], people: [], builders: [], settings: normalizeSettings() }));
  const [loading, setLoading] = useState(true);
  // selId = the open Project (drives the estimate pane). selCustId = the open
  // Customer (person) when no project is selected (drives the customer view).
  const [selId, setSelId] = useState(null);
  const [selCustId, setSelCustId] = useState(null);
  // Per-user profile (name/phone/email), printed on the estimate header.
  const [profile, setProfile] = useState(normProfile());
  // The rest of this user's app_data blob, kept so profile saves don't clobber
  // anything else stored there.
  const appBlobRef = useRef({});
  // Auto-version bookkeeping: { id, json } — the open customer's categories as
  // of open / last snapshot. dataRef mirrors state so the deselect effect and
  // sign-out handler compare against the latest edits, not a stale closure.
  const baselineRef = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const prevSelRef = useRef(null);

  // Lazy-load one customer's full record on open, merging it into the light row.
  // Version metadata (never snapshots) loads alongside; snapshots are fetched
  // one at a time on restore.
  const loadDetail = async (id) => {
    const existing = data.projects.find((c) => c.id === id);
    if (!existing || existing._full) return;
    try {
      const [{ data: row, error }, { data: vRows, error: vErr }] = await Promise.all([
        supabase.from("projects").select("data").eq("id", id).maybeSingle(),
        supabase.from("versions").select("id, label, auto, saved_at").eq("customer_id", id).order("saved_at", { ascending: false }),
      ]);
      if (error) throw error;
      if (vErr) throw vErr;
      const full = normC(row?.data || {});
      let versions = (vRows || []).map(vMeta);
      // Safety net for a client deployed before the schema migration ran: lift
      // any versions still embedded in this blob into the table (idempotent);
      // custData strips them from the blob on the next content write.
      if (full.versions.length) {
        try {
          await supabase.from("versions").upsert(full.versions.map((v) => ({
            id: v.id || uid(), customer_id: id, label: v.label || "Version", auto: false,
            saved_at: new Date(v.savedAt || Date.now()).toISOString(), snapshot: v.snapshot || [],
          })), { onConflict: "id", ignoreDuplicates: true });
          const have = new Set(versions.map((v) => v.id));
          versions = [...versions, ...full.versions.filter((v) => !have.has(v.id)).map((v) => vMeta({ id: v.id, label: v.label, auto: false, saved_at: v.savedAt ? new Date(v.savedAt).toISOString() : null }))].sort((a, b) => b.savedAt - a.savedAt);
        } catch (x) { /* best-effort */ }
      }
      setData((prev) => ({
        ...prev,
        projects: prev.projects.map((c) => c.id === id
          ? { ...c, ...full, customerId: c.customerId, versions, id: c.id, createdAt: c.createdAt, _full: true }
          : c),
      }));
      baselineRef.current = { id, json: catSig(full.categories) };
    } catch (e) { ping("Could not open customer — check connection"); }
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
      const { ownerId, visibility, archived, customerId, ...rest } = c;
      // Late legacy-blob migration lands as an unassigned project (customer_id
      // null); the owner links it to a customer from the sidebar.
      await supabase.from("projects").upsert(
        { id: c.id, owner_id: user.id, data: rest, created_at: new Date(c.createdAt || Date.now()).toISOString() },
        { onConflict: "id", ignoreDuplicates: true }
      );
    }
    // Drop the migrated array from the blob, keeping what still lives there
    // (the user's profile).
    await supabase.from("app_data").upsert({ user_id: user.id, data: appBlobRef.current }, { onConflict: "user_id" });
  };

  // Strip the in-memory-only fields before writing to jsonb (versions live in
  // their own table; _full is load state; updatedAt mirrors the updated_at
  // column; ownerId/visibility/archived are legacy fields old records may carry).
  // customerId is the projects.customer_id column, not part of the data blob.
  const custData = ({ ownerId, visibility, archived, versions, _full, updatedAt, customerId, ...rest }) => rest;

  // Settings live in one shared record (ADR 0002) — last-write-wins across the
  // whole team, the same as a Public customer's data.
  const setSettings = (patch) => {
    const next = { ...data, settings: withDerived({ ...data.settings, ...patch }) };
    setData(next);
    (async () => { try { const { error } = await supabase.from("shared_settings").upsert({ id: SHARED_SETTINGS_ID, data: serializeSettings(next.settings) }, { onConflict: "id" }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
  };
  const saveProfile = (patch) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    appBlobRef.current = { ...appBlobRef.current, profile: next };
    (async () => { try { const { error } = await supabase.from("app_data").upsert({ user_id: user.id, data: appBlobRef.current }, { onConflict: "user_id" }); if (error) throw error; flashSaved(); } catch (e) { ping("Couldn't save your info"); } })();
  };
  const sel = data.projects.find((c) => c.id === selId) || null;
  const selCust = data.people.find((c) => c.id === selCustId) || null;
  const builderNameOf = (id) => data.builders.find((b) => b.id === id)?.name || "";
  const projectsOf = (customerId) => data.projects.filter((p) => p.customerId === customerId);

  // Every project-content mutation goes through here: optimistic state update +
  // an UPDATE of that one row's data blob. customer_id is a column, moved via
  // linkProject — never through here.
  const updateProject = (id, patch) => {
    const next = { ...data, projects: data.projects.map((c) => c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c) };
    setData(next);
    const cust = next.projects.find((c) => c.id === id);
    (async () => { try { const { error } = await supabase.from("projects").update({ data: custData(cust) }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
  };

  const addProject = (customerId = null, name = "New Project", opts = {}) => {
    const c = { ...newProject(customerId, name, { ...opts, waste: data.settings.waste }), salesperson: { name: profile.name || "", phone: profile.phone || "", email: profile.email || "" }, updatedAt: Date.now(), _full: true };
    setData((prev) => ({ ...prev, projects: [c, ...prev.projects] }));
    baselineRef.current = { id: c.id, json: catSig(c.categories) };
    setSelId(c.id); setSelCustId(customerId); setSidebarOpen(false);
    // Quick prices land straight in product search (the seeded area's blank
    // adder row); named projects focus the name field as before.
    if (opts.quick) setFocusProd(c.categories[0]?.products[0]?.id); else setFocusName(true);
    (async () => { try { const { error } = await supabase.from("projects").insert({ id: c.id, owner_id: user.id, customer_id: customerId, data: custData(c), created_at: new Date(c.createdAt).toISOString() }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
    return c;
  };
  const startQuickPrice = () => addProject(null, "Quick price", { quick: true, seedArea: true });
  const pickProject = (id) => { const p = data.projects.find((c) => c.id === id); setSelId(id); if (p) setSelCustId(p.customerId || null); setSidebarOpen(false); loadDetail(id); };
  // Return to the landing screen from anywhere (the ned logo / mobile mark).
  // The open project is a real, autosaved row, so leaving never loses it — it
  // just deselects. The one exception: an untouched quick-price draft (all
  // rows still blank) is worthless, so discard it rather than let it linger the
  // 30 days until the sweep. Only ever deletes a `quick` + fully-blank draft.
  const goHome = () => {
    const cur = sel;
    setSelId(null); setSelCustId(null);
    if (cur && cur._full && cur.quick && cur.categories.every((a) => (a.products || []).every(rowBlank))) delProject(cur.id);
  };
  const delProject = async (id) => {
    const cust = data.projects.find((c) => c.id === id);
    if (cust) { for (const m of (cust.attachments || [])) { try { await supabase.storage.from(ATT_BUCKET).remove([attPath(id, m.id)]); } catch (x) { } } }
    setData((prev) => ({ ...prev, projects: prev.projects.filter((c) => c.id !== id) }));
    if (selId === id) setSelId(null);
    setConfirm(null);
    try { const { error } = await supabase.from("projects").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); }
  };
  // Move a project to a different customer (or unassign with null).
  // Dormant sanctioned write path (CLAUDE.md conventions); moves into useDirectory in phase 2.
  // eslint-disable-next-line no-unused-vars
  const linkProject = (id, customerId) => {
    setData((prev) => ({ ...prev, projects: prev.projects.map((c) => c.id === id ? { ...c, customerId: customerId || null, updatedAt: Date.now() } : c) }));
    (async () => { try { const { error } = await supabase.from("projects").update({ customer_id: customerId || null }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };
  // Promote a quick-price draft (or any unassigned job) into a normal job under
  // a customer (ADR 0022): set the customer_id column AND clear the quick flag
  // in the data blob in one write, so the pair never races (linkProject and
  // updateProject each own only their own field). custData needs the FULL
  // record — guard on _full so a light row is never serialized (that would wipe
  // its categories); promotion is only ever offered on the open project, which
  // is always full.
  const promoteProject = (id, customerId) => {
    const cur = data.projects.find((c) => c.id === id);
    if (!cur || !customerId) return;
    setData((prev) => ({ ...prev, projects: prev.projects.map((c) => c.id === id ? { ...c, customerId, quick: false, updatedAt: Date.now() } : c) }));
    (async () => {
      try {
        const upd = cur._full ? { customer_id: customerId, data: custData({ ...cur, customerId, quick: false }) } : { customer_id: customerId };
        const { error } = await supabase.from("projects").update(upd).eq("id", id);
        if (error) throw error; flashSaved();
      } catch (e) { ping("Save failed — check connection"); }
    })();
    setSelCustId(customerId);
    setPromoteId(null); setPromoteQ("");
  };
  // Create a customer and file the draft under it. The customer INSERT is
  // awaited before promoteProject's customer_id UPDATE so the FK
  // (projects.customer_id -> customers.id) is always satisfied — same ordering
  // as addBuilderFor. Optimistic add up front so the name shows instantly.
  const promoteToNewCustomer = async (id, name) => {
    const c = { ...newPerson(String(name || "").trim()), updatedAt: Date.now() };
    if (!c.name) return;
    setData((prev) => ({ ...prev, people: [c, ...prev.people] }));
    try {
      const { error } = await supabase.from("customers").insert({ id: c.id, owner_id: user.id, builder_id: null, data: personData(c), created_at: new Date(c.createdAt).toISOString() });
      if (error) throw error;
    } catch (x) { ping("Save failed — export a backup"); return; }
    promoteProject(id, c.id);
  };

  // --- Customers (people): the person/account that owns projects (ADR 0005). ---
  const addPerson = (name = "") => {
    const c = { ...newPerson(name), updatedAt: Date.now() };
    setData((prev) => ({ ...prev, people: [c, ...prev.people] }));
    setSidebarOpen(false);
    (async () => { try { const { error } = await supabase.from("customers").insert({ id: c.id, owner_id: user.id, builder_id: null, data: personData(c), created_at: new Date(c.createdAt).toISOString() }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — run supabase/migrate-hierarchy.sql?"); } })();
    return c;
  };
  const updatePerson = (id, patch) => {
    // Functional update: setting a builder right after adding one (BuilderCombo)
    // must not clobber the freshly-added builder from a stale closure.
    setData((prev) => ({ ...prev, people: prev.people.map((c) => c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c) }));
    const merged = { ...(data.people.find((x) => x.id === id) || {}), ...patch };
    const upd = {};
    if ("builderId" in patch) upd.builder_id = patch.builderId || null;
    if (Object.keys(patch).some((k) => k !== "builderId")) upd.data = personData(merged);
    (async () => { try { const { error } = await supabase.from("customers").update(upd).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
  };
  const delPerson = async (id) => {
    // Projects survive — the FK nulls their customer_id (on delete set null), so
    // they resurface under "Unassigned" rather than being deleted.
    setData((prev) => ({ ...prev, people: prev.people.filter((c) => c.id !== id), projects: prev.projects.map((p) => p.customerId === id ? { ...p, customerId: null } : p) }));
    if (selCustId === id) setSelCustId(null);
    setConfirm(null);
    try { const { error } = await supabase.from("customers").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); }
  };

  // --- Builders: a canonical name list customers link to by id. ---
  // Create a new builder and assign it to a customer in one flow. The builder
  // INSERT is awaited before the customer's builder_id UPDATE so the FK
  // (customers.builder_id -> builders.id) is always satisfied.
  const addBuilderFor = async (personId, name) => {
    const b = newBuilder(String(name || "").trim());
    setData((prev) => ({ ...prev, builders: [...prev.builders, b], people: prev.people.map((c) => c.id === personId ? { ...c, builderId: b.id, updatedAt: Date.now() } : c) }));
    try {
      const { error: be } = await supabase.from("builders").insert({ id: b.id, owner_id: user.id, name: b.name });
      if (be) throw be;
      const { error: ce } = await supabase.from("customers").update({ builder_id: b.id }).eq("id", personId);
      if (ce) throw ce;
      flashSaved();
    } catch (e) { ping("Save failed — run supabase/migrate-hierarchy.sql?"); }
    return b;
  };

  return {
    data, setData, loading, setLoading, hydrateDirectory: setData,
    selId, setSelId, selCustId, setSelCustId, sel, selCust,
    loadDetail,
    updateProject, addProject, startQuickPrice, pickProject, goHome, delProject,
    linkProject, promoteProject, promoteToNewCustomer,
    addPerson, updatePerson, delPerson, addBuilderFor,
    builderNameOf, projectsOf, migrateLegacyCustomers,
    setSettings, saveProfile, profile, setProfile, appBlobRef,
    dataRef, baselineRef, prevSelRef, custData,
  };
}
