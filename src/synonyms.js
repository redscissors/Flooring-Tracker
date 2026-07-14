// Trade synonyms for price-book search (ADR 0009 §6, Option D).
//
// These cover what trigram fuzzy search CANNOT: umbrella words the trade uses
// ("transition" for any trim profile), acronyms ("sbn" for surface bullnose),
// brand-as-category ("durock" for any cement board), and hyphen/spacing
// variants ("t-mold" / "t-molding"). Plain misspellings are handled by the
// fuzzy search (word_similarity), not here — don't list typos.
//
// Keys are single lowercase tokens (a query is split on whitespace before
// lookup). Each expands to a list of alternates that get OR'd together for that
// query word. The order-book picker sends these groups to the RPC; the pre-
// migration ILIKE fallback uses the same groups for exact substring matches.
export const SYNONYMS = {
  // Transition / trim profiles — "transition" is the trade umbrella
  transition: ["reducer", "t-molding", "t-mold", "tmold", "end cap", "endcap", "stairnose", "stair nose", "threshold", "reno-t", "quarter round", "base shoe"],
  transitions: ["reducer", "t-molding", "t-mold", "tmold", "end cap", "endcap", "stairnose", "stair nose", "threshold", "reno-t", "quarter round", "base shoe"],
  "t-mold": ["t-molding", "t-mold", "tmold", "tmolding"],
  tmold: ["t-molding", "t-mold", "tmold", "tmolding"],
  stairnose: ["stairnose", "stair nose", "bullnose stair"],
  threshold: ["threshold", "reno-t", "marble threshold", "saddle"],

  // Bullnose / edge
  bullnose: ["bullnose", "sbn", "surface bullnose"],
  sbn: ["bullnose", "sbn", "surface bullnose"],

  // Setting materials
  thinset: ["thinset", "mortar", "medium bed", "lht"],
  mortar: ["mortar", "thinset", "medium bed"],
  lht: ["large heavy tile", "lht", "medium bed mortar"],

  // Resilient / vinyl
  lvp: ["vinyl plank", "lvp", "lvt", "luxury vinyl", "rigid core"],
  lvt: ["vinyl tile", "lvt", "lvp", "luxury vinyl", "rigid core"],
  vinyl: ["vinyl", "lvp", "lvt", "luxury vinyl"],
  spc: ["spc", "rigid core", "stone plastic"],
  wpc: ["wpc", "rigid core", "wood plastic"],

  // Underlayment / backer
  underlayment: ["underlayment", "backer board", "backerboard", "cement board", "cementboard", "membrane", "ditra"],
  backer: ["backer board", "backerboard", "cement board", "durock", "hardiebacker", "wonderboard"],
  durock: ["durock", "cement board", "backer board"],
  ditra: ["ditra", "membrane", "uncoupling"],

  // Shapes
  hex: ["hex", "hexagon", "esagona", "esagonia"],
  hexagon: ["hex", "hexagon", "esagona", "esagonia"],
  mosaic: ["mosaic", "mesh mounted", "mesh"],

  // Material
  porcelain: ["porcelain", "porc"],
};

// A query word -> [itself, ...its synonyms]. Always includes the original so
// an unmapped word still searches for itself.
export const expand = (word) => {
  const w = String(word ?? "").toLowerCase();
  return SYNONYMS[w] ? [w, ...SYNONYMS[w]] : [w];
};
