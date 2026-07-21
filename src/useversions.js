import { useState } from "react";
import { supabase } from "./lib/supabase.js";
import { AUTO_KEEP } from "./uiconst.js";
import { uid, catSig, normA } from "./model.js";

export function useVersions({ user, ping, flashSaved, sel, setData, dataRef, baselineRef, updateProject, selId }) {
  const [showVersions, setShowVersions] = useState(false);
  const [namingVersion, setNamingVersion] = useState(false);
  const [versionName, setVersionName] = useState("");

  // Versions are their own rows (issue 003) — saving/deleting one never touches
  // the customer's data blob. In memory a customer carries version metadata
  // only; the snapshot is fetched when a restore needs it.
  const insertVersion = async (custId, label, auto, categories) => {
    const v = { id: uid(), label, auto, savedAt: Date.now() };
    const { error } = await supabase.from("versions").insert({ id: v.id, customer_id: custId, label, auto, saved_at: new Date(v.savedAt).toISOString(), snapshot: categories });
    if (error) throw error;
    return v;
  };
  const namedCount = (c) => (c.versions || []).filter((v) => !v.auto).length;
  const startVersionName = () => { setVersionName(`Version ${namedCount(sel) + 1}`); setNamingVersion(true); };
  const confirmVersion = async () => {
    const label = versionName.trim() || `Version ${namedCount(sel) + 1}`;
    const cust = sel;
    setNamingVersion(false); setVersionName("");
    try {
      const v = await insertVersion(cust.id, label, false, cust.categories);
      setData((prev) => ({ ...prev, projects: prev.projects.map((c) => c.id === cust.id ? { ...c, versions: [v, ...(c.versions || [])] } : c) }));
      baselineRef.current = { id: cust.id, json: catSig(cust.categories) };
      flashSaved(); ping("Version saved");
    } catch (e) { ping("Save failed — check connection"); }
  };
  const loadVersion = async (v) => {
    try {
      const { data: row, error } = await supabase.from("versions").select("snapshot").eq("id", v.id).maybeSingle();
      if (error || !row) throw error || new Error("missing");
      updateProject(sel.id, { categories: (Array.isArray(row.snapshot) ? row.snapshot : []).map(normA) });
      setShowVersions(false); ping("Version loaded");
    } catch (e) { ping("Could not load version — check connection"); }
  };
  const delVersion = async (vid) => {
    setData((prev) => ({ ...prev, projects: prev.projects.map((c) => c.id === sel.id ? { ...c, versions: (c.versions || []).filter((v) => v.id !== vid) } : c) }));
    try { const { error } = await supabase.from("versions").delete().eq("id", vid); if (error) throw error; } catch (e) { ping("Delete failed"); }
  };

  // The safety net: when a work session on a customer ends (they get deselected,
  // or the user signs out) and the selections changed since open / last
  // snapshot, save an automatic version. Autos beyond the newest AUTO_KEEP are
  // pruned; named versions are never touched. Baseline advances only on a
  // successful save so a failed attempt is retried at the next deselect.
  const autoSnapshot = async (id) => {
    const c = dataRef.current.projects.find((x) => x.id === id);
    const base = baselineRef.current;
    if (!c || !c._full || !base || base.id !== id) return;
    // Quick-price drafts are throwaway until promoted — don't spawn version rows.
    if (c.quick) return;
    const json = catSig(c.categories);
    if (json === base.json) return;
    const label = "Auto — " + new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    try {
      const v = await insertVersion(id, label, true, c.categories);
      baselineRef.current = { id, json };
      const drop = [v, ...(c.versions || []).filter((x) => x.auto)].sort((a, b) => b.savedAt - a.savedAt).slice(AUTO_KEEP).map((x) => x.id);
      setData((prev) => ({ ...prev, projects: prev.projects.map((x) => x.id === id ? { ...x, versions: [v, ...(x.versions || [])].filter((vv) => !drop.includes(vv.id)) } : x) }));
      if (drop.length) await supabase.from("versions").delete().in("id", drop);
    } catch (e) { /* best-effort — the live data is already saved */ }
  };

  return {
    showVersions, setShowVersions, namingVersion, setNamingVersion, versionName, setVersionName,
    startVersionName, confirmVersion, insertVersion, loadVersion, delVersion, autoSnapshot,
  };
}
