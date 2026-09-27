// The shared bill-line slots (ticket 158 Phase 1, ADR 0049): both shower
// engines tag every line with one of these, so swaps, "+" pickers and Compare
// treat a Schluter line and a wedi line as the same kind of thing.
export const SLOTS = ["tray", "drainBody", "grate", "flange", "wallBoard", "wallMembrane",
  "seam", "corners", "niche", "bench", "curb", "setting", "extra"];

export const SLOT_LABEL = {
  tray: "Tray", drainBody: "Drain body", grate: "Grate / cover", flange: "Flange",
  wallBoard: "Wall board", wallMembrane: "Wall membrane", seam: "Seam / band",
  corners: "Corners", niche: "Niche", bench: "Bench", curb: "Curb",
  setting: "Setting material", extra: "Extras",
};

export const isSlot = (s) => SLOTS.includes(s);

// The bill groups both popups and Compare draw (Phase 1d, owner order). A
// line's group is read off its slot, never off the engine's own group key —
// those stay internal (saved override keys and added rows carry them).
export const GROUPS = [
  { key: "base", label: "Base", slots: ["tray"] },
  { key: "drain", label: "Drain", slots: ["drainBody", "grate", "flange"] },
  { key: "curb", label: "Curb", slots: ["curb"] },
  { key: "walls", label: "Walls", slots: ["wallBoard", "wallMembrane"] },
  { key: "seams", label: "Seams", slots: ["seam", "corners"] },
  { key: "niches", label: "Niches", slots: ["niche"] },
  { key: "bench", label: "Bench", slots: ["bench"] },
  { key: "setting", label: "Setting", slots: ["setting"] },
  { key: "extras", label: "Extras", slots: ["extra"] },
];

/** The group key a slot draws under; an unknown slot is an extra. */
export const groupOf = (slot) => (GROUPS.find((g) => g.slots.includes(slot)) || GROUPS[GROUPS.length - 1]).key;

export const groupLabel = (key) => (GROUPS.find((g) => g.key === key) || {}).label || key;
