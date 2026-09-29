// basketkit — the shared shower basket's two-engine side: one view shape over
// wedi and Schluter staged/placed kits, and the option naming a basket send
// lands under. Imports both kit-view modules, so LAZY-CHUNK-ONLY (ADR 0026):
// model.js and the boot path never reach it.
import { wediEntryView } from "./wedikitview.js";
import { schluterEntryView } from "./schluterkitview.js";
import { BRAND, hostCellKey } from "./comparegrid.js";
import { nextFreeSlots, optionsUsed } from "./options.js";
import { OPTION_SLOTS } from "./model.js";

const SYSTEM = {
  "wedi:board": "Building Panel",
  "wedi:membrane": "S-DRY membrane",
  "schluter:board": "KERDI-BOARD",
  "schluter:membrane": "KERDI membrane",
};

const viewOf = (brand, marker, session, ctx) =>
  (brand === "wedi" ? wediEntryView : schluterEntryView)(marker, session, ctx[brand]);

const shape = ({ title, meta, price, faint, lines }) => ({ title, meta, price, faint: !!faint, lines });

export const entryView = (entry, ctx) => ({
  id: entry.id,
  brand: entry.brand,
  target: entry.target,
  ...shape(viewOf(entry.brand, entry.snap, entry.session || {}, ctx)),
});

export const placedView = (kit, ctx) => ({
  ...kit,
  ...shape(viewOf(kit.brand, kit.marker, undefined, ctx)),
});

export const optionName = (entry) =>
  `${BRAND[entry.brand]} ${SYSTEM[hostCellKey(entry.brand, entry.snap.cfg)]}`;

export function optionsFromEntries(views, entries, cats) {
  if (!nextFreeSlots(cats, views.length)) return { short: OPTION_SLOTS.length - optionsUsed(cats).length };
  const seen = {};
  const options = views.map((v, i) => {
    const base = optionName(entries[i]);
    seen[base] = (seen[base] || 0) + 1;
    return { name: seen[base] > 1 ? `${base} ${seen[base]}` : base, lines: v.lines() };
  });
  return { options };
}

export const moveable = (views) => ({
  ready: views.filter((v) => !v.faint),
  waiting: views.filter((v) => v.faint).length,
});
