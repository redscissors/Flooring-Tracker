// Registry→engine adapter for wedi's stock half (spec 2026-09-01, 8a): live
// registry rows are normOrderItem/normBookItem-shaped (`description` with the
// dimensions split out into `size`/`thickness`/`sfPerUnit`, the shop's code in
// `sku`, the vendor's in `vendorSkus`), while wedi.js's makeEntry was built
// against the transcribed table's six-field rows with the dimensions inline in
// `desc`. Everything the engine reads crosses this file; nothing else in the
// popup touches a raw book row.

import { inch } from "./wedi.js";

/**
 * The wedi US-SKU for one live row.
 *
 * The solver keys everything off `us`. The transcribed table had the join
 * baked in by hand; a live row carries the shop's code in `sku` and the
 * vendor's in `vendorSkus`. Three rules, each earned from the real export:
 *
 * 1. The shop's own Product Code is never the vendor's code — two rows repeat
 *    it in a vendor column (47815, 47733), so it is excluded.
 * 2. A `US`-shaped code beats a numeric article code — 29075/29076 carry an
 *    article number AND the real US-SKU. This preference is what makes the
 *    rule independent of order, which matters because normFits SORTS
 *    vendorSkus: column order does not survive normalization.
 * 3. Otherwise take what's left — 7 rows legitimately use a nine-digit article
 *    number as their `us`, exactly as the transcription did.
 *
 * NO fixup table. 28954 reads US50000005 in the export and `us: "US50000005"`
 * in WEDI_STOCK; wedi.js:4331 compensates for it deliberately. "Correcting" it
 * here re-keys the entry and breaks item("US50000005"). Verified: this rule
 * reproduces all 151 transcribed `us` values exactly.
 */
export function usOf(row) {
  if (!row) return "";
  const codes = (row.vendorSkus || []).filter((c) => c && c !== row.sku);
  return codes.find((c) => /^US\d+$/i.test(c)) || codes[0] || "";
}

/** The engine's own fraction vocabulary, hyphenated the way both sheets print a
 * mixed number — "5-3/4", "3/16". */
// inch() rounds to the nearest 64th, so spelling a decimal it cannot represent
// would CHANGE the value in a file whose whole contract is zero drift (0.3 ->
// "19/64" -> 0.296875). Every decimal the importer produces today is a binary
// fraction and round-trips exactly; anything that doesn't keeps its own digits.
function spell(n) {
  return Number.isInteger(n * 64) ? inch(n).replace(" ", "-") : String(n);
}

/**
 * The size cell, back in the units the vendor printed it in.
 *
 * The importer's `size` keeps a foot mark where the vendor used one ("3'x5'",
 * "39\"x98'") but renders an unmarked L×W as bare decimals ("24x48", "4x8"),
 * and dims() resolves that missing unit itself — unit-less values read as feet
 * only when every one of them is ≤ 12. So an all-integer bare size is left
 * exactly as it came: marking it would override that rule and shrink the 4x8
 * vapor panel from a sheet to an 8-inch chip.
 *
 * A NON-integer bare size is the one lossy case. dimVal flattens the fraction
 * the sheet printed — "3/16\"x5/32\"" → "0.1875x0.15625", "32\"x5-3/4\"" →
 * "32x5.75" — and a fractional dimension is never feet, so nothing is ambiguous
 * about restoring both the fraction and the inch mark. Left bare, dims() sees
 * 0.1875 ≤ 12 and reads the seal trowel as feet, inflating it to 2 1/4".
 */
function sizeOf(size) {
  const s = String(size == null ? "" : size);
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(s);
  if (!m || (Number.isInteger(+m[1]) && Number.isInteger(+m[2]))) return s;
  return spell(+m[1]) + '"x' + spell(+m[2]) + '"';
}

/**
 * A digit immediately followed by a hyphen at a word end — what
 * splitSizeFromDescription leaves behind when it lifts a fraction out of a
 * hyphenated figure. One source, two uses: `HYPHEN_SITES` counts the
 * candidates, `HYPHEN_SITE` reattaches to the single one.
 */
const HYPHEN_SITE = /\d-(?=\s|$)/;
const HYPHEN_SITES = new RegExp(HYPHEN_SITE.source, "g");

/**
 * A description with the dimensions inline, the way makeEntry expects them.
 *
 * The mapped importer always runs splitSizeFromDescription (pricebook.js:532)
 * and reassigns the description to the stripped name, moving the leading
 * dimensions into `size`, a fraction into `thickness`, and a coverage figure
 * into `sfPerUnit`. wedi's makeEntry parses w/d/t back out of `desc`, and for a
 * stock-only entry `desc` is the SOLE dimension source — so this puts them
 * back. Order matters: dims() reads left to right, and the transcribed table
 * always led with the size.
 *
 * The coverage figure is re-appended LAST, after the size/thickness lead —
 * makeEntry's subliner branch (wedi.js:4296-4298) matches
 * /(\d+)\s*(?:sft|sf|ft2)\b/i against this same text, and dims() only takes
 * its FIRST match (no `g` flag), which the leading size already satisfies —
 * so a trailing "<n>sf" with no "x" beside it can never be mistaken for a
 * second dimension pair. It is spelled the workbook's way ("106sf") because on
 * a row with no pricelist twin this text IS the display name.
 */
export function descOf(row) {
  if (!row) return "";
  const size = sizeOf(row.size);
  let desc = String(row.description == null ? "" : row.description);
  let thick = row.thickness || "";
  // splitSizeFromDescription takes the FIRST inch-marked fraction anywhere in
  // the string, so what it lifted as `thickness` is not always the size's third
  // dimension. When it came out of a hyphenated figure — a channel length
  // "27-1/2\"", a slope range "1-1/2\" to 2\"" — the residue is left holding a
  // dangling hyphen and the fraction belongs back THERE: re-leading with it
  // hands dims() a third value and files a channel length as a board thickness.
  //
  // INVARIANT: this fires ONLY when the residue names the site unambiguously —
  // exactly one dangling hyphen. Knowing the importer lifted the first fraction
  // of the ORIGINAL string does not say which of several dangling hyphens in
  // the RESIDUE it came out of, and this runs on vendor exports nobody has read
  // yet. A wrong guess is silent geometry corruption: a row carrying a genuine
  // leading board thickness AND one coincidental digit-hyphen would have its
  // `t` moved into the display string, taking `sizeText` with it. Two or more
  // candidates therefore fall back to the lead — the older, known behavior —
  // rather than a coin flip.
  //
  // Reattachment goes through a replace FUNCTION on purpose: `thick` is data
  // off a vendor row, and a "$" in it would be read as a pattern reference in a
  // string replacement.
  const sites = desc.match(HYPHEN_SITES);
  if (thick && sites && sites.length === 1) {
    desc = desc.replace(HYPHEN_SITE, (m) => m + thick);
    thick = "";
  }
  const lead = [size, thick].filter(Boolean).join("x");
  const cov = row.sfPerUnit > 0 ? `${row.sfPerUnit}sf` : "";
  return [lead, desc, cov].filter(Boolean).join(" ").replace(/\s{2,}/g, " ").trim();
}

/**
 * One live registry row → makeEntry's stockRow shape, or null when no code on
 * the row is a wedi part number. The only dropped row in the real export is
 * 29WEDIT, a custom-item placeholder with no vendor code (owner, 2026-09-01).
 */
export function adaptRow(row) {
  if (!row) return null;
  const us = usOf(row);
  if (!us) return null;
  return {
    erp: row.sku || "",
    desc: descOf(row),
    cost: +row.cost || 0,
    retail: +row.price || 0,
    unit: row.unit || "",
    us,
  };
}

/** Map a book's rows, dropping everything that carries no wedi part number. */
export function adaptBookRows(rows) {
  return (rows || []).map(adaptRow).filter(Boolean);
}
