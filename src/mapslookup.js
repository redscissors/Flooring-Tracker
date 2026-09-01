// Reading Google's two answers, and deciding when a stored distance no longer
// describes the addresses it was measured between.
//
// The request/response shapes here were written from the API docs without a key
// to test against, so every parser is defensive on purpose: a shape we guessed
// wrong must come back empty and be REPORTED by the caller, never throw and
// never look like "no results".

import { MAX_INPUT } from './mapsrelay.js';

export const MIN_SUGGEST = 4;
// Google appends the country to every result. The shop quotes US jobs only, so
// on an estimate it is noise — an address should end at the ZIP (owner,
// 2026-09-01). Deliberately narrow: only a COMMA-separated US country tail
// goes, so "12 Usa Ridge Rd" keeps its street name and a genuinely foreign
// address keeps its country, where the country is information rather than noise.
const COUNTRY_TAIL = /,\s*(?:USA|United States(?: of America)?)\.?\s*$/i;
const dropCountry = (s) => String(s || "").replace(COUNTRY_TAIL, "").trim();
const METERS_PER_MILE = 1609.344;
const key = (s) => String(s || "").trim().toLowerCase();

// suggestions[].placePrediction.text is a LocalizedText ({ text }) in the
// current API; tolerate a bare string too. The placeId rides along because
// Autocomplete omits postal codes (and unit numbers) by design — a picked
// suggestion is resolved through Place Details to get the complete address
// (ADR 0036 amendment, verified against the live API 2026-09-01). A prediction
// without one is still offered: its text alone is better than no suggestion.
export const parseSuggestions = (json) => {
  const list = Array.isArray(json?.suggestions) ? json.suggestions : [];
  const out = [];
  for (const s of list) {
    const t = s?.placePrediction?.text;
    const text = String((t && typeof t === "object" ? t.text : t) ?? "").trim();
    const clean = dropCountry(text);
    if (clean && !out.some((o) => key(o.text) === key(clean))) out.push({ text: clean, placeId: String(s?.placePrediction?.placeId ?? "") });
  }
  return out;
};

// The complete address, postal code included — what Autocomplete could not give.
export const parseDetails = (json) => {
  const a = json?.formattedAddress;
  return typeof a === "string" ? dropCountry(a) : "";
};

// Routes answers duration as seconds with a trailing "s" ("1620s").
export const parseDistance = (json) => {
  const r = Array.isArray(json?.routes) ? json.routes[0] : null;
  const meters = Number(r?.distanceMeters);
  if (!Number.isFinite(meters) || meters < 0) return null;
  const secs = parseFloat(String(r?.duration ?? "").replace(/s$/, ""));
  return {
    miles: Math.round((meters / METERS_PER_MILE) * 10) / 10,
    minutes: Number.isFinite(secs) ? Math.round(secs / 60) : null,
  };
};

export const formatDist = (d) => {
  if (!d || !Number.isFinite(d.miles)) return "";
  return Number.isFinite(d.minutes) ? `${d.miles} mi · ${d.minutes} min` : `${d.miles} mi`;
};

export const normDistance = (d) => {
  if (!d || typeof d !== "object") return null;
  const miles = Number(d.miles);
  if (!Number.isFinite(miles)) return null;
  const minutes = Number(d.minutes);
  return { miles, minutes: Number.isFinite(minutes) ? minutes : null, from: String(d.from || ""), to: String(d.to || ""), at: Number(d.at) || 0 };
};

// A stored distance is a record of a measurement, not a cache: nothing clears
// or refetches it on its own. This only reports that the ends have moved, so
// the row can offer a recheck — the qtyDrift doctrine (catalog.js).
export const distStale = (rec, address, shopAddress) =>
  !!rec && Number.isFinite(rec.miles) && !(key(rec.to) === key(address) && key(rec.from) === key(shopAddress));

export const shouldSuggest = (input, last) => {
  const q = String(input || "").trim();
  return q.length >= MIN_SUGGEST && q.length <= MAX_INPUT && q !== String(last || "").trim();
};
