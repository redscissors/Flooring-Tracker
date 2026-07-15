// Multi-file drop routing (ADR 0009 importer upgrades, PR C). Pure detection +
// routing over already-parsed files: each dropped file is read once by the
// component, then fingerprinted and matched to a book here. No I/O — the caller
// hands in parsed sheets (xlsx) or pages (pdf).

import { detectVtcEft, detectStockWorkbook, parseMapped } from "./pricebook.js";
import { isManningtonCartons } from "./manningtonbook.js";

// The strongest format tag we can read straight off the file. Priority follows
// the spec: stock signature → VTC EFT → Mannington PDF → generic.
export function fileFormat({ sheets, pages, isPdf }) {
  if (isPdf) return isManningtonCartons(pages || []) ? "mannington" : "generic";
  if (detectStockWorkbook(sheets || [])) return "stock";
  if (detectVtcEft(sheets || [])) return "vtc-eft";
  return "generic";
}

// A short, order-independent signature of the file's header, so a book can
// remember "what a file it imports looks like" and match the next drop even
// before a saved mapping exists. VTC files fingerprint off their detected header
// row; other xlsx files off the best data sheet's first non-empty row. PDFs get
// no header signature (their layout is grid-driven, matched by format tag).
export function computeFingerprint({ sheets, pages, isPdf }) {
  const format = fileFormat({ sheets, pages, isPdf });
  let header = [];
  if (!isPdf) {
    const eft = detectVtcEft(sheets || []);
    if (eft) header = sheets.find((s) => s.name === eft.sheet)?.rows?.[eft.headerRow] || [];
    else {
      for (const s of sheets || []) {
        const row = (s.rows || []).find((r) => (r || []).some((c) => c != null && String(c).trim()));
        if (row) { header = row; break; }
      }
    }
  }
  const headerSig = header.map((c) => String(c ?? "").toLowerCase().replace(/\s+/g, "")).filter(Boolean).sort().join("|");
  return { format, headerSig };
}

// Does a book's saved mapping actually parse this file? A cheap "would the
// existing mapping work" probe — the strongest signal for books imported before
// PR C stamped fingerprints. PDFs get a canonical sheet name derived from the
// file name, so their saved sheet name rarely matches a fresh drop; guard on
// the sheet being present.
export function mappingMatchesFile(mapping, sheets) {
  if (!mapping?.sheet) return false;
  const rows = (sheets || []).find((s) => s.name === mapping.sheet)?.rows;
  if (!rows) return false;
  try { return parseMapped(rows, mapping).items.length > 0; }
  catch { return false; }
}

const labelFor = (format, b) =>
  format === "vtc-eft" ? `Virginia Tile EFT → ${b?.name || "book"}`
    : format === "mannington" ? `Mannington cartons → ${b?.name || "book"}`
      : `Matches ${b?.name || "book"}'s saved layout`;
const reasonFor = (format) =>
  format === "vtc-eft" ? "Virginia Tile EFT — pick which book"
    : format === "mannington" ? "Mannington cartons — pick which book"
      : "Unrecognized layout — pick a book";

// Route one parsed file to a target book. Stock is deterministic; registry
// formats match a book by stored fingerprint format OR a saved mapping that
// parses the file (so pre-PR-C books, which have a saved mapping but no
// fingerprint, still match). Exactly one candidate ⇒ confident target; zero or
// several ⇒ null target and the routing UI asks.
export function routeFile({ format, headerSig, sheets }, books) {
  if (format === "stock") return { target: "stock", candidates: [], reason: "Shop workbook (sheet names matched)" };
  const cand = new Set();
  for (const b of books || []) {
    const fp = b.data?.importFingerprint;
    if (format !== "generic" && fp?.format === format) cand.add(b.id);
    else if (fp?.headerSig && headerSig && fp.headerSig === headerSig) cand.add(b.id);
    else if (mappingMatchesFile(b.data?.mapping, sheets)) cand.add(b.id);
  }
  const candidates = [...cand];
  if (candidates.length === 1) {
    const b = (books || []).find((x) => x.id === candidates[0]);
    return { target: candidates[0], candidates, reason: labelFor(format, b) };
  }
  return { target: null, candidates, reason: candidates.length ? "More than one book could take this file" : reasonFor(format) };
}
