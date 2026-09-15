// The "Deliver to" block of the order-entry panel: the project's one-line
// address split into ERP 1's delivery-address fields (street · apt/suite ·
// city · state · ZIP), laid out in the ERP form's own order so the desk works
// down both lists together.

const STATES = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT",
  delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI",
  minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};
const CODES = new Set(Object.values(STATES));
const stateCode = (s) => {
  const t = String(s || "").trim().replace(/\.$/, "");
  if (CODES.has(t.toUpperCase())) return t.toUpperCase();
  return STATES[t.toLowerCase()] || "";
};

const ZIP = /^\d{5}(?:-\d{4})?$/;
// A unit riding on the end of the street part: "Suite 200", "Apt. 3B", "#4".
// Anchored on a designator so a street that merely ends in a number (County
// Road 314, State Route 39) keeps it.
const UNIT_TAIL = /\s+((?:apt|apartment|suite|ste|unit|bldg|building|fl|floor|rm|room|lot)\.?\s*#?\s*[\w-]+|#\s*[\w-]+)$/i;
const UNIT_PART = /^(?:(?:apt|apartment|suite|ste|unit|bldg|building|fl|floor|rm|room|lot)\.?\s*#?\s*[\w-]+|#\s*[\w-]+|p\.?o\.?\s*(?:box\s*)?[\w-]+)$/i;

const EMPTY = { street: "", apt: "", city: "", state: "", zip: "", ok: true };

// Reads from the tail: ZIP, then state, then city, each its own comma part or
// sharing the city's ("Tuscarawas, OH 44682" and "Berlin, OH, 44610" both
// read). What precedes the city is the street, with any unit part — or a unit
// on the street's own tail — moved to apt/suite. A line with no state at the
// tail can't be split with confidence: it goes whole into Street with
// ok:false so the panel says so instead of pasting a guess.
export const splitAddress = (raw) => {
  const line = String(raw || "").replace(/\s+/g, " ").trim();
  if (!line) return { ...EMPTY };
  const parts = line.split(",").map((p) => p.trim()).filter(Boolean);
  let zip = "", state = "", city = "";
  let tail = parts.pop() || "";
  if (ZIP.test(tail)) { zip = tail; tail = parts.pop() || ""; }
  else { const m = tail.match(/^(.*?)\s*(\d{5}(?:-\d{4})?)$/); if (m) { zip = m[2]; tail = m[1].trim(); } }
  if (stateCode(tail)) { state = stateCode(tail); city = parts.pop() || ""; }
  else {
    // "Millersburg OH" / "Berlin Ohio" — city and state sharing one part.
    const words = tail.split(" ");
    for (let i = words.length - 1; i > 0; i--) {
      const code = stateCode(words.slice(i).join(" "));
      if (code) { state = code; city = words.slice(0, i).join(" "); break; }
    }
  }
  if (!state) return { ...EMPTY, street: line, ok: false };
  const apt = [];
  const street = [];
  parts.forEach((p) => {
    if (UNIT_PART.test(p)) { apt.push(p); return; }
    const m = p.match(UNIT_TAIL);
    if (m) { apt.push(m[1]); street.push(p.slice(0, m.index)); } else street.push(p);
  });
  return { street: street.join(", "), apt: apt.join(", "), city, state, zip, ok: true };
};

// ERP 1's delivery form, top to bottom.
export const deliverToRows = ({ custName = "", address = "", phone = "" } = {}) => {
  const a = splitAddress(address);
  return [
    { key: "name", label: "Delivery name", value: String(custName || "").trim() },
    { key: "street", label: "Street", value: a.street },
    { key: "apt", label: "Apt/suite", value: a.apt },
    { key: "city", label: "City", value: a.city },
    { key: "state", label: "State", value: a.state },
    { key: "zip", label: "ZIP code", value: a.zip },
    { key: "phone", label: "Phone number", value: String(phone || "").trim() },
  ];
};

// The block as it reads on screen: one field per line, city/state/ZIP sharing
// the fourth, blanks dropped.
export const deliverToLabel = (rows) => {
  const f = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const cityLine = [f.city && f.state ? `${f.city}, ${f.state}` : f.city || f.state, f.zip].filter(Boolean).join(" ");
  return [f.name, f.street, f.apt, cityLine, f.phone].filter(Boolean).join("\n");
};

// What copy-all writes to the clipboard, in order: every field on its own,
// then the label. The desk pastes with Win+V (Windows clipboard history,
// newest first) and picks the field each ERP 1 box wants — so the fields go
// LAST-TO-FIRST, which lists them top-to-bottom in the form's order under
// the label; and the label goes last so a plain Ctrl+V pastes the whole
// address (owner 2026-09-15).
export const deliverToSequence = (rows) => [...rows.filter((r) => r.value).map((r) => r.value).reverse(), deliverToLabel(rows)];
