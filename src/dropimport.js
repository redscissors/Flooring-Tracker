// Multi-file drop routing (ADR 0009 importer upgrades, PR C). Pure detection +
// routing over already-parsed files: each dropped file is read once by the
// component, then fingerprinted and matched to a book here. No I/O — the caller
// hands in parsed sheets (xlsx) or pages (pdf).

import { detectVtcEft, detectStockWorkbook, parseMapped } from "./pricebook.js";
import { isManningtonCartons } from "./manningtonbook.js";
import { isHallmarkWood, isTarkettLvt, isOvfSundries } from "./ovfbook.js";

// The strongest format tag we can read straight off the file. Priority follows
// the spec: stock signature → VTC EFT → OVF books → Mannington PDF → generic.
// The OVF banded flooring lists are tested before the sundries section-table,
// mirroring parseOvf's own routing order.
export function fileFormat({ sheets, pages, isPdf }) {
  if (isPdf) return isManningtonCartons(pages || []) ? "mannington" : "generic";
  if (detectStockWorkbook(sheets || [])) return "stock";
  if (detectVtcEft(sheets || [])) return "vtc-eft";
  if (isHallmarkWood(sheets || [])) return "ovf-hallmark";
  if (isTarkettLvt(sheets || [])) return "ovf-tarkett";
  if (isOvfSundries(sheets || [])) return "ovf-sundries";
  return "generic";
}

// A short, order-independent signature of the file's header, so a book can
// remember "what a file it imports looks like" and match the next drop even
// before a saved mapping exists. VTC files fingerprint off their detected header
// row; other xlsx files off the best data sheet's first non-empty row. PDFs get
// no header signature (their layout is grid-driven, matched by format tag).
//
// EFT files also get a title signature: Virginia Tile reuses the exact same
// template for every brand it distributes (VTC Core, Anatolia, Home
// Collection…), so the format tag and header are identical across brands. The
// one cell that names the price list is the title line just above the header
// row ("Virginia Tile Core" / "Anatolia Tile" / "VTC Home Collection") —
// that's what tells the sibling files apart.
export function computeFingerprint({ sheets, pages, isPdf }) {
  const format = fileFormat({ sheets, pages, isPdf });
  let header = [], title = "";
  if (!isPdf) {
    const eft = detectVtcEft(sheets || []);
    if (eft) {
      const rows = sheets.find((s) => s.name === eft.sheet)?.rows || [];
      header = rows[eft.headerRow] || [];
      for (let r = eft.headerRow - 1; r >= 0; r--) {
        const text = (rows[r] || []).map((c) => String(c ?? "").trim()).filter(Boolean).join(" ");
        if (text) { title = text; break; }
      }
    } else {
      for (const s of sheets || []) {
        const row = (s.rows || []).find((r) => (r || []).some((c) => c != null && String(c).trim()));
        if (row) { header = row; break; }
      }
    }
  }
  const headerSig = header.map((c) => String(c ?? "").toLowerCase().replace(/\s+/g, "")).filter(Boolean).sort().join("|");
  return { format, headerSig, title, titleSig: title.toLowerCase().replace(/\s+/g, " ") };
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

const FORMAT_NAMES = { mannington: "Mannington cartons", "ovf-hallmark": "OVF Hallmark wood", "ovf-tarkett": "OVF Tarkett LVT", "ovf-sundries": "OVF sundries" };
const labelFor = (format, b, title) =>
  format === "vtc-eft" ? `Virginia Tile EFT${title ? ` · ${title}` : ""} → ${b?.name || "book"}`
    : FORMAT_NAMES[format] ? `${FORMAT_NAMES[format]} → ${b?.name || "book"}`
      : `Matches ${b?.name || "book"}'s saved layout`;
const reasonFor = (format, title) =>
  format === "vtc-eft" ? `Virginia Tile EFT${title ? ` · ${title}` : ""} — pick which book`
    : FORMAT_NAMES[format] ? `${FORMAT_NAMES[format]} — pick which book`
      : "Unrecognized layout — pick a book";

// Route one parsed file to a target book. Stock is deterministic; registry
// formats match a book by stored fingerprint format OR a saved mapping that
// parses the file (so pre-PR-C books, which have a saved mapping but no
// fingerprint, still match). Exactly one candidate ⇒ confident target; zero or
// several ⇒ null target and the routing UI asks.
//
// Sibling-template rule: when both the file and a book's fingerprint carry a
// title (the EFT brand line), a matching title outranks every other signal and
// a mismatched title is a definite "not this book" — including the mapping
// probe, since Virginia Tile's shared template parses under every sibling
// book's mapping. Books stamped before titles existed keep matching by format
// alone until their next import stamps one.
export function routeFile({ format, headerSig, titleSig, title, sheets }, books) {
  if (format === "stock") return { target: "stock", candidates: [], reason: "Shop workbook (sheet names matched)" };
  const byTitle = new Set(), cand = new Set();
  for (const b of books || []) {
    const fp = b.data?.importFingerprint;
    const sameFormat = format !== "generic" && fp?.format === format;
    if (sameFormat && fp?.titleSig && titleSig) {
      if (fp.titleSig === titleSig) byTitle.add(b.id);
      continue;
    }
    if (sameFormat) cand.add(b.id);
    else if (fp?.headerSig && headerSig && fp.headerSig === headerSig) cand.add(b.id);
    else if (mappingMatchesFile(b.data?.mapping, sheets)) cand.add(b.id);
  }
  const candidates = byTitle.size ? [...byTitle] : [...cand];
  if (candidates.length === 1) {
    const b = (books || []).find((x) => x.id === candidates[0]);
    return { target: candidates[0], candidates, reason: labelFor(format, b, title) };
  }
  return { target: null, candidates, reason: candidates.length ? "More than one book could take this file" : reasonFor(format, title) };
}

// Walk order for a routed drop, grouped so that every file heading for the same
// book is visited back to back as one bundle (ADR 0025).
//
// This exists because importing a book's files one after another is silently
// destructive: each apply diffs against the WHOLE book, so the second file reads
// the first file's rows as missing and retires them, leaving only the last file's
// contents active. Bundling lets the caller accumulate items across a book's
// files and write once, on the last step.
//
// Input rows are the routed drop rows ({ target, ... }); output preserves the
// order books were first seen, and stamps each step with its position in its
// book's bundle plus the bundle's files (so the last step can report them all).
export function bundleByBook(rows) {
  const groups = [];
  for (const row of rows || []) {
    const g = groups.find((x) => x.target === row.target);
    if (g) g.rows.push(row); else groups.push({ target: row.target, rows: [row] });
  }
  return groups.flatMap((g) =>
    g.rows.map((row, index) => ({
      row,
      bundle: { index, total: g.rows.length },
      files: g.rows.map((r) => r.file),
      rows: g.rows,
    })));
}

// ---- the book's source manifest (ADR 0025) ---------------------------------
// What files a book is made of. Recorded by use — importing a bundle stamps each
// file it contained as a slot — so nothing has to be configured up front, and a
// book fed by one file has a one-slot manifest that never surfaces.
//
// A slot is matched by HOW THE FILE WAS OBTAINED, never by its name. Vendors date
// their filenames and those dates move between releases ("AOT EFT 26 02 19" ->
// "AOT EFT 26 05 20"), so a name match would read every new release as a missing
// file. Fetched sheets match on recordKey (vendor:host:uid:user, which excludes
// the filename by design); hand-supplied files match on their content
// fingerprint, the same signal routeFile already uses. `label` is the filename as
// last seen — display only, refreshed on every match.
export function sourceSlot({ recordKey, fingerprint, name } = {}) {
  const fp = fingerprint || {};
  const label = String(name || "").trim();
  if (recordKey) return { id: `fetch:${recordKey}`, kind: "fetch", label, recordKey };
  const f = { format: fp.format || "generic", headerSig: fp.headerSig || "", titleSig: fp.titleSig || "" };
  return { id: `manual:${f.format}:${f.headerSig}:${f.titleSig}`, kind: "manual", label, fingerprint: f };
}

// The book's manifest after an import that contained `slots`: known slots refresh
// their label and lastSeen, unknown ones are appended in the order they arrived.
// Never drops a slot — a file absent from this import is the whole point of the
// completeness gate, and silently forgetting it would defeat that.
export function mergeSources(prev, slots, at = Date.now()) {
  const out = (prev || []).map((s) => ({ ...s }));
  for (const slot of slots || []) {
    if (!slot?.id) continue;
    const hit = out.find((s) => s.id === slot.id);
    if (hit) { hit.label = slot.label || hit.label; hit.lastSeen = at; }
    else out.push({ ...slot, lastSeen: at });
  }
  return out;
}

// Slots the book expects that this import does not have. Empty for a one-slot
// book, and empty whenever every known slot is present — the gate only appears
// when something the book has been fed before is absent.
export function missingSources(manifest, slots) {
  const have = new Set((slots || []).map((s) => s?.id).filter(Boolean));
  return (manifest || []).filter((s) => s?.id && !have.has(s.id));
}
