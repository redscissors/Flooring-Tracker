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
