import { useState } from "react";
import { supabase } from "./lib/supabase.js";
import { loadLabels } from "./bootload.js";
import { normLabel } from "./labels.js";
import { uid } from "./model.js";

export function useLabels({ user, profile, ping, flashSaved, setSidebarOpen, settings, setSettings }) {
  // Apps → Label Generator: saved showroom labels, shared team-wide (issue
  // label-generator-integration). Own table, loaded when the Apps hub opens
  // (ADR 0026) — nothing at boot reads it.
  const [labels, setLabels] = useState([]);
  const [showApps, setShowApps] = useState(false);

  // Labels write path (Apps → Label Generator). Mirrors the todos helpers; the
  // paged loader lives in bootload.js.
  const labelData = (l) => ({ presetId: l.presetId, w: l.w, h: l.h, header: l.header, lines: l.lines, fields: l.fields, twoVariant: l.twoVariant, fields2: l.fields2, sku: l.sku, createdBy: l.createdBy, createdAt: l.createdAt });
  // The refresh merges instead of replacing: an optimistic add made before the
  // fetch resolves (its select predates the insert) must not vanish from view.
  const openApps = () => {
    setShowApps(true); setSidebarOpen(false);
    loadLabels(supabase).then((rows) => setLabels((prev) => {
      const have = new Set(rows.map((l) => l.id));
      return [...rows, ...prev.filter((l) => !have.has(l.id))];
    })).catch(() => { });
  };
  const nextPos = () => (labels.length ? Math.max(...labels.map((l) => l.position)) + 1 : 0);
  const addLabel = (draft) => {
    const l = normLabel({ ...draft, id: uid(), position: nextPos(), createdBy: profile.name || user.email || "", createdAt: Date.now() });
    setLabels((prev) => [...prev, l]);
    (async () => { try { const { error } = await supabase.from("labels").insert({ id: l.id, position: l.position, data: labelData(l) }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — run supabase/labels.sql?"); } })();
    return l;
  };
  const addLabelsBulk = (drafts) => {
    let pos = nextPos();
    const made = drafts.map((d) => normLabel({ ...d, id: uid(), position: pos++, createdBy: profile.name || user.email || "", createdAt: Date.now() }));
    setLabels((prev) => [...prev, ...made]);
    (async () => { try { const { error } = await supabase.from("labels").insert(made.map((l) => ({ id: l.id, position: l.position, data: labelData(l) }))); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — run supabase/labels.sql?"); } })();
  };
  const updateLabel = (id, patch) => {
    const next = labels.map((l) => l.id === id ? normLabel({ ...l, ...patch }) : l);
    setLabels(next);
    const l = next.find((x) => x.id === id);
    (async () => { try { const { error } = await supabase.from("labels").update({ position: l.position, data: labelData(l) }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };
  const delLabel = (id) => {
    setLabels((prev) => prev.filter((l) => l.id !== id));
    (async () => { try { const { error } = await supabase.from("labels").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); } })();
  };
  // Custom size presets live in shared settings; setSettings persists them
  // (serializeSettings keeps only non-built-in presets).
  const saveLabelPreset = (preset) => {
    const cur = settings.apps?.labels?.presets || [];
    const presets = [...cur.filter((p) => p.id !== preset.id), preset];
    setSettings({ ...settings, apps: { ...settings.apps, labels: { presets } } });
  };

  return {
    labels, hydrateLabels: setLabels,
    showApps, setShowApps,
    openApps, addLabel, addLabelsBulk, updateLabel, delLabel, saveLabelPreset,
  };
}
