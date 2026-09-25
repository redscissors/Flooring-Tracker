import { useState } from "react";
import { supabase } from "./lib/supabase.js";
import { loadLabels } from "./bootload.js";
import { normLabel } from "./labels.js";
import { uid } from "./model.js";

export function useLabels({ user, profile, ping, flashSaved, settings, setSettings }) {
  // Apps → Label Generator: saved showroom labels, shared team-wide (issue
  // label-generator-integration). Own table, loaded when the Label Generator opens
  // (ADR 0026) — nothing at boot reads it.
  const [labels, setLabels] = useState([]);

  // Labels write path (Apps → Label Generator). Mirrors the todos helpers; the
  // paged loader lives in bootload.js.
  const labelData = (l) => ({ presetId: l.presetId, w: l.w, h: l.h, header: l.header, lines: l.lines, fields: l.fields, twoVariant: l.twoVariant, fields2: l.fields2, sku: l.sku, createdBy: l.createdBy, createdAt: l.createdAt });
  // The refresh merges instead of replacing: an optimistic add made before the
  // fetch resolves (its select predates the insert) must not vanish from view.
  const refreshLabels = () => {
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
  // One optimistic update and one upsert for a batch (stock-book refresh,
  // template restyle) — never a write per label.
  const updateLabelsBulk = (patches) => {
    if (!patches.length) return;
    const byId = new Map(patches.map((p) => [p.id, p.patch]));
    const next = labels.map((l) => (byId.has(l.id) ? normLabel({ ...l, ...byId.get(l.id) }) : l));
    setLabels(next);
    const rows = next.filter((l) => byId.has(l.id)).map((l) => ({ id: l.id, position: l.position, data: labelData(l) }));
    (async () => { try { const { error } = await supabase.from("labels").upsert(rows); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };
  const delLabels = (ids) => {
    if (!ids.length) return;
    const gone = new Set(ids);
    setLabels((prev) => prev.filter((l) => !gone.has(l.id)));
    (async () => { try { const { error } = await supabase.from("labels").delete().in("id", ids); if (error) throw error; } catch (e) { ping("Delete failed"); } })();
  };
  const delLabel = (id) => {
    setLabels((prev) => prev.filter((l) => l.id !== id));
    (async () => { try { const { error } = await supabase.from("labels").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); } })();
  };
  // Presets live in shared settings; setSettings persists them (serializeApps
  // keeps customs plus any built-in the team has edited). Replaced in place so
  // an edited built-in keeps its spot in the list.
  const saveLabelPreset = (preset) => {
    const cur = settings.apps?.labels?.presets || [];
    const presets = cur.some((p) => p.id === preset.id) ? cur.map((p) => (p.id === preset.id ? preset : p)) : [...cur, preset];
    setSettings({ ...settings, apps: { ...settings.apps, labels: { presets } } });
  };

  return {
    labels, hydrateLabels: setLabels,
    refreshLabels, addLabel, addLabelsBulk, updateLabel, updateLabelsBulk, delLabel, delLabels, saveLabelPreset,
  };
}
