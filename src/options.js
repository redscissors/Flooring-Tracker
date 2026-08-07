import { uid } from "./model.js";

// Quote options (ADR 0031): an area's `option` is "" (shared — part of the job
// in every option) or a fixed slot letter. Slots are positional identities, not
// records; custom display names live in project.optionNames.
export const OPTION_SLOTS = ["A", "B", "C"];
// Deliberately outside the moss palette, like the tier colors: options must be
// tellable apart at a glance. `soft` is the wash for bands/cards.
export const OPTION_COLOR = {
  A: { main: "#3E5F8A", deep: "#2E4869", soft: "color-mix(in srgb, #3E5F8A 8%, transparent)" },
  B: { main: "#9A5B33", deep: "#6E401F", soft: "color-mix(in srgb, #9A5B33 8%, transparent)" },
  C: { main: "#6E4E7E", deep: "#503659", soft: "color-mix(in srgb, #6E4E7E 8%, transparent)" },
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
