// The relay's request contract (netlify/functions/maps.mjs), kept pure and
// beside the browser code so both ends validate identically — the split
// vendorfetch.js/vendor-fetch.mjs uses (ADR 0019). The function never accepts a
// URL, only these three shapes, so it cannot be driven as an open proxy.

export const OPS = ["suggest", "distance", "details", "probe"];
export const MIN_INPUT = 3;
export const MAX_INPUT = 200;
// Both of these are interpolated into the upstream URL — the placeId into the
// path, the session token into the query — so they are refused here on shape
// rather than escaped downstream. Nothing about a real Google value needs a
// character outside these sets.
const PLACE_ID = /^[A-Za-z0-9_-]{1,512}$/;
const SESSION_TOKEN = /^[A-Za-z0-9_-]{1,128}$/;

const clean = (v) => String(v ?? "").trim();

export function relayProblems(body) {
  const op = body && body.op;
  if (!OPS.includes(op)) return "unknown op";
  if (body.sessionToken != null && !SESSION_TOKEN.test(String(body.sessionToken))) return "bad sessionToken";
  if (op === "probe") return null;
  if (op === "details") {
    const placeId = clean(body.placeId);
    if (!placeId) return "missing placeId";
    return PLACE_ID.test(placeId) ? null : "bad placeId";
  }
  if (op === "suggest") {
    const input = clean(body.input);
    if (input.length < MIN_INPUT) return "input too short";
    if (input.length > MAX_INPUT) return "input too long";
    return null;
  }
  const origin = clean(body.origin), destination = clean(body.destination);
  if (!origin) return "missing origin";
  if (!destination) return "missing destination";
  if (origin.length > MAX_INPUT || destination.length > MAX_INPUT) return "address too long";
  return null;
}
