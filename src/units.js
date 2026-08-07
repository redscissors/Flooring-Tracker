// The sell units a price book can quote and a job can order in.
//
// One table so a unit reads the same everywhere — the selection grid, the
// printed estimate, the order-entry panel. Before this, "each" was hardcoded at
// every count line and the only units with names were CT and SH, so a Schluter
// roll (Unit of Stock "RL") read as "3 pcs · $84.20/ea" on a sheet the customer
// signs. A unit this table doesn't know still prints — it falls through as the
// vendor's own code, uppercased — so an unrecognized spelling shows the book's
// word rather than a confidently wrong "EA".
//
// `code` is the short form the ERP and the printed sheet use; `one`/`many` are
// how a quantity reads in prose ("1 roll" / "3 rolls").
const UNITS = {
  sf: { code: "SF", one: "sq ft", many: "sq ft" },
  lf: { code: "LF", one: "lin ft", many: "lin ft" },
  ea: { code: "EA", one: "piece", many: "pieces" },
  pc: { code: "PC", one: "piece", many: "pieces" },
  ct: { code: "CT", one: "carton", many: "cartons" },
  bx: { code: "BX", one: "box", many: "boxes" },
  bd: { code: "BD", one: "bundle", many: "bundles" },
  sh: { code: "SH", one: "sheet", many: "sheets" },
  rl: { code: "RL", one: "roll", many: "rolls" },
  pk: { code: "PK", one: "pack", many: "packs" },
  bg: { code: "BG", one: "bag", many: "bags" },
  gl: { code: "GL", one: "gallon", many: "gallons" },
};
// Vendor spellings → the table's key. "units" is the app's own internal word for
// a bare piece count, kept so existing rows keep reading as pieces.
const ALIAS = {
  sqft: "sf", sft: "sf", lft: "lf", lnft: "lf", ln: "lf",
  each: "ea", pcs: "pc", piece: "pc", pieces: "pc", units: "pc", st: "pc", stick: "pc", sticks: "pc",
  ctn: "ct", carton: "ct", cartons: "ct", cs: "bx", case: "bx", box: "bx", boxes: "bx",
  bl: "bd", bdl: "bd", bundle: "bd", bundles: "bd",
  sht: "sh", sheet: "sh", sheets: "sh",
  rls: "rl", roll: "rl", rolls: "rl",
  pkg: "pk", pack: "pk", packs: "pk",
  bag: "bg", bags: "bg", gal: "gl", gallon: "gl", gallons: "gl",
};

const clean = (u) => String(u ?? "").trim().toLowerCase().replace(/[.\s]/g, "");
const key = (u) => { const v = clean(u); return UNITS[v] ? v : ALIAS[v] || ""; };

// "rl" / "Rolls" / "RL" → "RL"; an unknown unit → its own text, uppercased.
export const unitCode = (u) => { const k = key(u); return k ? UNITS[k].code : String(u ?? "").trim().toUpperCase(); };

// How `n` of a unit reads in prose: unitNoun(3, "rl") → "rolls". An unknown
// unit falls back to the vendor's word, singularized at 1 the way the settings
// units (bags, rolls, boxes) have always been.
export const unitNoun = (n, u) => {
  const k = key(u);
  if (k) return n === 1 ? UNITS[k].one : UNITS[k].many;
  const v = String(u ?? "").trim();
  return n === 1 ? v.replace(/s$/, "") : v;
};

// A roll is a coverage-bundling sell unit like a carton or sheet — one roll
// covers so many square feet — but it holds no countable pieces, so it is
// deliberately neither isPieceUnit nor isCartonUnit (stock.js).
export const isRollUnit = (u) => key(u) === "rl";
