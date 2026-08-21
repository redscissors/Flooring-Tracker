import { uid, OPTION_SLOTS, newArea, newProduct } from "./model.js";

// Quote options (ADR 0031): an area's `option` is "" (shared — part of the job
// in every option) or a fixed slot letter (A–F since 2026-08-19 — three wasn't
// enough). Slots are positional identities, not records; custom display names
// live in project.optionNames. The letters themselves live in model.js (normA/
// normC gate on them); this file re-exports the list as the UI's import point.
export { OPTION_SLOTS };
// Deliberately outside the moss palette, like the tier colors: options must be
// tellable apart at a glance. `soft` is the wash for bands/cards.
export const OPTION_COLOR = {
  A: { main: "#3E5F8A", deep: "#2E4869", soft: "color-mix(in srgb, #3E5F8A 8%, transparent)" },
  B: { main: "#9A5B33", deep: "#6E401F", soft: "color-mix(in srgb, #9A5B33 8%, transparent)" },
  C: { main: "#6E4E7E", deep: "#503659", soft: "color-mix(in srgb, #6E4E7E 8%, transparent)" },
  D: { main: "#2F7E7A", deep: "#215B58", soft: "color-mix(in srgb, #2F7E7A 8%, transparent)" },
  E: { main: "#9C4A5E", deep: "#723344", soft: "color-mix(in srgb, #9C4A5E 8%, transparent)" },
  F: { main: "#8A6D2F", deep: "#634E20", soft: "color-mix(in srgb, #8A6D2F 8%, transparent)" },
};

export const optionsUsed = (cats) => OPTION_SLOTS.filter((s) => (cats || []).some((a) => a.option === s));
export const hasOptions = (cats) => optionsUsed(cats).length > 0;

export const bucketCats = (cats, scope) => (cats || []).filter((a) => (scope === "shared" ? !a.option : a.option === scope));
export const scopedCats = (cats, scope) => {
  if (scope === "all") return cats || [];
  return (cats || []).filter((a) => !a.option || a.option === scope);
};

export const normOptionNames = (v) => {
  const out = {};
  if (v && typeof v === "object") for (const s of OPTION_SLOTS) { const n = typeof v[s] === "string" ? v[s].trim() : ""; if (n) out[s] = n; }
  return out;
};
export const optionTitle = (proj, slot) => proj?.optionNames?.[slot] || `Option ${slot}`;
export const optionShort = (proj, slot) => (proj?.optionNames?.[slot] ? `${slot} · ${proj.optionNames[slot]}` : `Option ${slot}`);

export const duplicateInto = (area, slot) => ({ ...area, id: uid(), option: slot, products: (area.products || []).map((p) => ({ ...p, id: uid() })) });

// The Compare tab (phase 5) prices one shower in both wedi and Schluter, then
// lands each build as its own quote option. Both areas MUST land through a
// single updateProject call — the directory's setter closes over stale state,
// so two calls in one tick clobber each other — so this builds one patch, not
// two writes. These are fresh sibling areas (not a copy of shared work), so
// duplicateInto's shared-source retag rule doesn't apply here (recorded in the
// ADR — task 7).
export const compareOptionsPatch = (project, hostAreaId, { wediLines, schluterLines, label } = {}) => {
  if (!(wediLines || []).length || !(schluterLines || []).length) return null;
  const cats = project.categories || [];
  const hostIdx = cats.findIndex((a) => a.id === hostAreaId);
  const host = hostIdx >= 0 ? cats[hostIdx] : null;
  const base = (label && label.trim()) || (host?.name && host.name.trim()) || "Shower";
  const areaFor = (name, slot, lines) => ({
    ...newArea(), name, option: slot,
    products: [...lines.map((p) => ({ ...newProduct(), ...p })), newProduct()],
  });
  const wediArea = areaFor(`${base} — wedi`, "A", wediLines);
  const schluterArea = areaFor(`${base} — Schluter`, "B", schluterLines);
  const insertAt = hostIdx >= 0 ? hostIdx + 1 : cats.length;
  const categories = [...cats.slice(0, insertAt), wediArea, schluterArea, ...cats.slice(insertAt)];
  const optionNames = { A: "wedi", B: "Schluter", ...normOptionNames(project.optionNames) };
  return { categories, optionNames };
};
