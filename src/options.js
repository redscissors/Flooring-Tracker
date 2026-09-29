import { uid, OPTION_SLOTS, newArea, newProduct, stampKit } from "./model.js";

// Quote options (ADR 0031): an area's `option` is "" (shared — part of the job
// in every option) or a fixed slot letter (A–L since 2026-08-26 — six wasn't
// enough either). Slots are positional identities, not records; custom display
// names live in project.optionNames. The letters themselves live in model.js
// (normA/normC gate on them); this file re-exports the list as the UI's import
// point.
export { OPTION_SLOTS };
// One color per slot (owner 2026-09-27, reversing the 2026-08-26 single
// tint): A–F are the most tellable-apart, and none is green (the app accent),
// amber (warnings) or red (delete). The letter stays the identity; the color
// helps. Every `main` carries white text (print bands, letter squares).
const SLOT_COLORS = {
  A: { main: "#3E5F8A", deep: "#2E4768" },
  B: { main: "#9A3F5E", deep: "#742F46" },
  C: { main: "#2C7A7B", deep: "#215C5C" },
  D: { main: "#6B4FA0", deep: "#503B78" },
  E: { main: "#8C6D1F", deep: "#695217" },
  F: { main: "#A0469A", deep: "#783474" },
  G: { main: "#2F7FA8", deep: "#235F7E" },
  H: { main: "#8E4A3A", deep: "#6A382C" },
  I: { main: "#5E6670", deep: "#464C54" },
  J: { main: "#86607A", deep: "#64485C" },
  K: { main: "#2B3F6B", deep: "#202F50" },
  L: { main: "#7A6448", deep: "#5C4B36" },
};
export const OPTION_COLOR = Object.fromEntries(OPTION_SLOTS.map((s) => [s, { ...SLOT_COLORS[s], soft: `color-mix(in srgb, ${SLOT_COLORS[s].main} 8%, transparent)` }]));

export const optionsUsed = (cats) => OPTION_SLOTS.filter((s) => (cats || []).some((a) => a.option === s));
export const hasOptions = (cats) => optionsUsed(cats).length > 0;
export const nextFreeSlots = (cats, n) => {
  const used = new Set(optionsUsed(cats));
  const free = OPTION_SLOTS.filter((s) => !used.has(s));
  return free.length >= n ? free.slice(0, n) : null;
};
export const lettersLeft = (k, fix) => `Only ${k} option letter${k === 1 ? "" : "s"} left — ${fix}`;

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

// A copied kit is its OWN kit: remap kitIds per copy, or the ownsGroup rule
// (ADR 0035) would let either copy's Remove/Reconfigure take the other option's rows.
// Copied tile rows' sfParts follow the copy's shower too (spec 2026-09-23).
// Both maps are built first: a tile row can sit above its shower's anchor.
export const duplicateInto = (area, slot) => {
  const src = area.products || [];
  const kitMap = new Map(), idMap = new Map();
  for (const p of src) {
    idMap.set(p.id, uid());
    if (p.kitId && !kitMap.has(p.kitId)) kitMap.set(p.kitId, uid());
  }
  const newKey = (key) => (kitMap.has(key) ? kitMap.get(key)
    : key.startsWith("row:") && idMap.has(key.slice(4)) ? "row:" + idMap.get(key.slice(4)) : key);
  const products = src.map((p) => {
    const next = { ...p, id: idMap.get(p.id) };
    if (p.kitId) next.kitId = kitMap.get(p.kitId);
    if (Array.isArray(p.sfParts)) next.sfParts = p.sfParts.map((e) => (e.kind === "shower" ? { ...e, kitId: newKey(e.kitId) } : e));
    return next;
  });
  return { ...area, id: uid(), option: slot, products };
};

// The Compare tab lands each build it prices as its own quote option — two
// since phase 5, up to four since the 4-way grid (ticket 158 Phase 3):
// `options` is [{ lines, name }] taking the job's next free letters in order
// (A onward on a job with none); the old { wediLines, schluterLines } shape
// reads as wedi first, Schluter second. Every
// area MUST land through a single updateProject call — the directory's setter
// closes over stale state, so two calls in one tick clobber each other — so
// this builds one patch, not N writes. These are fresh sibling areas (not a
// copy of shared work), so duplicateInto's shared-source retag rule doesn't
// apply here (ADR 0034 decision 4). Letters are the next free ones (owner 2026-09-29).
export const compareOptionsPatch = (project, hostAreaId, { options, wediLines, schluterLines, label } = {}) => {
  const opts = options || [{ lines: wediLines, name: "wedi" }, { lines: schluterLines, name: "Schluter" }];
  if (!opts.length || opts.some((o) => !(o.lines || []).length)) return null;
  const cats = project.categories || [];
  const slots = nextFreeSlots(cats, opts.length);
  if (!slots) return null;
  const hostIdx = cats.findIndex((a) => a.id === hostAreaId);
  const host = hostIdx >= 0 ? cats[hostIdx] : null;
  const base = (label && label.trim()) || (host?.name && host.name.trim()) || "Shower";
  const areas = opts.map((o, i) => ({
    ...newArea(), name: `${base} — ${o.name}`, option: slots[i],
    products: [...stampKit(o.lines).map((p) => ({ ...newProduct(), ...p })), newProduct()],
  }));
  const insertAt = hostIdx >= 0 ? hostIdx + 1 : cats.length;
  const categories = [...cats.slice(0, insertAt), ...areas, ...cats.slice(insertAt)];
  const optionNames = { ...Object.fromEntries(opts.map((o, i) => [slots[i], o.name])), ...normOptionNames(project.optionNames) };
  return { categories, optionNames };
};
