// Registry→engine adapter for wedi's stock half (spec 2026-09-01, 8a): live
// registry rows are normOrderItem/normBookItem-shaped (`description` with the
// dimensions split out into `size`/`thickness`/`sfPerUnit`, the shop's code in
// `sku`, the vendor's in `vendorSkus`), while wedi.js's makeEntry was built
// against the transcribed table's six-field rows with the dimensions inline in
// `desc`. Everything the engine reads crosses this file; nothing else in the
// popup touches a raw book row.

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
 */
export function descOf(row) {
  if (!row) return "";
  const lead = [row.size, row.thickness].filter(Boolean).join("x");
  return [lead, row.description].filter(Boolean).join(" ").replace(/\s{2,}/g, " ").trim();
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
