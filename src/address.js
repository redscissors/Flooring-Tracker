// Address-field helpers: a jump to Google Maps and a clean-up for what comes
// back on the clipboard. There is no autocomplete API behind this — the button
// opens Maps, the user copies, the paste button drops it in.

const MAPS = "https://www.google.com/maps";

// Seed a Maps search with whatever is already typed; with an empty field just
// open Maps so the search starts there.
export const mapsUrl = (text) => {
  const q = String(text || "").trim();
  return q ? `${MAPS}/search/?api=1&query=${encodeURIComponent(q)}` : MAPS;
};

// Maps copies a place as two lines — "Cleveland Clinic" then the street line.
// An address field is one line, so fold them together (without doubling a
// comma the first line already carries) and cap the length: a mis-aimed copy
// shouldn't drop a page of text into a field that prints on the estimate.
const MAX = 200;
const TRAILING = /[\s,;-]+$/;

export const cleanAddress = (raw) => {
  const parts = String(raw || "").split(/\r?\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  const joined = parts.reduce((acc, p) => (!acc ? p : acc + (/[,;-]$/.test(acc) ? " " : ", ") + p), "");
  return joined.slice(0, MAX).replace(TRAILING, "");
};
