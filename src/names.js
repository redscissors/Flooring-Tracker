// Name matching for the "use existing?" prompts (customers and builders,
// ADR 0005). Pure + tested so the dedup behaviour — the thing that stops
// "P&L" and "P & L" becoming two builders — can't silently regress.

// Collapse to a comparison key: lowercase, letters+digits only. "P & L",
// "P&L", and "p&l." all key to "pl".
export const normName = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

// Levenshtein edit distance over the normalized keys.
export const editDist = (a, b) => {
  a = normName(a); b = normName(b);
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
};

// Match a typed name against a list of { name } records. Returns
// { kind: "exact" } for a case/punctuation-insensitive equal name, else the
// closest { kind: "similar" } within edit distance 2 (or a prefix overlap, so
// "P & L" flags the existing "P&L Construction"), else null. Names under two
// significant characters never match (too little signal).
export const matchName = (list, name) => {
  const nn = normName(name);
  if (nn.length < 2) return null;
  const exact = (list || []).find((x) => normName(x.name) === nn);
  if (exact) return { kind: "exact", item: exact };
  let best = null, bestD = Infinity;
  for (const x of (list || [])) {
    const xn = normName(x.name);
    let d = editDist(name, x.name);
    if ((xn.startsWith(nn) || nn.startsWith(xn)) && Math.min(xn.length, nn.length) >= 2) d = Math.min(d, 1);
    if (d < bestD) { bestD = d; best = x; }
  }
  return best && bestD <= 2 ? { kind: "similar", item: best } : null;
};
