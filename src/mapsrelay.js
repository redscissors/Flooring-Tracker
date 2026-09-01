// The relay's request contract (netlify/functions/maps.mjs), kept pure and
// beside the browser code so both ends validate identically — the split
// vendorfetch.js/vendor-fetch.mjs uses (ADR 0019). The function never accepts a
// URL, only these three shapes, so it cannot be driven as an open proxy.

export const OPS = ["suggest", "distance", "probe"];
export const MIN_INPUT = 3;
export const MAX_INPUT = 200;

const clean = (v) => String(v ?? "").trim();

export function relayProblems(body) {
  const op = body && body.op;
  if (!OPS.includes(op)) return "unknown op";
  if (op === "probe") return null;
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
