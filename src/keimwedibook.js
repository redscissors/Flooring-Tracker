// Keim's wedi price sheet (ticket 158 P0-6) — the shop's own retail list for
// the wedi shower system, dropped onto the wedi STOCK book as a price update.
// Owner, 2026-09-26: it updates the stock book; the Contractor tabs land
// nowhere. The sheet carries retail only, so the wizard's priceUpdate mode
// (orderbook.js priceUpdateBundle) changes just the price of rows the book
// already has, adds shop SKUs it doesn't, and retires nothing — the ERP
// export stays the book's whole-book source.

const str = (v) => (v == null ? "" : String(v)).replace(/\s+/g, " ").trim();

export const KEIM_WEDI_SHEETS = ["Retail", "Wedi S-Dry Retail"];

// The ERP stores retail rounded UP to the cent (378.1802178 → 378.19); the
// sheet carries the raw figure. Rounding to the nearest cent would read 48 of
// the 125 shared rows as changed when nothing moved. The 1e6 pre-round sheds
// float noise (54.66 must not become 54.67).
export const ceilCents = (n) => Math.ceil(Math.round(+n * 1e6) / 1e4) / 100;

/** The account line ("Keim Lumber") and a WEDI title within the first rows of a Retail tab. */
export function isKeimWediSheet(sheets) {
  if (!Array.isArray(sheets)) return false;
  const s = sheets.find((x) => KEIM_WEDI_SHEETS.includes(str(x?.name)));
  if (!s) return false;
  const top = (s.rows || []).slice(0, 5).map((r) => (r || []).map(str).join(" "));
  return top.some((t) => /keim lumber/i.test(t)) && top.some((t) => /\bwedi\b/i.test(t));
}

function parseTab(rows) {
  const out = [];
  let cols = null, section = "";
  for (const raw of rows || []) {
    const cells = (raw || []).map(str);
    if (!cols) {
      const at = (re) => cells.findIndex((c) => re.test(c));
      if (at(/^sku$/i) >= 0 && at(/retail/i) >= 0) {
        cols = { sku: at(/^sku$/i), desc: at(/^description$/i), mfg: at(/^mfg sku$/i), unit: at(/^u\/m$/i), price: at(/retail/i), note: at(/^notes?$/i) };
      }
      continue;
    }
    const sku = cells[cols.sku];
    const price = raw[cols.price];
    if (/^\d+$/.test(sku) && typeof price === "number") {
      out.push({ sku, description: cells[cols.desc] || "", mfg: cols.mfg >= 0 ? cells[cols.mfg] : "",
        unit: cols.unit >= 0 ? cells[cols.unit] : "", price: ceilCents(price), section,
        note: cols.note >= 0 ? cells[cols.note] : "" });
    } else if (sku && !/^\d+$/.test(sku)) {
      section = sku;
    }
  }
  return out;
}

export const KEIM_WEDI_MAPPING = {
  columns: { 0: "sku", 1: "description", 2: "vendorSku", 3: "unit", 4: "price", 5: "section", 6: "note" },
  headerRow: 0,
  skuPattern: "^\\d+$",
  defaultType: "",
  groupBy: "section",
};

/**
 * The entry the import wizard calls; null when the workbook isn't the Keim
 * sheet. Tabs are read in KEIM_WEDI_SHEETS order and the first listing of a
 * SKU wins — a second listing at another price is named in a warning.
 */
export function parseKeimWedi(sheets, name = "Keim wedi price sheet") {
  if (!isKeimWediSheet(sheets)) return null;
  const warnings = [], seen = new Map(), items = [];
  for (const tab of KEIM_WEDI_SHEETS) {
    const s = sheets.find((x) => str(x?.name) === tab);
    if (!s) { warnings.push(`Sheet "${tab}" not found — its rows were not read`); continue; }
    const got = parseTab(s.rows);
    if (!got.length) warnings.push(`Sheet "${tab}" yielded no rows — has its layout changed?`);
    for (const it of got) {
      const prev = seen.get(it.sku);
      if (prev) {
        if (prev.price !== it.price) warnings.push(`${it.sku} is listed twice ($${prev.price} and $${it.price}) — kept $${prev.price}`);
        continue;
      }
      seen.set(it.sku, it);
      items.push(it);
    }
  }
  const skipped = sheets.map((x) => str(x?.name)).filter((n) => n && !KEIM_WEDI_SHEETS.includes(n));
  if (skipped.length) warnings.push(`Skipped sheets (not imported): ${skipped.join(", ")}`);
  const CANON = ["SKU", "Description", "Mfg SKU", "U/M", "Retail", "Section", "Notes"];
  const rows = [CANON, ...items.map((it) => [it.sku, it.description, it.mfg, it.unit, it.price, it.section, it.note])];
  return { name, rows, mapping: { ...KEIM_WEDI_MAPPING }, warnings, priceUpdate: true };
}
